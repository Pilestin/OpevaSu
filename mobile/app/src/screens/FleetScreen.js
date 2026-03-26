import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, ActivityIndicator, Dimensions, ScrollView } from "react-native";
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { driverTrackingApi, routesApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

const VEHICLES_API_URL = "http://157.230.17.89:3001/api/vehicles/locations/fiware";
const POLLING_INTERVAL = 5000;
const TRACKABLE_VEHICLES = ["musoshi001", "musoshi004", "musoshi006"];

function getCoordinate(node) {
  if (!node || typeof node !== "object") return null;
  const latitude = Number(node?.location?.latitude ?? node?.latitude ?? node?.lat ?? node?.[0]);
  const longitude = Number(node?.location?.longitude ?? node?.longitude ?? node?.lng ?? node?.[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function getWaypointCoordinates(node) {
  if (!Array.isArray(node?.waypoints)) return [];
  return node.waypoints.map(getCoordinate).filter(Boolean);
}

function parseCoordinate(lat, lng) {
  let parsedLat = Number(lat);
  let parsedLng = Number(lng);
  if (parsedLat < 35 && parsedLng > 35) {
    const temp = parsedLat;
    parsedLat = parsedLng;
    parsedLng = temp;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function parseCompletedPoints(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed.map((item) => (typeof item === "object" ? String(item.order_id) : String(item)));
    } catch (error) {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  return [];
}

function buildRouteSegments(route, allCompletedPoints) {
  const segments = [];
  const deliveryPoints = Array.isArray(route?.delivery_points) ? route.delivery_points : [];

  const appendSegment = (coordinates, nextPointId) => {
    if (!coordinates.length) return;
    segments.push({
      coords: coordinates,
      isTraveled: nextPointId ? allCompletedPoints.has(String(nextPointId)) : false,
    });
  };

  appendSegment(
    getWaypointCoordinates(route?.start_point),
    deliveryPoints[0]?.id || deliveryPoints[0]?.customer_id
  );

  deliveryPoints.forEach((point, index) => {
    appendSegment(
      getWaypointCoordinates(point),
      deliveryPoints[index + 1]?.id || deliveryPoints[index + 1]?.customer_id
    );
  });

  appendSegment(getWaypointCoordinates(route?.end_point), null);
  return segments;
}

export default function FleetScreen() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [vehicles, setVehicles] = useState([]);
  const [routesData, setRoutesData] = useState([]);
  const [driverLocations, setDriverLocations] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState(TRACKABLE_VEHICLES);
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await routesApi.list({ token });
      const routes = Array.isArray(response?.routes) ? response.routes : [];
      setRoutesData(routes.slice(-5));
    } catch (error) {
      console.warn("Rotalar cekilemedi:", error?.message || error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchVehicles = useCallback(async () => {
    try {
      const response = await fetch(VEHICLES_API_URL);
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data)) return;

      const mappedVehicles = data.map((item) => {
        const coords = parseCoordinate(item.latitude, item.longitude);
        return {
          ...item,
          latitude: coords.lat,
          longitude: coords.lng,
          completed_points_array: parseCompletedPoints(item.completed_delivery_points),
        };
      });

      const uniqueVehicles = Object.values(
        mappedVehicles.reduce((accumulator, current) => {
          accumulator[current.vehicle_id] = current;
          return accumulator;
        }, {})
      );

      setVehicles(uniqueVehicles);
    } catch (error) {
      console.warn("Arac verisi cekilemedi:", error?.message || error);
    }
  }, []);

  const fetchDriverLocations = useCallback(async () => {
    try {
      const response = await driverTrackingApi.list({ token });
      const nextLocations = Array.isArray(response?.locations) ? response.locations : [];
      setDriverLocations(nextLocations);
    } catch (error) {
      console.warn("Driver konumlari cekilemedi:", error?.message || error);
    }
  }, [token]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchRoutes();
  }, [fetchRoutes, isAdmin]);

  useEffect(() => {
    let intervalId;

    if (isTracking) {
      fetchVehicles();
      fetchDriverLocations();
      intervalId = setInterval(() => {
        fetchVehicles();
        fetchDriverLocations();
      }, POLLING_INTERVAL);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchDriverLocations, fetchVehicles, isTracking]);

  const toggleTracking = () => setIsTracking((previous) => !previous);

  const toggleFilter = (vehicleId) => {
    setSelectedVehicles((previous) =>
      previous.includes(vehicleId)
        ? previous.filter((item) => item !== vehicleId)
        : [...previous, vehicleId]
    );
  };

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Bu alan sadece admin kullanicilar icin.</Text>
      </View>
    );
  }

  const initialRegion = {
    latitude: 39.75,
    longitude: 30.48,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const filteredVehicles = vehicles.filter((vehicle) => selectedVehicles.includes(vehicle.vehicle_id));
  const allCompletedPoints = new Set();
  filteredVehicles.forEach((vehicle) => {
    vehicle.completed_points_array?.forEach((point) => allCompletedPoints.add(point));
  });

  const activeDrivers = driverLocations.filter(
    (item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
  );

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>
        {routesData.map((route, routeIndex) => {
          const segments = buildRouteSegments(route, allCompletedPoints);

          return (
            <React.Fragment key={`route-group-${String(route.id || routeIndex)}`}>
              {segments.map((segment, segmentIndex) => (
                <Polyline
                  key={`route-${routeIndex}-segment-${segmentIndex}`}
                  coordinates={segment.coords}
                  strokeColor={segment.isTraveled ? colors.success : colors.primary}
                  strokeWidth={segment.isTraveled ? 5 : 3}
                  lineDashPattern={segment.isTraveled ? undefined : [2, 4]}
                />
              ))}

              {getCoordinate(route?.start_point) ? (
                <Marker coordinate={getCoordinate(route.start_point)} title="Depo (Baslangic)" zIndex={900}>
                  <View style={[styles.nodeMarker, styles.depotMarker]}>
                    <MaterialCommunityIcons name="store" size={16} color={colors.primary} />
                  </View>
                </Marker>
              ) : null}

              {(route.delivery_points || []).map((point, pointIndex) => {
                const coordinate = getCoordinate(point);
                if (!coordinate) return null;

                const pointId = String(point.id || point.customer_id || pointIndex);
                const isDelivered = allCompletedPoints.has(pointId);

                return (
                  <Marker
                    key={`point-${pointId}-${routeIndex}-${pointIndex}`}
                    coordinate={coordinate}
                    title={`Musteri: ${pointId}`}
                    description={isDelivered ? "Teslim edildi" : "Bekliyor"}
                    zIndex={800}
                  >
                    <View style={[styles.nodeMarker, isDelivered ? styles.nodeDelivered : styles.nodePending]}>
                      <MaterialCommunityIcons
                        name={isDelivered ? "check-circle" : "clock-time-four"}
                        size={16}
                        color="#fff"
                      />
                    </View>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        })}

        {filteredVehicles.map((vehicle) => {
          if (!vehicle.latitude || !vehicle.longitude) return null;
          const isReal = vehicle.vehicle_type === "REAL" || String(vehicle.vehicle_id || "").includes("musoshi");

          return (
            <Marker
              key={`vehicle-${vehicle.vehicle_id}`}
              coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
              title={vehicle.vehicle_id}
              zIndex={999}
            >
              <View style={[styles.markerBody, isReal ? styles.markerReal : styles.markerSumo]}>
                <MaterialCommunityIcons
                  name={isReal ? "truck-fast" : "car-connected"}
                  size={20}
                  color="#fff"
                />
              </View>
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>{vehicle.vehicle_id}</Text>
                  <Text style={styles.calloutText}>Tip: {vehicle.vehicle_type || "Bilinmiyor"}</Text>
                  <Text style={styles.calloutText}>Hiz: {Number(vehicle.speed || 0).toFixed(1)} km/h</Text>
                  <Text style={styles.calloutText}>Sarj: %{Number(vehicle.charge || 0).toFixed(0)}</Text>
                  {vehicle.route_id ? <Text style={styles.calloutText}>Rota: {vehicle.route_id}</Text> : null}
                  <Text style={[styles.calloutText, styles.calloutStrong]}>
                    Tamamlanan: {vehicle.completed_points_array.length}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {activeDrivers.map((driver) => (
          <Marker
            key={`driver-${driver.driver_id}`}
            coordinate={{
              latitude: Number(driver.latitude),
              longitude: Number(driver.longitude),
            }}
            title={driver.driver_name || driver.driver_id}
            description={driver.route_name || driver.route_id || "Driver"}
            zIndex={1000}
          >
            <View style={styles.driverMarker}>
              <MaterialCommunityIcons name="account-hard-hat" size={18} color="#fff" />
            </View>
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{driver.driver_name || driver.driver_id}</Text>
                <Text style={styles.calloutText}>Driver ID: {driver.driver_id}</Text>
                <Text style={styles.calloutText}>Rota: {driver.route_name || driver.route_id || "-"}</Text>
                <Text style={styles.calloutText}>Kaynak: {driver.source || "mobile-app"}</Text>
                <Text style={styles.calloutText}>Guncelleme: {driver.updated_at || driver.timestamp || "-"}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.overlayTop}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Canli Filo Takibi</Text>
            {isTracking && loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          <Text style={styles.statusSub}>
            {isTracking
              ? `Takip ediliyor (${filteredVehicles.length} arac, ${activeDrivers.length} driver)`
              : "Takip su an duraklatildi."}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {TRACKABLE_VEHICLES.map((vehicleId) => {
              const active = selectedVehicles.includes(vehicleId);
              return (
                <Pressable
                  key={vehicleId}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => toggleFilter(vehicleId)}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{vehicleId}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <View style={styles.overlayBottom}>
        <Pressable
          style={[styles.button, isTracking ? styles.buttonDanger : styles.buttonPrimary]}
          onPress={toggleTracking}
        >
          <MaterialCommunityIcons
            name={isTracking ? "stop-circle-outline" : "play-circle-outline"}
            size={24}
            color="#fff"
          />
          <Text style={styles.buttonText}>{isTracking ? "Takibi Durdur" : "Araclari Izle"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  infoText: {
    color: colors.muted,
  },
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  overlayTop: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  statusCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: radii.md,
    ...shadows.card,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  statusSub: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  filterRow: {
    marginTop: 12,
    flexDirection: "row",
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#fff",
  },
  overlayBottom: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    zIndex: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.lg,
    ...shadows.card,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  markerBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerReal: {
    backgroundColor: colors.danger,
  },
  markerSumo: {
    backgroundColor: "#3b82f6",
  },
  driverMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: colors.accent,
  },
  nodeMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  depotMarker: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  nodeDelivered: {
    backgroundColor: colors.success,
    borderColor: "#fff",
  },
  nodePending: {
    backgroundColor: "#eab308",
    borderColor: "#fff",
  },
  callout: {
    width: 180,
    padding: 10,
  },
  calloutTitle: {
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 12,
    color: colors.muted,
  },
  calloutStrong: {
    marginTop: 4,
    fontWeight: "700",
  },
});
