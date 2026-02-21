const jwt = require("jsonwebtoken");
const config = require("../config");
const { getDb } = require("../db");
const { sanitizeUser } = require("../utils/serializers");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ detail: "Token gerekli." });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const userId = payload.sub;
    if (!userId) {
      return res.status(401).json({ detail: "Gecersiz token." });
    }

    const db = getDb();
    const user = await db.collection("Users").findOne({
      $or: [{ user_id: userId }, { email: userId }],
    });
    if (!user) {
      return res.status(401).json({ detail: "Token kullanicisi bulunamadi." });
    }

    req.user = sanitizeUser(user);
    req.jwtPayload = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ detail: "Gecersiz veya suresi dolmus token." });
  }
}

module.exports = {
  requireAuth,
};

