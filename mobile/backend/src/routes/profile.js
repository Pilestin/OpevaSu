const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { hashPassword } = require("../utils/password");
const { sanitizeUser } = require("../utils/serializers");

const router = express.Router();

router.get("/:userId", requireAuth, async (req, res) => {
  const db = getDb();
  const { userId } = req.params;

  if (req.user.role !== "admin" && userId !== req.user.user_id) {
    return res.status(403).json({ detail: "Sadece kendi profilinizi gorebilirsiniz." });
  }

  const user = await db.collection("Users").findOne({ user_id: userId });
  if (!user) {
    return res.status(404).json({ detail: "Kullanici bulunamadi." });
  }

  return res.json({ user: sanitizeUser(user) });
});

router.put("/:userId", requireAuth, async (req, res) => {
  const db = getDb();
  const { userId } = req.params;
  const updates = req.body && req.body.updates && typeof req.body.updates === "object"
    ? { ...req.body.updates }
    : null;

  if (!updates) {
    return res.status(400).json({ detail: "updates payload zorunlu." });
  }

  if (req.user.role !== "admin" && userId !== req.user.user_id) {
    return res.status(403).json({ detail: "Sadece kendi profilinizi guncelleyebilirsiniz." });
  }

  delete updates._id;
  delete updates.user_id;
  if (req.user.role !== "admin") {
    delete updates.role;
  }

  if ("password" in updates) {
    if (updates.password) {
      updates.password_hash = hashPassword(updates.password);
    }
    delete updates.password;
  }

  updates.updated_at = new Date();

  const result = await db.collection("Users").updateOne({ user_id: userId }, { $set: updates });
  if (result.matchedCount === 0) {
    return res.status(404).json({ detail: "Kullanici bulunamadi." });
  }

  const user = await db.collection("Users").findOne({ user_id: userId });
  return res.json({ user: sanitizeUser(user) });
});

module.exports = router;
