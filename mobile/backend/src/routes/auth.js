const express = require("express");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { getDb } = require("../db");
const { verifyPassword } = require("../utils/password");
const { sanitizeUser } = require("../utils/serializers");

const router = express.Router();

router.post("/login", async (req, res) => {
  const rawUserIdOrEmail = req.body?.user_id_or_email;
  const userIdOrEmail = typeof rawUserIdOrEmail === "string" ? rawUserIdOrEmail.trim() : "";
  const password = req.body?.password;
  if (!userIdOrEmail) {
    return res.status(400).json({ detail: "user_id_or_email zorunlu." });
  }

  if (!config.allowPasswordlessLogin && !password) {
    return res.status(400).json({ detail: "password zorunlu." });
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

  if (!config.allowPasswordlessLogin && !verifyPassword(password, storedPassword)) {
    return res.status(401).json({ detail: "Gecersiz kullanici bilgileri" });
  }

  const safeUser = sanitizeUser(user);
  const subject = safeUser.user_id || safeUser.email;
  if (!subject) {
    return res.status(500).json({ detail: "Kullanici kaydi hatali: user_id/email yok." });
  }

  const accessToken = jwt.sign(
    { sub: subject, role: safeUser.role || "user" },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return res.json({
    access_token: accessToken,
    token_type: "bearer",
    user: safeUser,
  });
});

module.exports = router;
