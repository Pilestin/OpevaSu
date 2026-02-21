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

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isPackageProduct(productId, productName) {
  const id = normalizeText(productId);
  const name = normalizeText(productName);
  if (!id && !name) return false;

  const exactSet = new Set(["packet", "paket", "package"]);
  if (exactSet.has(id) || exactSet.has(name)) return true;

  return (
    id.includes("packet") ||
    id.includes("paket") ||
    id.includes("package") ||
    name.includes("packet") ||
    name.includes("paket") ||
    name.includes("package")
  );
}

function parseDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const [orders, packageOrders] = await Promise.all([
    db.collection("Orders").find(query).toArray(),
    db.collection("Order_S").find(query).toArray(),
  ]);

  const fromDate = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
  const toDate = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;

  const merged = [...orders, ...packageOrders].filter((item) => {
    if (!fromDate && !toDate) return true;

    const candidate = parseDateInput(item.created_at) || parseDateInput(item.order_date);
    if (!candidate) return false;
    if (fromDate && candidate < fromDate) return false;
    if (toDate && candidate > toDate) return false;
    return true;
  });

  merged.sort((left, right) => {
    const leftDate = parseDateInput(left.created_at) || parseDateInput(left.order_date) || new Date(0);
    const rightDate = parseDateInput(right.created_at) || parseDateInput(right.order_date) || new Date(0);
    return rightDate.getTime() - leftDate.getTime();
  });

  return res.json({ orders: merged.map(serializeOrder) });
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
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ detail: "location.latitude/longitude araligi gecersiz." });
  }

  const productId = String(input?.request?.product_id || "SU_0");
  const isPackage = isPackageProduct(productId, productName);

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
      product_id: productId,
      product_name: productName,
      notes: String(input?.request?.notes || ""),
      quantity,
      demand: Number(input?.request?.demand) > 0
        ? Number(input.request.demand)
        : (isPackage ? quantity : quantity * 19),
    },
    status: normalizeStatus(input?.status),
    total_price: totalPrice,
    service_time: Number(input?.service_time) > 0 ? Number(input.service_time) : 120,
    priority_level: Number.isFinite(Number(input?.priority_level)) ? Number(input.priority_level) : 0,
    assigned_vehicle: String(input?.assigned_vehicle || "default_vehicle"),
    assigned_route_id: String(input?.assigned_route_id || "default_route"),
    change_log: Array.isArray(input?.change_log) ? input.change_log : [],
  };

  const now = new Date();
  payload.created_at = now;
  payload.updated_at = now;
  payload.order_date = String(input?.order_date || dateOnly(now));
  payload.ready_time = toTimeString(payload.ready_time);
  payload.due_date = toTimeString(payload.due_date);

  const targetCollection = isPackage ? "Order_S" : "Orders";
  if (isPackage) {
    const pickupWeight = Number(input?.pickup_weight);
    payload.pickup_weight = Number.isFinite(pickupWeight) ? pickupWeight : 0;
    payload.customer_type = String(input?.customer_type || "Delivery");
    payload.request.pickup_weight = Number.isFinite(Number(input?.request?.pickup_weight))
      ? Number(input.request.pickup_weight)
      : payload.pickup_weight;
  }

  const result = await db.collection(targetCollection).insertOne(payload);
  if (!result.acknowledged) {
    return res.status(400).json({ detail: "Siparis olusturulamadi." });
  }

  return res.status(201).json({ success: true });
});

module.exports = router;
