const crypto = require("crypto");
const bcrypt = require("bcryptjs");

function safeCompare(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseWerkzeugHash(hashValue) {
  const parts = String(hashValue).split("$");
  if (parts.length !== 3) return null;
  return {
    method: parts[0],
    salt: parts[1],
    hash: parts[2],
  };
}

function decodeHashLength(storedHash) {
  if (/^[a-f0-9]+$/i.test(storedHash) && storedHash.length % 2 === 0) {
    return { length: storedHash.length / 2, format: "hex" };
  }
  const raw = Buffer.from(storedHash, "base64");
  if (raw.length > 0) {
    return { length: raw.length, format: "base64" };
  }
  return { length: 32, format: "base64" };
}

function verifyWerkzeugPbkdf2(password, method, salt, storedHash) {
  const [, digest = "sha256", iterationsRaw = "600000"] = method.split(":");
  const iterations = Number(iterationsRaw);
  const { length, format } = decodeHashLength(storedHash);
  const derived = crypto.pbkdf2Sync(password, salt, iterations, length, digest);
  const candidate = format === "hex" ? derived.toString("hex") : derived.toString("base64");
  return safeCompare(candidate.replace(/=+$/, ""), String(storedHash).replace(/=+$/, ""));
}

function verifyWerkzeugScrypt(password, method, salt, storedHash) {
  const [, nRaw = "32768", rRaw = "8", pRaw = "1"] = method.split(":");
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  const { length, format } = decodeHashLength(storedHash);
  const derived = crypto.scryptSync(password, salt, length, { N, r, p });
  const candidate = format === "hex" ? derived.toString("hex") : derived.toString("base64");
  return safeCompare(candidate.replace(/=+$/, ""), String(storedHash).replace(/=+$/, ""));
}

function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword) return false;

  const value = String(storedPassword);

  if (/^[a-f0-9]{64}$/i.test(value)) {
    const candidate = crypto.createHash("sha256").update(password).digest("hex");
    return safeCompare(candidate.toLowerCase(), value.toLowerCase());
  }

  if (value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$")) {
    return bcrypt.compareSync(password, value);
  }

  if (value.startsWith("pbkdf2:") || value.startsWith("scrypt:")) {
    const parsed = parseWerkzeugHash(value);
    if (!parsed) return false;
    if (parsed.method.startsWith("pbkdf2:")) {
      return verifyWerkzeugPbkdf2(password, parsed.method, parsed.salt, parsed.hash);
    }
    if (parsed.method.startsWith("scrypt:")) {
      return verifyWerkzeugScrypt(password, parsed.method, parsed.salt, parsed.hash);
    }
  }

  return safeCompare(password, value);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

module.exports = {
  verifyPassword,
  hashPassword,
};
