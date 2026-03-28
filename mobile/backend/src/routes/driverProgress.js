const express = require("express");
const config = require("../config");
const { getDb } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const ORDER_COLLECTIONS = ["Orders", "Orders_S"];
const TERMINAL_STATUSES = ["completed", "cancelled"];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(first, second) {
  const earthRadius = 6371000;
  const deltaLat = toRadians(second.latitude - first.latitude);
  const deltaLng = toRadians(second.longitude - first.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(first.latitude)) *
      Math.cos(toRadians(second.latitude)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCoordinate(node) {
  if (!node || typeof node !== "object") return null;
  const latitude = Number(node?.location?.latitude ?? node?.latitude ?? node?.lat ?? node?.[0]);
  const longitude = Number(node?.location?.longitude ?? node?.longitude ?? node?.lng ?? node?.[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

async function fetchRouteById(routeId) {
  const upstreamResponse = await fetch(`${config.remoteFleetApiBaseUrl}/routes`, {
    headers: { Accept: "application/json" },
  });

  if (!upstreamResponse.ok) {
    throw new Error(`Rota servisi HTTP ${upstreamResponse.status}`);
  }

  const contentType = upstreamResponse.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await upstreamResponse.json()
    : await upstreamResponse.text();
  const routes = Array.isArray(body) ? body : body ? [body] : [];
  return routes.find((item) => String(item?.id || "").trim() === routeId) || null;
}

function findMatchedStop(route, coordinate, radiusMeters) {
  const deliveryPoints = Array.isArray(route?.delivery_points) ? route.delivery_points : [];
  let bestMatch = null;

  deliveryPoints.forEach((point, index) => {
    const pointCoordinate = getCoordinate(point);
    if (!pointCoordinate) return;

    const distanceMeters = haversineDistanceMeters(coordinate, pointCoordinate);
    if (distanceMeters > radiusMeters) return;

    if (!bestMatch || distanceMeters < bestMatch.distance_meters) {
      bestMatch = {
        delivery_point_id: String(point?.id || point?.customer_id || index),
        delivery_sequence: index + 1,
        address: String(point?.location?.address || point?.address || "").trim(),
        distance_meters: Math.round(distanceMeters * 10) / 10,
        coordinate: pointCoordinate,
      };
    }
  });

  return bestMatch;
}

async function updateOrdersForMatch(db, routeId, matchedStop, actorId) {
  const now = new Date();
  const logEntry = {
    action: "driver_location_match_completed",
    changed_at: now.toISOString(),
    changed_by: actorId,
    delivery_point_id: matchedStop.delivery_point_id,
  };

  let updatedCount = 0;
  const updatedOrders = [];

  for (const collectionName of ORDER_COLLECTIONS) {
    const collection = db.collection(collectionName);
    const candidates = await collection
      .find({
        customer_id: matchedStop.delivery_point_id,
        status: { $nin: TERMINAL_STATUSES },
      })
      .toArray();

    if (!candidates.length) continue;

    const targetIds = candidates
      .filter((item) => {
        const assignedRouteId = String(item?.assigned_route_id || "").trim();
        return !assignedRouteId || assignedRouteId === "default_route" || assignedRouteId === routeId;
      })
      .map((item) => item._id);

    if (!targetIds.length) continue;

    const result = await collection.updateMany(
      { _id: { $in: targetIds } },
      {
        $set: {
          status: "completed",
          updated_at: now,
          last_delivery_match_at: now,
          last_delivery_point_id: matchedStop.delivery_point_id,
        },
        $push: {
          change_log: logEntry,
        },
      }
    );

    updatedCount += result.modifiedCount || 0;
    updatedOrders.push(
      ...candidates
        .filter((item) => targetIds.some((targetId) => String(targetId) === String(item._id)))
        .map((item) => ({
          order_id: item.order_id,
          collection: collectionName,
        }))
    );
  }

  return { updatedCount, updatedOrders };
}

router.post("/evaluate", requireAuth, async (req, res) => {
  if (!["admin", "driver"].includes(req.user?.role)) {
    return res.status(403).json({ detail: "Bu endpoint sadece admin ve driver icin." });
  }

  const routeId = String(req.body?.route_id || "").trim();
  const latitude = toNumber(req.body?.latitude);
  const longitude = toNumber(req.body?.longitude);
  const radiusMeters = Math.max(5, Math.min(toNumber(req.body?.radius_meters) || 35, 250));

  if (!routeId) {
    return res.status(400).json({ detail: "route_id zorunlu." });
  }

  if (latitude == null || longitude == null) {
    return res.status(400).json({ detail: "latitude ve longitude zorunlu." });
  }

  let route;
  try {
    route = await fetchRouteById(routeId);
  } catch (error) {
    return res.status(502).json({ detail: `Rota servisine baglanilamadi: ${error.message}` });
  }

  if (!route) {
    return res.status(404).json({ detail: "Rota bulunamadi." });
  }

  const matchedStop = findMatchedStop(route, { latitude, longitude }, radiusMeters);
  if (!matchedStop) {
    return res.json({ matched: false, matched_stop: null, updated_orders: [] });
  }

  const db = getDb();
  const actorId = req.user.user_id || req.user.email || "driver";
  const { updatedCount, updatedOrders } = await updateOrdersForMatch(db, routeId, matchedStop, actorId);

  await db.collection("DriverStopEvents").updateOne(
    {
      driver_id: String(req.body?.driver_id || actorId),
      route_id: routeId,
      delivery_point_id: matchedStop.delivery_point_id,
    },
    {
      $set: {
        route_name: String(route?.name || "").trim(),
        matched_at: new Date().toISOString(),
        distance_meters: matchedStop.distance_meters,
        latitude,
        longitude,
      },
      $inc: {
        match_count: 1,
      },
    },
    { upsert: true }
  );

  return res.json({
    matched: true,
    matched_stop: matchedStop,
    updated_orders: updatedOrders,
    updated_count: updatedCount,
  });
});

module.exports = router;
