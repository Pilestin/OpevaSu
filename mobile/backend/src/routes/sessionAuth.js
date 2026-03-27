const express = require("express");
const crypto = require("crypto");
const { getDb } = require("../db");
const { verifyPassword } = require("../utils/password");
const { sanitizeUser } = require("../utils/serializers");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

function buildSessionUser(user) {
  return sanitizeUser(user);
}

router.post("/login", async (req, res) => {
  const rawUserIdOrEmail = req.body?.user_id_or_email;
  const userIdOrEmail = typeof rawUserIdOrEmail === "string" ? rawUserIdOrEmail.trim() : "";
  const password = req.body?.password;
  if (!userIdOrEmail) {
    return res.status(400).json({ detail: "user_id_or_email zorunlu." });
  }

  const db = getDb();
  const user = await db.collection("Users").findOne({
    $or: [
      { user_id: userIdOrEmail },
      { email: userIdOrEmail },
      { email: userIdOrEmail.toLowerCase() },
    ],
  });

  const storedPassword = user?.password || user?.password_hash;
  if (!user) {
    return res.status(401).json({ detail: "Gecersiz kullanici bilgileri" });
  }

  if (password && storedPassword && !verifyPassword(password, storedPassword)) {
    return res.status(401).json({ detail: "Gecersiz kullanici bilgileri" });
  }

  const safeUser = buildSessionUser(user);
  const subject = safeUser.user_id || safeUser.email;
  if (!subject) {
    return res.status(500).json({ detail: "Kullanici kaydi hatali: user_id/email yok." });
  }

  const now = new Date();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  await db.collection("AuthSessions").insertOne({
    session_id: sessionId,
    user_id_or_email: subject,
    created_at: now,
    updated_at: now,
    expires_at: expiresAt,
  });

  return res.json({
    sessionId,
    user: safeUser,
  });
});

router.get("/me/:sessionId", async (req, res) => {
  const sessionId = String(req.params.sessionId || "").trim();
  if (!sessionId) {
    return res.status(400).json({ detail: "sessionId zorunlu." });
  }

  const db = getDb();
  const session = await db.collection("AuthSessions").findOne({ session_id: sessionId });
  if (!session) {
    return res.status(404).json({ detail: "Session bulunamadi." });
  }

  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db.collection("AuthSessions").deleteOne({ _id: session._id });
    return res.status(401).json({ detail: "Session suresi dolmus." });
  }

  const userLookup = String(session.user_id_or_email || "").trim();
  const user = await db.collection("Users").findOne({
    $or: [{ user_id: userLookup }, { email: userLookup }, { email: userLookup.toLowerCase() }],
  });
  if (!user) {
    return res.status(404).json({ detail: "Kullanici bulunamadi." });
  }

  return res.json({
    sessionId,
    user: buildSessionUser(user),
  });
});

router.get("/users", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ detail: "Bu endpoint sadece admin icin." });
  }

  const db = getDb();
  const users = await db.collection("Users").find({}).sort({ user_id: 1 }).toArray();
  return res.json({
    users: users.map((user) => {
      const safeUser = buildSessionUser(user);
      return {
        user_id: safeUser.user_id || "",
        full_name: safeUser.full_name || "",
        email: safeUser.email || "",
        role_authority_level: safeUser.role_authority_level || "",
      };
    }),
  });
});

router.post("/logout", requireAuth, async (req, res) => {
  if (req.authMode === "session" && req.sessionId) {
    const db = getDb();
    await db.collection("AuthSessions").deleteOne({ session_id: req.sessionId });
  }
  return res.json({ success: true });
});

module.exports = router;
