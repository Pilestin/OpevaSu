const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { serializeOrder, toTimeString } = require("../utils/serializers");

const router = express.Router();
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const STATUS_MAP = {
  bekliyor: "waiting",
  hazirlaniyor: "processing",
  "hazırlanıyor": "processing",
  yolda: "shipping",
  "teslim edildi": "completed",
  "iptal edildi": "cancelled",
};

function toMinutes(value) {
  const [hh, mm] = String(value).split(":").map(Number);
  return (hh * 60) + mm;
}

function normalizeStatus(value) {
  if (!value) return "waiting";
  const normalized = String(value).toLowerCase();
  return STATUS_MAP[normalized] || normalized;
}

router.get("/", requireAuth, async (req, res) => {
  const db = getDb();
  const { user_id: userIdQuery, status, start_date: startDate, end_date: endDate } = req.query;

  let targetUserId = req.user.user_id;
  if (userIdQuery) {
    if (req.user.role === "admin") {
      targetUserId = String(userIdQuery);
    } else if (String(userIdQuery) !== String(req.user.user_id)) {
      return res.status(403).json({ detail: "Sadece kendi siparislerinizi gorebilirsiniz." });
    }
  }

  const query = { customer_id: targetUserId };
  if (status) {
    const normalized = String(status).toLowerCase();
    query.status = STATUS_MAP[normalized] || normalized;
  }

  if (startDate || endDate) {
    query.order_date = {};
    if (startDate) query.order_date.$gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) query.order_date.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  const orders = await db.collection("Orders").find(query).sort({ created_at: -1 }).toArray();
  return res.json({ orders: orders.map(serializeOrder) });
});

router.post("/", requireAuth, async (req, res) => {
  const db = getDb();
  const input = req.body && req.body.order;
  if (!input || typeof input !== "object") {
    return res.status(400).json({ detail: "order payload zorunlu." });
  }

  const productName = String(input?.request?.product_name || "").trim();
  const quantity = Number(input?.request?.quantity);
  const totalPrice = Number(input?.total_price);
  const address = String(input?.location?.address || "").trim();
  const readyTime = String(input?.ready_time || "").trim();
  const dueDate = String(input?.due_date || "").trim();
  const latitude = Number(input?.location?.latitude);
  const longitude = Number(input?.location?.longitude);

  if (!productName) {
    return res.status(400).json({ detail: "request.product_name zorunlu." });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ detail: "request.quantity pozitif sayi olmali." });
  }
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    return res.status(400).json({ detail: "total_price pozitif sayi olmali." });
  }
  if (!address) {
    return res.status(400).json({ detail: "location.address zorunlu." });
  }
  if (!TIME_REGEX.test(readyTime) || !TIME_REGEX.test(dueDate)) {
    return res.status(400).json({ detail: "ready_time ve due_date HH:MM formatinda olmali." });
  }
  if (toMinutes(dueDate) < toMinutes(readyTime)) {
    return res.status(400).json({ detail: "due_date, ready_time saatinden once olamaz." });
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ detail: "location.latitude/longitude gecerli sayi olmali." });
  }

  const payload = {
    ...input,
    customer_id: req.user.role === "admin" ? String(input.customer_id || req.user.user_id) : req.user.user_id,
    location: {
      address,
      latitude,
      longitude,
    },
    ready_time: readyTime,
    due_date: dueDate,
    request: {
      product_id: String(input?.request?.product_id || "SU_0"),
      product_name: productName,
      notes: String(input?.request?.notes || ""),
      quantity,
      demand: Number(input?.request?.demand) > 0 ? Number(input.request.demand) : quantity * 19,
    },
    status: normalizeStatus(input?.status),
    total_price: totalPrice,
  };

  const now = new Date();
  payload.created_at = now;
  payload.updated_at = now;
  payload.order_date = now;
  payload.ready_time = toTimeString(payload.ready_time);
  payload.due_date = toTimeString(payload.due_date);

  const result = await db.collection("Orders").insertOne(payload);
  if (!result.acknowledged) {
    return res.status(400).json({ detail: "Siparis olusturulamadi." });
  }

  return res.status(201).json({ success: true });
});

module.exports = router;
