import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable, ActivityIndicator, Dimensions, ScrollView } from "react-native";
import Constants from "expo-constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ReactNativeMapView, {
  Marker as ReactNativeMarker,
  Polyline as ReactNativePolyline,
  UrlTile,
} from "react-native-maps";
import { useAuth } from "../context/AuthContext";
import { runtimeConfig } from "../config/runtimeConfig";
import {
  getBoundsFromCoordinates,
  lineFeatureFromCoordinates,
  resolveMapStyleUrl,
  resolveTomTomTrafficTileUrl,
  toLngLat,
  zoomFromRegion,
} from "../features/maps/maplibreConfig";
import { driverTrackingApi, routesApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

const isExpoGoApp =
  Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo";
const mapLibreModule = isExpoGoApp ? null : require("@maplibre/maplibre-react-native");
const Camera = mapLibreModule?.Camera;
const MapLibreMapView = mapLibreModule?.MapView;
const MarkerView = mapLibreModule?.MarkerView;
const ShapeSource = mapLibreModule?.ShapeSource;
const LineLayer = mapLibreModule?.LineLayer;
const RasterSource = mapLibreModule?.RasterSource;
const RasterLayer = mapLibreModule?.RasterLayer;

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

function FleetPin({ type = "vehicle", label = "" }) {
  const iconMap = {
    start: "store",
    end: "flag-checkered",
    vehicle: "truck-fast",
    sumo: "car-connected",
    driver: "account-hard-hat",
    delivered: "check-circle",
    pending: "clock-time-four",
  };

  return (
    <View style={styles.pinWrap}>
      <View
        style={[
          styles.pinBody,
          type === "start" && styles.pinBodyStart,
          type === "end" && styles.pinBodyEnd,
          type === "vehicle" && styles.pinBodyVehicle,
          type === "sumo" && styles.pinBodySumo,
          type === "driver" && styles.pinBodyDriver,
          type === "delivered" && styles.pinBodyDelivered,
          type === "pending" && styles.pinBodyPending,
        ]}
      >
        {label ? (
          <Text style={styles.pinLabel}>{label}</Text>
        ) : (
          <MaterialCommunityIcons name={iconMap[type] || "map-marker"} size={16} color="#fff" />
        )}
      </View>
      <View
        style={[
          styles.pinTail,
          type === "start" && styles.pinTailStart,
          type === "end" && styles.pinTailEnd,
          type === "vehicle" && styles.pinTailVehicle,
          type === "sumo" && styles.pinTailSumo,
          type === "driver" && styles.pinTailDriver,
          type === "delivered" && styles.pinTailDelivered,
          type === "pending" && styles.pinTailPending,
        ]}
      />
    </View>
  );
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
  const [isMapReady, setIsMapReady] = useState(false);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const isExpoGo = isExpoGoApp;
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const mapStyleUrl = resolveMapStyleUrl();
  const trafficTileUrl = resolveTomTomTrafficTileUrl();

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
      if (!runtimeConfig.fleetVehiclesUrl) {
        throw new Error("EXPO_PUBLIC_FLEET_VEHICLES_URL ayarlanmali.");
      }

      const response = await fetch(runtimeConfig.fleetVehiclesUrl);
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

  useEffect(() => {
    if (!isMapReady) return;

    const routeCoords = routesData.flatMap((route) => {
      const points = [];
      const start = getCoordinate(route?.start_point);
      const end = getCoordinate(route?.end_point);
      if (start) points.push(start);
      (route.delivery_points || []).forEach((point) => {
        const coordinate = getCoordinate(point);
        if (coordinate) points.push(coordinate);
      });
      if (end) points.push(end);
      return points;
    });

    const liveCoords = [
      ...filteredVehicles
        .filter((vehicle) => Number.isFinite(vehicle.latitude) && Number.isFinite(vehicle.longitude))
        .map((vehicle) => ({ latitude: Number(vehicle.latitude), longitude: Number(vehicle.longitude) })),
      ...activeDrivers.map((driver) => ({ latitude: Number(driver.latitude), longitude: Number(driver.longitude) })),
    ];

    const bounds = getBoundsFromCoordinates([...routeCoords, ...liveCoords]);
    if (!bounds) return;

    if (isExpoGo && mapRef.current?.fitToCoordinates) {
      mapRef.current.fitToCoordinates([bounds.ne, bounds.sw], {
        edgePadding: { top: 60, right: 30, bottom: 120, left: 30 },
        animated: true,
      });
      return;
    }

    if (!cameraRef.current) return;
    cameraRef.current.fitBounds(bounds.ne, bounds.sw, [60, 30, 120, 30], 500);
  }, [activeDrivers, filteredVehicles, isExpoGo, isMapReady, routesData]);

  return (
    <View style={styles.container}>
      {isExpoGo ? (
        <ReactNativeMapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          onMapReady={() => setIsMapReady(true)}
          showsCompass
        >
          {showTrafficLayer && trafficTileUrl ? (
            <UrlTile urlTemplate={trafficTileUrl} zIndex={2} maximumZ={22} flipY={false} />
          ) : null}

          {routesData.map((route, routeIndex) => {
            const segments = buildRouteSegments(route, allCompletedPoints);

            return (
              <React.Fragment key={`route-group-${String(route.id || routeIndex)}`}>
                {segments.map((segment, segmentIndex) => (
                  <ReactNativePolyline
                    key={`route-${routeIndex}-segment-${segmentIndex}`}
                    coordinates={segment.coords}
                    strokeColor={segment.isTraveled ? colors.success : colors.primary}
                    strokeWidth={segment.isTraveled ? 5 : 3}
                  />
                ))}

                {getCoordinate(route?.start_point) ? (
                  <ReactNativeMarker coordinate={getCoordinate(route.start_point)} anchor={{ x: 0.5, y: 1 }}>
                    <FleetPin type="start" />
                  </ReactNativeMarker>
                ) : null}

                {(route.delivery_points || []).map((point, pointIndex) => {
                  const coordinate = getCoordinate(point);
                  if (!coordinate) return null;

                  const pointId = String(point.id || point.customer_id || pointIndex);
                  const isDelivered = allCompletedPoints.has(pointId);

                  return (
                    <ReactNativeMarker
                      key={`point-${pointId}-${routeIndex}-${pointIndex}`}
                      coordinate={coordinate}
                      anchor={{ x: 0.5, y: 1 }}
                    >
                      <FleetPin type={isDelivered ? "delivered" : "pending"} label={String(pointIndex + 1)} />
                    </ReactNativeMarker>
                  );
                })}

                {getCoordinate(route?.end_point) ? (
                  <ReactNativeMarker coordinate={getCoordinate(route.end_point)} anchor={{ x: 0.5, y: 1 }}>
                    <FleetPin type="end" />
                  </ReactNativeMarker>
                ) : null}
              </React.Fragment>
            );
          })}

          {filteredVehicles.map((vehicle) => {
            if (!vehicle.latitude || !vehicle.longitude) return null;
            const isReal = vehicle.vehicle_type === "REAL" || String(vehicle.vehicle_id || "").includes("musoshi");

            return (
              <ReactNativeMarker
                key={`vehicle-${vehicle.vehicle_id}`}
                coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.markerWrap}>
                  <FleetPin type={isReal ? "vehicle" : "sumo"} />
                  <View style={styles.inlineLabel}>
                    <Text style={styles.inlineLabelText}>{vehicle.vehicle_id}</Text>
                  </View>
                </View>
              </ReactNativeMarker>
            );
          })}

          {activeDrivers.map((driver) => (
            <ReactNativeMarker
              key={`driver-${driver.driver_id}`}
              coordinate={{
                latitude: Number(driver.latitude),
                longitude: Number(driver.longitude),
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerWrap}>
                <FleetPin type="driver" />
                <View style={styles.inlineLabel}>
                  <Text style={styles.inlineLabelText}>{driver.driver_name || driver.driver_id}</Text>
                </View>
              </View>
            </ReactNativeMarker>
          ))}
        </ReactNativeMapView>
      ) : (
        <MapLibreMapView
          ref={mapRef}
          style={styles.map}
          mapStyle={mapStyleUrl}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          onDidFinishLoadingMap={() => setIsMapReady(true)}
        >
          {showTrafficLayer && trafficTileUrl ? (
            <RasterSource id="fleet-traffic-source" tileUrlTemplates={[trafficTileUrl]} tileSize={256}>
              <RasterLayer id="fleet-traffic-layer" style={{ rasterOpacity: 0.84 }} />
            </RasterSource>
          ) : null}

          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: toLngLat(initialRegion),
              zoomLevel: zoomFromRegion(initialRegion),
            }}
          />
          {routesData.map((route, routeIndex) => {
            const segments = buildRouteSegments(route, allCompletedPoints);

            return (
              <React.Fragment key={`route-group-${String(route.id || routeIndex)}`}>
                {segments.map((segment, segmentIndex) => (
                  <ShapeSource
                    key={`route-${routeIndex}-segment-${segmentIndex}`}
                    id={`route-${routeIndex}-segment-${segmentIndex}`}
                    shape={lineFeatureFromCoordinates(segment.coords)}
                  >
                    <LineLayer
                      id={`route-${routeIndex}-segment-${segmentIndex}-line`}
                      style={{
                        lineColor: segment.isTraveled ? colors.success : colors.primary,
                        lineWidth: segment.isTraveled ? 5 : 3,
                        lineCap: "round",
                        lineJoin: "round",
                      }}
                    />
                  </ShapeSource>
                ))}

                {getCoordinate(route?.start_point) ? (
                  <MarkerView coordinate={toLngLat(getCoordinate(route.start_point))} anchor={{ x: 0.5, y: 1 }}>
                    <FleetPin type="start" />
                  </MarkerView>
                ) : null}

                {(route.delivery_points || []).map((point, pointIndex) => {
                  const coordinate = getCoordinate(point);
                  if (!coordinate) return null;

                  const pointId = String(point.id || point.customer_id || pointIndex);
                  const isDelivered = allCompletedPoints.has(pointId);

                  return (
                    <MarkerView
                      key={`point-${pointId}-${routeIndex}-${pointIndex}`}
                      coordinate={toLngLat(coordinate)}
                      anchor={{ x: 0.5, y: 1 }}
                    >
                      <FleetPin type={isDelivered ? "delivered" : "pending"} label={String(pointIndex + 1)} />
                    </MarkerView>
                  );
                })}

                {getCoordinate(route?.end_point) ? (
                  <MarkerView coordinate={toLngLat(getCoordinate(route.end_point))} anchor={{ x: 0.5, y: 1 }}>
                    <FleetPin type="end" />
                  </MarkerView>
                ) : null}
              </React.Fragment>
            );
          })}

          {filteredVehicles.map((vehicle) => {
            if (!vehicle.latitude || !vehicle.longitude) return null;
            const isReal = vehicle.vehicle_type === "REAL" || String(vehicle.vehicle_id || "").includes("musoshi");

            return (
              <MarkerView
                key={`vehicle-${vehicle.vehicle_id}`}
                coordinate={toLngLat({ latitude: vehicle.latitude, longitude: vehicle.longitude })}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.markerWrap}>
                  <FleetPin type={isReal ? "vehicle" : "sumo"} />
                  <View style={styles.inlineLabel}>
                    <Text style={styles.inlineLabelText}>{vehicle.vehicle_id}</Text>
                  </View>
                </View>
              </MarkerView>
            );
          })}

          {activeDrivers.map((driver) => (
            <MarkerView
              key={`driver-${driver.driver_id}`}
              coordinate={toLngLat({
                latitude: Number(driver.latitude),
                longitude: Number(driver.longitude),
              })}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerWrap}>
                <FleetPin type="driver" />
                <View style={styles.inlineLabel}>
                  <Text style={styles.inlineLabelText}>{driver.driver_name || driver.driver_id}</Text>
                </View>
              </View>
            </MarkerView>
          ))}
        </MapLibreMapView>
      )}

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

          {trafficTileUrl ? (
            <View style={styles.trafficRow}>
              <Pressable
                style={[styles.filterPill, showTrafficLayer && styles.filterPillActive]}
                onPress={() => setShowTrafficLayer((previous) => !previous)}
              >
                <Text style={[styles.filterPillText, showTrafficLayer && styles.filterPillTextActive]}>
                  {showTrafficLayer ? "Trafik Acik" : "Trafik Kapali"}
                </Text>
              </Pressable>
            </View>
          ) : null}
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
    textAlign: "center",
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
  trafficRow: {
    marginTop: 10,
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
  pinWrap: {
    alignItems: "center",
  },
  pinBody: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    ...shadows.card,
  },
  pinBodyStart: {
    backgroundColor: "#0f172a",
  },
  pinBodyEnd: {
    backgroundColor: "#2563eb",
  },
  pinBodyVehicle: {
    backgroundColor: colors.danger,
  },
  pinBodySumo: {
    backgroundColor: "#2563eb",
  },
  pinBodyDriver: {
    backgroundColor: "#b91c1c",
  },
  pinBodyDelivered: {
    backgroundColor: colors.success,
  },
  pinBodyPending: {
    backgroundColor: "#eab308",
  },
  pinLabel: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  pinTailStart: {
    borderTopColor: "#0f172a",
  },
  pinTailEnd: {
    borderTopColor: "#2563eb",
  },
  pinTailVehicle: {
    borderTopColor: colors.danger,
  },
  pinTailSumo: {
    borderTopColor: "#2563eb",
  },
  pinTailDriver: {
    borderTopColor: "#b91c1c",
  },
  pinTailDelivered: {
    borderTopColor: colors.success,
  },
  pinTailPending: {
    borderTopColor: "#eab308",
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
  markerWrap: {
    alignItems: "center",
  },
  inlineLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineLabelText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700",
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
});
