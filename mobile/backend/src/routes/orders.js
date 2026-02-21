const express = require("express");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { serializeOrder, toTimeString } = require("../utils/serializers");

const router = express.Router();
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ORDER_COLLECTION = "Orders";
const PACKAGE_ORDER_COLLECTION = "Orders_S";

const STATUS_MAP = {
  bekliyor: "waiting",
  hazirlaniyor: "processing",
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

function resolveCollections(collectionParam) {
  const normalized = normalizeText(collectionParam);
  if (normalized === "orders") return [ORDER_COLLECTION];
  if (normalized === "orders_s" || normalized === "package" || normalized === "packages") {
    return [PACKAGE_ORDER_COLLECTION];
  }
  return [ORDER_COLLECTION, PACKAGE_ORDER_COLLECTION];
}

function canAccessOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === "admin") return true;
  return String(user.user_id) === String(order.customer_id);
}

async function findOrderById(db, orderId) {
  const [order, packageOrder] = await Promise.all([
    db.collection(ORDER_COLLECTION).findOne({ order_id: orderId }),
    db.collection(PACKAGE_ORDER_COLLECTION).findOne({ order_id: orderId }),
  ]);

  if (order) return { order, collectionName: ORDER_COLLECTION };
  if (packageOrder) return { order: packageOrder, collectionName: PACKAGE_ORDER_COLLECTION };
  return null;
}

function validateLocation(address, latitude, longitude) {
  if (!address) return "location.address zorunlu.";
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "location.latitude/longitude gecerli sayi olmali.";
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return "location.latitude/longitude araligi gecersiz.";
  }
  return null;
}

function validateTimes(readyTime, dueDate) {
  if (!TIME_REGEX.test(readyTime) || !TIME_REGEX.test(dueDate)) {
    return "ready_time ve due_date HH:MM formatinda olmali.";
  }
  if (toMinutes(dueDate) < toMinutes(readyTime)) {
    return "due_date, ready_time saatinden once olamaz.";
  }
  return null;
}

router.get("/", requireAuth, async (req, res) => {
  const db = getDb();
  const {
    user_id: userIdQuery,
    status,
    start_date: startDate,
    end_date: endDate,
    collection: collectionParam,
  } = req.query;

  const query = {};
  if (req.user.role === "admin") {
    if (userIdQuery) {
      query.customer_id = String(userIdQuery);
    }
  } else {
    query.customer_id = req.user.user_id;
    if (userIdQuery && String(userIdQuery) !== String(req.user.user_id)) {
      return res.status(403).json({ detail: "Sadece kendi siparislerinizi gorebilirsiniz." });
    }
  }

  if (status) {
    const normalized = String(status).toLowerCase();
    query.status = STATUS_MAP[normalized] || normalized;
  }

  const collections = resolveCollections(collectionParam);
  const [orders, packageOrders] = await Promise.all([
    collections.includes(ORDER_COLLECTION)
      ? db.collection(ORDER_COLLECTION).find(query).toArray()
      : Promise.resolve([]),
    collections.includes(PACKAGE_ORDER_COLLECTION)
      ? db.collection(PACKAGE_ORDER_COLLECTION).find(query).toArray()
      : Promise.resolve([]),
  ]);

  const fromDate = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
  const toDate = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;

  const merged = [
    ...orders.map((item) => ({ ...item, source_collection: ORDER_COLLECTION })),
    ...packageOrders.map((item) => ({ ...item, source_collection: PACKAGE_ORDER_COLLECTION })),
  ].filter((item) => {
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
  if (req.user.role === "admin") {
    return res.status(403).json({ detail: "Admin kullanici yeni siparis olusturamaz." });
  }

  const db = getDb();
  const input = req.body && req.body.order;
  if (!input || typeof input !== "object") {
    return res.status(400).json({ detail: "order payload zorunlu." });
  }

  const orderId = String(input?.order_id || "").trim();
  const taskId = String(input?.task_id || "").trim();
  const productId = String(input?.request?.product_id || "SU_0").trim();
  const productName = String(input?.request?.product_name || "").trim();
  const quantity = Number(input?.request?.quantity);
  const totalPrice = Number(input?.total_price);
  const address = String(input?.location?.address || "").trim();
  const readyTime = String(input?.ready_time || "").trim();
  const dueDate = String(input?.due_date || "").trim();
  const latitude = Number(input?.location?.latitude);
  const longitude = Number(input?.location?.longitude);
  const locationError = validateLocation(address, latitude, longitude);
  const timeError = validateTimes(readyTime, dueDate);

  if (!orderId) return res.status(400).json({ detail: "order_id zorunlu." });
  if (!taskId) return res.status(400).json({ detail: "task_id zorunlu." });
  if (!productName) return res.status(400).json({ detail: "request.product_name zorunlu." });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ detail: "request.quantity pozitif sayi olmali." });
  }
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    return res.status(400).json({ detail: "total_price pozitif sayi olmali." });
  }
  if (locationError) return res.status(400).json({ detail: locationError });
  if (timeError) return res.status(400).json({ detail: timeError });

  const isPackage = isPackageProduct(productId, productName);
  const now = new Date();

  const payload = {
    ...input,
    customer_id: req.user.user_id,
    order_id: orderId,
    task_id: taskId,
    location: {
      address,
      latitude,
      longitude,
    },
    ready_time: toTimeString(readyTime),
    due_date: toTimeString(dueDate),
    order_date: String(input?.order_date || dateOnly(now)),
    request: {
      product_id: productId,
      product_name: productName,
      notes: String(input?.request?.notes || ""),
      quantity,
      demand: Number(input?.request?.demand) > 0 ? Number(input.request.demand) : (isPackage ? quantity : quantity * 19),
    },
    status: normalizeStatus(input?.status),
    total_price: totalPrice,
    service_time: Number(input?.service_time) > 0 ? Number(input.service_time) : 120,
    priority_level: Number.isFinite(Number(input?.priority_level)) ? Number(input.priority_level) : 0,
    assigned_vehicle: String(input?.assigned_vehicle || "default_vehicle"),
    assigned_route_id: String(input?.assigned_route_id || "default_route"),
    change_log: Array.isArray(input?.change_log) ? input.change_log : [],
    created_at: now,
    updated_at: now,
  };

  if (!DATE_ONLY_REGEX.test(payload.order_date)) {
    return res.status(400).json({ detail: "order_date YYYY-MM-DD formatinda olmali." });
  }

  const targetCollection = isPackage ? PACKAGE_ORDER_COLLECTION : ORDER_COLLECTION;
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

