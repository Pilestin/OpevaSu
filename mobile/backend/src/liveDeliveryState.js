const MAX_PATH_POINTS = 250;

function buildSessionId(driverId, routeId) {
  return `${String(driverId || "driver").trim()}::${String(routeId || "route").trim()}`;
}

async function ensureDeliverySession(db, payload) {
  const driverId = String(payload?.driver_id || "").trim();
  const routeId = String(payload?.route_id || "").trim();
  if (!driverId || !routeId) return;

  const now = new Date().toISOString();
  await db.collection("DeliverySessions").updateOne(
    { session_id: buildSessionId(driverId, routeId) },
    {
      $set: {
        driver_id: driverId,
        driver_name: String(payload?.driver_name || "").trim(),
        route_id: routeId,
        route_name: String(payload?.route_name || "").trim(),
        status: String(payload?.status || "active").trim(),
        updated_at: now,
      },
      $setOnInsert: {
        session_id: buildSessionId(driverId, routeId),
        started_at: now,
        completed_delivery_points: [],
      },
    },
    { upsert: true }
  );
}

async function updateSessionLocation(db, payload) {
  const driverId = String(payload?.driver_id || "").trim();
  const routeId = String(payload?.route_id || "").trim();
  if (!driverId || !routeId) return;

  const timestamp = String(payload?.timestamp || new Date().toISOString()).trim();
  const location = {
    latitude: Number(payload?.latitude),
    longitude: Number(payload?.longitude),
    accuracy: Number(payload?.accuracy),
    heading: Number(payload?.heading),
    speed: Number(payload?.speed),
    timestamp,
  };

  await ensureDeliverySession(db, payload);

  await db.collection("DeliverySessions").updateOne(
    { session_id: buildSessionId(driverId, routeId) },
    {
      $set: {
        last_location: location,
        updated_at: new Date().toISOString(),
        status: "active",
      },
    }
  );

  await db.collection("DriverLocationHistory").insertOne({
    driver_id: driverId,
    driver_name: String(payload?.driver_name || "").trim(),
    route_id: routeId,
    route_name: String(payload?.route_name || "").trim(),
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    heading: location.heading,
    speed: location.speed,
    timestamp,
    source: String(payload?.source || "mobile-app").trim(),
  });
}

async function appendCompletedPoint(db, payload) {
  const driverId = String(payload?.driver_id || "").trim();
  const routeId = String(payload?.route_id || "").trim();
  const deliveryPointId = String(payload?.delivery_point_id || "").trim();
  if (!driverId || !routeId || !deliveryPointId) return;

  await ensureDeliverySession(db, payload);
  await db.collection("DeliverySessions").updateOne(
    { session_id: buildSessionId(driverId, routeId) },
    {
      $addToSet: {
        completed_delivery_points: deliveryPointId,
      },
      $set: {
        last_delivery_event: {
          delivery_point_id: deliveryPointId,
          updated_count: Number(payload?.updated_count || 0),
          completion_source: String(payload?.completion_source || "unknown").trim(),
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
    }
  );
}

async function endDeliverySession(db, payload) {
  const driverId = String(payload?.driver_id || "").trim();
  const routeId = String(payload?.route_id || "").trim();
  if (!driverId || !routeId) return;

  await db.collection("DeliverySessions").updateOne(
    { session_id: buildSessionId(driverId, routeId) },
    {
      $set: {
        status: "ended",
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }
  );
}

async function getLiveSnapshot(db, filters = {}) {
  const query = {};
  if (filters.driver_id) query.driver_id = String(filters.driver_id).trim();
  if (filters.route_id) query.route_id = String(filters.route_id).trim();
  if (filters.status) query.status = String(filters.status).trim();

  const sessions = await db.collection("DeliverySessions").find(query).sort({ updated_at: -1 }).toArray();

  const enrichedSessions = await Promise.all(
    sessions.map(async (session) => {
      const [path, stopEvents] = await Promise.all([
        db
          .collection("DriverLocationHistory")
          .find({ driver_id: session.driver_id, route_id: session.route_id })
          .sort({ timestamp: -1 })
          .limit(MAX_PATH_POINTS)
          .toArray(),
        db
          .collection("DriverStopEvents")
          .find({ driver_id: session.driver_id, route_id: session.route_id })
          .sort({ matched_at: -1 })
          .toArray(),
      ]);

      return {
        ...session,
        _id: String(session._id),
        path: path.reverse().map((item) => ({
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          heading: Number(item.heading),
          speed: Number(item.speed),
          timestamp: item.timestamp,
        })),
        stop_events: stopEvents.map((item) => ({
          ...item,
          _id: String(item._id),
        })),
      };
    })
  );

  return {
    sessions: enrichedSessions,
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  ensureDeliverySession,
  updateSessionLocation,
  appendCompletedPoint,
  endDeliverySession,
  getLiveSnapshot,
  buildSessionId,
};
