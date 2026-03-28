const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

router.get("/", requireAuth, async (req, res) => {
  const db = getDb();
  const rawDriverId = typeof req.query.driver_id === "string" ? req.query.driver_id.trim() : "";
  const effectiveDriverId =
    req.user.role === "admin"
      ? rawDriverId
      : req.user.user_id || req.user.email;

  const query = effectiveDriverId ? { driver_id: effectiveDriverId } : {};
  const locations = await db
    .collection("DriverLocations")
    .find(query)
    .sort({ updated_at: -1 })
    .toArray();

  return res.json({
    locations: locations.map((item) => ({
      ...item,
      _id: String(item._id),
      timestamp: normalizeTimestamp(item.timestamp),
      updated_at: normalizeTimestamp(item.updated_at),
    })),
  });
});

router.post("/", requireAuth, async (req, res) => {
  if (!["admin", "driver"].includes(req.user?.role)) {
    return res.status(403).json({ detail: "Bu endpoint sadece admin ve driver icin." });
  }

  const driverId = String(req.body?.driver_id || req.user.user_id || req.user.email || "").trim();
  const latitude = toNumber(req.body?.latitude);
  const longitude = toNumber(req.body?.longitude);

  if (!driverId) {
    return res.status(400).json({ detail: "driver_id zorunlu." });
  }

  if (latitude == null || longitude == null) {
    return res.status(400).json({ detail: "latitude ve longitude zorunlu." });
  }

  if (req.user.role !== "admin") {
    const sessionDriverId = String(req.user.user_id || req.user.email || "").trim();
    if (driverId !== sessionDriverId) {
      return res.status(403).json({ detail: "Sadece kendi konumunuzu yayinlayabilirsiniz." });
    }
  }

  const document = {
    driver_id: driverId,
    driver_name: String(req.body?.driver_name || req.user.full_name || "").trim(),
    route_id: String(req.body?.route_id || "").trim(),
    route_name: String(req.body?.route_name || "").trim(),
    latitude,
    longitude,
    accuracy: toNumber(req.body?.accuracy),
    heading: toNumber(req.body?.heading),
    speed: toNumber(req.body?.speed),
    source: String(req.body?.source || "mobile-app").trim(),
    timestamp: normalizeTimestamp(req.body?.timestamp),
    updated_at: new Date().toISOString(),
  };

  const db = getDb();
  await db.collection("DriverLocations").replaceOne(
    { driver_id: document.driver_id },
    document,
    { upsert: true }
  );

  return res.status(201).json({ location: document });
});

module.exports = router;
