const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { subscribeLiveEvents, publishLiveEvent } = require("../liveDeliveryHub");
const { ensureDeliverySession, endDeliverySession, getLiveSnapshot } = require("../liveDeliveryState");

const router = express.Router();

function matchesFilter(event, filters) {
  if (filters.driver_id && String(event?.driver_id || "") !== filters.driver_id) return false;
  if (filters.route_id && String(event?.route_id || "") !== filters.route_id) return false;
  return true;
}

function writeSse(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.get("/state", async (req, res) => {
  const db = getDb();
  const snapshot = await getLiveSnapshot(db, {
    driver_id: req.query.driver_id,
    route_id: req.query.route_id,
    status: req.query.status,
  });
  return res.json(snapshot);
});

router.get("/stream", async (req, res) => {
  const db = getDb();
  const filters = {
    driver_id: typeof req.query.driver_id === "string" ? req.query.driver_id.trim() : "",
    route_id: typeof req.query.route_id === "string" ? req.query.route_id.trim() : "",
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  writeSse(res, "connected", { ok: true, filters, connected_at: new Date().toISOString() });
  writeSse(res, "snapshot", await getLiveSnapshot(db, filters));

  const heartbeat = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 15000);

  const unsubscribe = subscribeLiveEvents((event) => {
    if (!matchesFilter(event, filters)) return;
    writeSse(res, event.type || "message", event);
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

router.post("/session/start", requireAuth, async (req, res) => {
  if (!["admin", "driver"].includes(req.user?.role)) {
    return res.status(403).json({ detail: "Bu endpoint sadece admin ve driver icin." });
  }

  const payload = {
    driver_id: String(req.body?.driver_id || req.user.user_id || req.user.email || "").trim(),
    driver_name: String(req.body?.driver_name || req.user.full_name || "").trim(),
    route_id: String(req.body?.route_id || "").trim(),
    route_name: String(req.body?.route_name || "").trim(),
    status: "active",
  };

  if (!payload.driver_id || !payload.route_id) {
    return res.status(400).json({ detail: "driver_id ve route_id zorunlu." });
  }

  const db = getDb();
  await ensureDeliverySession(db, payload);
  publishLiveEvent({ type: "session_started", ...payload });
  return res.json({ success: true, session: payload });
});

router.post("/session/end", requireAuth, async (req, res) => {
  if (!["admin", "driver"].includes(req.user?.role)) {
    return res.status(403).json({ detail: "Bu endpoint sadece admin ve driver icin." });
  }

  const payload = {
    driver_id: String(req.body?.driver_id || req.user.user_id || req.user.email || "").trim(),
    route_id: String(req.body?.route_id || "").trim(),
  };

  if (!payload.driver_id || !payload.route_id) {
    return res.status(400).json({ detail: "driver_id ve route_id zorunlu." });
  }

  const db = getDb();
  await endDeliverySession(db, payload);
  publishLiveEvent({ type: "session_ended", ...payload });
  return res.json({ success: true });
});

module.exports = router;
