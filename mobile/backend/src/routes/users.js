const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sanitizeUser } = require("../utils/serializers");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ detail: "Bu endpoint sadece admin icin." });
  }

  const db = getDb();
  const users = await db.collection("Users").find({}).sort({ user_id: 1 }).toArray();
  return res.json({ users: users.map(sanitizeUser) });
});

module.exports = router;
