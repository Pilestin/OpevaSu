const dotenv = require("dotenv");

dotenv.config();

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const config = {
  port: Number(process.env.PORT || 3001),
  mongoUri: process.env.MONGODB_URI || process.env.MONGO_URI,
  mongoDbName: process.env.MONGO_DB_NAME || "RouteManagementDB",
  jwtSecret: process.env.JWT_SECRET || "change-me-mobile-backend-min-32-chars",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "60m",
  allowPasswordlessLogin: parseBoolean(process.env.ALLOW_PASSWORDLESS_LOGIN, true),
};

module.exports = config;
