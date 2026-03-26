const express = require("express");
const config = require("../config");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  if (!["admin", "driver"].includes(req.user?.role)) {
    return res.status(403).json({ detail: "Bu endpoint sadece admin ve driver icin." });
  }

  const upstreamUrl = `${config.remoteFleetApiBaseUrl}/routes`;

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
    });

    const contentType = upstreamResponse.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await upstreamResponse.json()
      : await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      const detail =
        typeof body === "string" && body.trim() ? body : body?.detail || "Rota servisi hata dondu.";
      return res.status(upstreamResponse.status).json({ detail });
    }

    const routes = Array.isArray(body) ? body : body ? [body] : [];
    return res.json({ routes });
  } catch (error) {
    return res.status(502).json({
      detail: `Uzak rota servisine baglanilamadi: ${error?.message || "bilinmeyen hata"}`,
    });
  }
});

module.exports = router;