router.put("/:orderId", requireAuth, async (req, res) => {
  const db = getDb();
  const orderId = String(req.params.orderId || "").trim();
  const updates = req.body?.updates;

  if (!orderId) return res.status(400).json({ detail: "orderId zorunlu." });
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ detail: "updates payload zorunlu." });
  }

  const found = await findOrderById(db, orderId);
  if (!found) return res.status(404).json({ detail: "Siparis bulunamadi." });

  const { order: existing, collectionName } = found;
  if (!canAccessOrder(req.user, existing)) {
    return res.status(403).json({ detail: "Bu siparis icin yetkiniz yok." });
  }

  const address = String(updates?.location?.address ?? updates?.address ?? existing?.location?.address ?? "").trim();
  const latitude = Number(updates?.location?.latitude ?? existing?.location?.latitude);
  const longitude = Number(updates?.location?.longitude ?? existing?.location?.longitude);
  const readyTime = String(updates?.ready_time ?? existing?.ready_time ?? "").trim();
  const dueDate = String(updates?.due_date ?? existing?.due_date ?? "").trim();
  const productId = String(existing?.request?.product_id || "SU_0");
  const productName = String(existing?.request?.product_name || "");
  const quantity = Number(updates?.request?.quantity ?? updates?.quantity ?? existing?.request?.quantity);
  const notes = String(updates?.request?.notes ?? updates?.notes ?? existing?.request?.notes ?? "");
  const status = normalizeStatus(updates?.status ?? existing?.status);
  const serviceTime = Number(updates?.service_time ?? existing?.service_time);
  const priorityLevel = Number(updates?.priority_level ?? existing?.priority_level);
  const assignedVehicle = String(updates?.assigned_vehicle ?? existing?.assigned_vehicle ?? "default_vehicle");
  const assignedRouteId = String(updates?.assigned_route_id ?? existing?.assigned_route_id ?? "default_route");
  const orderDateRaw = String(updates?.order_date ?? existing?.order_date ?? dateOnly(new Date()));

  const locationError = validateLocation(address, latitude, longitude);
  const timeError = validateTimes(readyTime, dueDate);
  if (locationError) return res.status(400).json({ detail: locationError });
  if (timeError) return res.status(400).json({ detail: timeError });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ detail: "request.quantity pozitif sayi olmali." });
  }
  if (!DATE_ONLY_REGEX.test(orderDateRaw)) {
    return res.status(400).json({ detail: "order_date YYYY-MM-DD formatinda olmali." });
  }

  const isPackage = collectionName === PACKAGE_ORDER_COLLECTION || isPackageProduct(productId, productName);
  const oldQuantity = Number(existing?.request?.quantity);
  const oldDemand = Number(existing?.request?.demand);
  const oldTotal = Number(existing?.total_price);
  const demandUnit = oldQuantity > 0 && oldDemand > 0 ? oldDemand / oldQuantity : (isPackage ? 1 : 19);
  const nextDemand = Number(updates?.request?.demand ?? updates?.demand);
  const demand = Number.isFinite(nextDemand) && nextDemand > 0 ? nextDemand : quantity * demandUnit;

  const unitPrice = oldQuantity > 0 && oldTotal > 0 ? oldTotal / oldQuantity : null;
  const requestedTotal = Number(updates?.total_price);
  const totalPrice = Number.isFinite(requestedTotal) && requestedTotal > 0
    ? requestedTotal
    : (unitPrice && unitPrice > 0 ? quantity * unitPrice : oldTotal);

  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    return res.status(400).json({ detail: "total_price pozitif sayi olmali." });
  }

  const now = new Date();
  const setPayload = {
    location: { address, latitude, longitude },
    ready_time: toTimeString(readyTime),
    due_date: toTimeString(dueDate),
    order_date: orderDateRaw,
    request: {
      ...existing.request,
      product_id: productId,
      product_name: productName,
      notes,
      quantity,
      demand,
    },
    status,
    total_price: totalPrice,
    service_time: Number.isFinite(serviceTime) && serviceTime > 0 ? serviceTime : 120,
    priority_level: Number.isFinite(priorityLevel) ? priorityLevel : 0,
    assigned_vehicle: assignedVehicle,
    assigned_route_id: assignedRouteId,
    updated_at: now,
  };

  if (isPackage) {
    const pickupWeight = Number(updates?.pickup_weight ?? existing?.pickup_weight ?? 0);
    const requestPickupWeight = Number(updates?.request?.pickup_weight);
    setPayload.pickup_weight = Number.isFinite(pickupWeight) ? pickupWeight : 0;
    setPayload.customer_type = String(updates?.customer_type ?? existing?.customer_type ?? "Delivery");
    setPayload.request.pickup_weight = Number.isFinite(requestPickupWeight)
      ? requestPickupWeight
      : Number(existing?.request?.pickup_weight ?? setPayload.pickup_weight);
  }

  const previousLog = Array.isArray(existing?.change_log) ? existing.change_log : [];
  setPayload.change_log = [
    ...previousLog,
    {
      action: "update",
      changed_at: now.toISOString(),
      changed_by: req.user.user_id || req.user.email || "mobile",
    },
  ];

  const result = await db.collection(collectionName).updateOne({ _id: existing._id }, { $set: setPayload });
  if (!result.acknowledged) {
    return res.status(400).json({ detail: "Siparis guncellenemedi." });
  }

  const updated = await db.collection(collectionName).findOne({ _id: existing._id });
  return res.json({ success: true, order: serializeOrder(updated) });
});

router.delete("/:orderId", requireAuth, async (req, res) => {
  const db = getDb();
  const orderId = String(req.params.orderId || "").trim();
  if (!orderId) return res.status(400).json({ detail: "orderId zorunlu." });

  const found = await findOrderById(db, orderId);
  if (!found) return res.status(404).json({ detail: "Siparis bulunamadi." });
  if (!canAccessOrder(req.user, found.order)) {
    return res.status(403).json({ detail: "Bu siparisi silemezsiniz." });
  }

  const result = await db.collection(found.collectionName).deleteOne({ _id: found.order._id });
  if (!result.acknowledged || result.deletedCount === 0) {
    return res.status(400).json({ detail: "Siparis silinemedi." });
  }

  return res.json({ success: true });
});

module.exports = router;
