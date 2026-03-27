const jwt = require("jsonwebtoken");
const config = require("../config");
const { getDb } = require("../db");
const { findDriverUserByUserName } = require("../driverDb");
const { sanitizeUser } = require("../utils/serializers");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const db = getDb();
  if (header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (!token) {
      return res.status(401).json({ detail: "Token gerekli." });
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const userId = payload.sub;
      if (!userId) {
        return res.status(401).json({ detail: "Gecersiz token." });
      }

      const user = await db.collection("Users").findOne({
        $or: [{ user_id: userId }, { email: userId }, { email: String(userId).toLowerCase() }],
      });
      if (!user) {
        return res.status(401).json({ detail: "Token kullanicisi bulunamadi." });
      }

      req.user = sanitizeUser(user);
      req.authMode = "bearer";
      req.jwtPayload = payload;
      return next();
    } catch (error) {
      return res.status(401).json({ detail: "Gecersiz veya suresi dolmus token." });
    }
  }

  if (header.startsWith("Session ")) {
    const sessionId = header.slice(8).trim();
    if (!sessionId) {
      return res.status(401).json({ detail: "Session gerekli." });
    }

    const session = await db.collection("AuthSessions").findOne({ session_id: sessionId });
    if (!session) {
      return res.status(401).json({ detail: "Gecersiz session." });
    }

    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      await db.collection("AuthSessions").deleteOne({ _id: session._id });
      return res.status(401).json({ detail: "Session suresi dolmus." });
    }

    const user = await findDriverUserByUserName(session.user_name);
    if (!user) {
      return res.status(401).json({ detail: "Session kullanicisi bulunamadi." });
    }

    req.user = sanitizeUser(user);
    req.authMode = "session";
    req.sessionId = sessionId;
    req.session = session;
    return next();
  }

  return res.status(401).json({ detail: "Authorization gerekli." });
}

module.exports = {
  requireAuth,
};

