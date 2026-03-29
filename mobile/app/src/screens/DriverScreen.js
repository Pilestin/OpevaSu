import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";
import ReactNativeMapView, {
  Marker as ReactNativeMarker,
  Polyline as ReactNativePolyline,
  UrlTile,
} from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import {
  getBoundsFromCoordinates,
  lineFeatureFromCoordinates,
  resolveMapStyleUrl,
  resolveTomTomTrafficTileUrl,
  toLngLat,
  zoomFromRegion,
} from "../features/maps/maplibreConfig";
import { driverTrackingApi, liveDeliveryApi, routesApi } from "../services/api";
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

function RoutePin({ type = "stop", label = "", active = false }) {
  const iconMap = {
    start: "warehouse",
    end: "flag-checkered",
    driver: "truck-fast",
  };
  const iconName = iconMap[type];

  return (
    <View style={[styles.pinWrap, active && styles.pinWrapActive]}>
      <View
        style={[
          styles.pinBody,
          type === "start" && styles.pinBodyStart,
          type === "end" && styles.pinBodyEnd,
          type === "driver" && styles.pinBodyDriver,
          type === "visited" && styles.pinBodyVisited,
          type === "stop" && styles.pinBodyStop,
        ]}
      >
        {iconName ? (
          <MaterialCommunityIcons name={iconName} size={16} color="#fff" />
        ) : (
          <Text style={styles.pinLabel}>{label}</Text>
        )}
      </View>
      <View
        style={[
          styles.pinTail,
          type === "start" && styles.pinTailStart,
          type === "end" && styles.pinTailEnd,
          type === "driver" && styles.pinTailDriver,
          type === "visited" && styles.pinTailVisited,
          type === "stop" && styles.pinTailStop,
        ]}
      />
    </View>
  );
}

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

function buildRoutePath(route) {
  const coordinates = [];
  const append = (coordinate) => {
    if (!coordinate) return;
    const previous = coordinates[coordinates.length - 1];
    if (previous && previous.latitude === coordinate.latitude && previous.longitude === coordinate.longitude) {
      return;
    }
    coordinates.push(coordinate);
  };

  append(getCoordinate(route?.start_point));
  getWaypointCoordinates(route?.start_point).forEach(append);

  const deliveryPoints = Array.isArray(route?.delivery_points) ? route.delivery_points : [];
  deliveryPoints.forEach((point) => {
    append(getCoordinate(point));
    getWaypointCoordinates(point).forEach(append);
  });

  append(getCoordinate(route?.end_point));
  return coordinates;
}

function resolveRouteDate(route) {
  const rawValue =
    route?.timestamp ||
    route?.created_at ||
    route?.updated_at ||
    route?.createdAt ||
    route?.inserted_at;

  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveRouteTimestamp(route) {
  const parsed = resolveRouteDate(route);
  if (!parsed) return "-";
  return parsed.toLocaleString("tr-TR");
}

function getRouteKey(route, fallbackIndex = 0) {
  return String(route?.id || `${route?.name || "route"}-${resolveRouteDate(route)?.getTime() || fallbackIndex}`);
}

function getMapRegion(coordinates) {
  if (!coordinates.length) {
    return {
      latitude: 39.75,
      longitude: 30.48,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }

  const latitudes = coordinates.map((item) => item.latitude);
  const longitudes = coordinates.map((item) => item.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.4, 0.02),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.4, 0.02),
  };
}

function normalizeRequests(requests) {
  if (Array.isArray(requests)) return requests;
  if (requests && typeof requests === "object") return [requests];
  return [];
}

function formatRequestSummary(request) {
  const productName = request?.product_name || request?.product_id || "Urun";
  const quantity = request?.load_information?.quantity;
  const weight = request?.load_information?.weight;
  const parts = [productName];
  if (quantity != null) parts.push(`${quantity} adet`);
  if (weight != null) parts.push(`${weight} kg`);
  return parts.join(" / ");
}

function buildRouteStops(route) {
  const deliveryPoints = Array.isArray(route?.delivery_points) ? route.delivery_points : [];

  return deliveryPoints.map((point, index) => {
    const requests = normalizeRequests(point?.node_detail?.customer?.requests);
    const customerLabel =
      point?.node_detail?.customer?.name ||
      point?.node_detail?.customer?.full_name ||
      point?.node_detail?.customer?.company_name ||
      point?.id ||
      `Teslimat ${index + 1}`;

    return {
      key: `${point?.id || "stop"}-${index}`,
      order: index + 1,
      id: String(point?.id || `stop-${index + 1}`),
      title: customerLabel,
      address:
        point?.address ||
        point?.node_detail?.customer?.address ||
        point?.node_detail?.address ||
        "Adres bilgisi yok",
      coordinate: getCoordinate(point),
      visited: Boolean(point?.visited),
      visitTime: point?.visit_time || null,
      requestCount: requests.length,
      requests: requests.map((request, requestIndex) => ({
        key: `${point?.id || index}-${requestIndex}`,
        status: request?.status || "-",
        serviceTime: request?.service_time ?? null,
        summary: formatRequestSummary(request),
      })),
    };
  });
}

function formatVisitTime(value) {
  if (!value) return "Bekleniyor";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatDistanceMeters(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return `${Math.round(Number(value))} m`;
}

function haversineDistanceMeters(first, second) {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  const toRadians = (value) => (value * Math.PI) / 180;
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

function appendTravelCoordinate(previous, nextCoordinate) {
  if (!nextCoordinate) return previous;
  if (!previous.length) return [nextCoordinate];

  const lastCoordinate = previous[previous.length - 1];
  if (haversineDistanceMeters(lastCoordinate, nextCoordinate) < 5) {
    return previous;
  }

  return [...previous, nextCoordinate];
}

function findNearestRouteIndex(routeCoordinates, currentCoordinate) {
  if (!routeCoordinates.length || !currentCoordinate) return 0;
  let nearestIndex = 0;
  let shortestDistance = Number.POSITIVE_INFINITY;

  routeCoordinates.forEach((coordinate, index) => {
    const distance = haversineDistanceMeters(coordinate, currentCoordinate);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function splitRouteCoordinates(routeCoordinates, currentCoordinate) {
  if (!routeCoordinates.length) {
    return { completedSegment: [], remainingSegment: [] };
  }

  const nearestIndex = findNearestRouteIndex(routeCoordinates, currentCoordinate);
  return {
    completedSegment: routeCoordinates.slice(0, Math.max(nearestIndex + 1, 1)),
    remainingSegment: routeCoordinates.slice(Math.max(nearestIndex, 0)),
  };
}

export default function DriverScreen() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [currentStep, setCurrentStep] = useState("selection");
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [startingTracking, setStartingTracking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastMatchedStop, setLastMatchedStop] = useState(null);
  const [lastDeliveryUpdateCount, setLastDeliveryUpdateCount] = useState(0);
  const [traveledCoordinates, setTraveledCoordinates] = useState([]);
  const [followDriver, setFollowDriver] = useState(true);
  const [activeStopId, setActiveStopId] = useState("");
  const [completingStopId, setCompletingStopId] = useState("");
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isTopOverlayExpanded, setIsTopOverlayExpanded] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const isExpoGo = isExpoGoApp;
  const canUseDriverPanel = ["driver", "admin"].includes(user?.role);
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const locationSubscriptionRef = useRef(null);
  const lastPublishedAtRef = useRef(0);
  const mapStyleUrl = useMemo(() => resolveMapStyleUrl(), []);
  const trafficTileUrl = useMemo(() => resolveTomTomTrafficTileUrl(), []);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const centerMapOnCoordinate = useCallback(
    (coordinate, zoomLevel = 16.8) => {
      if (!coordinate || !isMapReady) return;

      if (isExpoGo && mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(
          {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          500
        );
        return;
      }

      if (!cameraRef.current) return;
      cameraRef.current.setCamera({
        centerCoordinate: toLngLat(coordinate),
        zoomLevel,
        animationDuration: 500,
      });
    },
    [isExpoGo, isMapReady]
  );

  const loadRoutes = useCallback(
    async (isRefresh = false) => {
      if (!canUseDriverPanel) return;

      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await routesApi.list({ token });
        const nextRoutes = Array.isArray(response?.routes) ? response.routes : [];
        setRoutes(nextRoutes);
        if (selectedRouteId && !nextRoutes.some((route, index) => getRouteKey(route, index) === selectedRouteId)) {
          setSelectedRouteId("");
        }
      } catch (error) {
        Alert.alert("Rotalar yuklenemedi", error.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canUseDriverPanel, selectedRouteId, token]
  );

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  useFocusEffect(
    useCallback(() => {
      loadRoutes(true);
    }, [loadRoutes])
  );

  const sortedRoutes = useMemo(() => {
    const sortable = routes.map((route, index) => ({
      route,
      key: getRouteKey(route, index),
      date: resolveRouteDate(route)?.getTime() || 0,
    }));

    sortable.sort((left, right) => (sortOrder === "desc" ? right.date - left.date : left.date - right.date));
    return sortable.map((item) => item.route);
  }, [routes, sortOrder]);

  const selectedRoute = useMemo(
    () => routes.find((route, index) => getRouteKey(route, index) === selectedRouteId) || null,
    [routes, selectedRouteId]
  );
  const routeCoordinates = useMemo(() => buildRoutePath(selectedRoute), [selectedRoute]);
  const routeStops = useMemo(() => buildRouteStops(selectedRoute), [selectedRoute]);
  const mapRegion = useMemo(() => getMapRegion(routeCoordinates), [routeCoordinates]);
  const currentCoordinate = currentLocation?.coords
    ? {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      }
    : null;
  const routeProgress = useMemo(
    () => splitRouteCoordinates(routeCoordinates, currentCoordinate),
    [routeCoordinates, currentCoordinate]
  );

  useEffect(() => {
    setLastMatchedStop(null);
    setLastDeliveryUpdateCount(0);
    setActiveStopId("");
    setTraveledCoordinates([]);
    setFollowDriver(true);
    setIsSheetExpanded(false);
    setIsTopOverlayExpanded(true);
    setIsMapReady(false);
  }, [selectedRouteId]);

  const markStopCompletedLocally = useCallback((deliveryPointId) => {
    const now = new Date().toISOString();
    setRoutes((previous) =>
      previous.map((route, routeIndex) => {
        if (getRouteKey(route, routeIndex) !== selectedRouteId) return route;

        return {
          ...route,
          delivery_points: Array.isArray(route.delivery_points)
            ? route.delivery_points.map((point) => {
                if (String(point?.id || point?.customer_id || "").trim() !== deliveryPointId) {
                  return point;
                }

                const nextRequests = normalizeRequests(point?.node_detail?.customer?.requests).map((request) => ({
                  ...request,
                  status: "completed",
                }));

                return {
                  ...point,
                  visited: true,
                  visit_time: now,
                  node_detail: point?.node_detail?.customer
                    ? {
                        ...point.node_detail,
                        customer: {
                          ...point.node_detail.customer,
                          requests: nextRequests,
                        },
                      }
                    : point.node_detail,
                };
              })
            : route.delivery_points,
        };
      })
    );
  }, [selectedRouteId]);

  const animateToDriver = useCallback(
    (coordinate) => {
      if (!coordinate || !followDriver || !isMapReady) return;

      centerMapOnCoordinate(coordinate);
    },
    [centerMapOnCoordinate, followDriver, isMapReady]
  );

  const stopTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setTrackingEnabled(false);

    if (selectedRoute && token) {
      liveDeliveryApi.endSession({
        token,
        payload: {
          driver_id: user?.user_id || user?.email || user?.user_name,
          route_id: String(selectedRoute.id || ""),
        },
      }).catch((error) => {
        console.warn("Delivery session end failed:", error?.message || error);
      });
    }
  }, [selectedRoute, token, user]);

  const publishLocation = useCallback(
    async (location) => {
      if (!selectedRoute || !token) return;

      const now = Date.now();
      if (now - lastPublishedAtRef.current < 4000) return;
      lastPublishedAtRef.current = now;
      setPublishing(true);

      try {
        const basePayload = {
          driver_id: user?.user_id || user?.email || user?.user_name,
          driver_name: user?.full_name || [user?.name, user?.last_name].filter(Boolean).join(" ") || user?.user_name,
          route_id: String(selectedRoute.id || ""),
          route_name: String(selectedRoute.name || ""),
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp ? new Date(location.timestamp).toISOString() : new Date().toISOString(),
        };

        await driverTrackingApi.publish({
          token,
          payload: basePayload,
        });

        const evaluation = await driverTrackingApi.evaluate({
          token,
          payload: {
            ...basePayload,
            radius_meters: 35,
          },
        });

        if (evaluation?.matched) {
          setLastMatchedStop(evaluation.matched_stop || null);
          setLastDeliveryUpdateCount(Number(evaluation.updated_count || 0));
          if (evaluation?.matched_stop?.delivery_point_id) {
            markStopCompletedLocally(String(evaluation.matched_stop.delivery_point_id));
          }
        }
      } catch (error) {
        console.warn("Driver location publish failed:", error?.message || error);
      } finally {
        setPublishing(false);
      }
    },
    [markStopCompletedLocally, selectedRoute, token, user]
  );

  const handleLocationUpdate = useCallback(
    async (nextLocation) => {
      setCurrentLocation(nextLocation);
      const nextCoordinate = {
        latitude: nextLocation.coords.latitude,
        longitude: nextLocation.coords.longitude,
      };
      setTraveledCoordinates((previous) => appendTravelCoordinate(previous, nextCoordinate));
      animateToDriver(nextCoordinate);
      await publishLocation(nextLocation);
    },
    [animateToDriver, publishLocation]
  );

  const startTracking = useCallback(async () => {
    if (!selectedRoute || locationSubscriptionRef.current) return;

    setStartingTracking(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Konum izni gerekli", "Driver takibi icin cihaz konum izni verilmelidir.");
        return;
      }

      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }

      await liveDeliveryApi.startSession({
        token,
        payload: {
          driver_id: user?.user_id || user?.email || user?.user_name,
          driver_name: user?.full_name || [user?.name, user?.last_name].filter(Boolean).join(" ") || user?.user_name,
          route_id: String(selectedRoute.id || ""),
          route_name: String(selectedRoute.name || ""),
        },
      });

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await handleLocationUpdate(current);

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (nextLocation) => {
          await handleLocationUpdate(nextLocation);
        }
      );

      setTrackingEnabled(true);
    } catch (error) {
      Alert.alert("Konum takibi baslatilamadi", error.message);
    } finally {
      setStartingTracking(false);
    }
  }, [handleLocationUpdate, selectedRoute, token, user]);

  const completeStop = useCallback(
    async (stop) => {
      if (!selectedRoute || !token || !stop?.id) return;
      setCompletingStopId(stop.id);

      try {
        const response = await driverTrackingApi.completeDelivery({
          token,
          payload: {
            route_id: String(selectedRoute.id || ""),
            route_name: String(selectedRoute.name || ""),
            delivery_point_id: stop.id,
            driver_id: user?.user_id || user?.email || user?.user_name,
            latitude: currentCoordinate?.latitude ?? stop.coordinate?.latitude,
            longitude: currentCoordinate?.longitude ?? stop.coordinate?.longitude,
          },
        });

        markStopCompletedLocally(stop.id);
        setLastMatchedStop(response?.matched_stop || { delivery_point_id: stop.id, distance_meters: 0 });
        setLastDeliveryUpdateCount(Number(response?.updated_count || 0));
        setActiveStopId(stop.id);
        Alert.alert("Siparis guncellendi", `${stop.title} teslimati tamamlandi olarak isaretlendi.`);
      } catch (error) {
        Alert.alert("Teslimat guncellenemedi", error.message);
      } finally {
        setCompletingStopId("");
      }
    },
    [currentCoordinate?.latitude, currentCoordinate?.longitude, markStopCompletedLocally, selectedRoute, token, user]
  );

  const confirmCompleteStop = useCallback(
    (stop) => {
      Alert.alert(
        "Siparisi tamamla",
        `${stop.title} teslimatini tamamlandi olarak isaretlemek istiyor musun?`,
        [
          { text: "Vazgec", style: "cancel" },
          { text: "Tamamla", onPress: () => completeStop(stop) },
        ]
      );
    },
    [completeStop]
  );

  useEffect(() => {
    if (currentStep === "map" && selectedRoute && !trackingEnabled) {
      startTracking();
    }

    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, [currentStep, selectedRoute, startTracking, trackingEnabled]);

  useEffect(() => {
    if (currentStep !== "map" || !routeCoordinates.length || currentCoordinate || !isMapReady) return;

    if (isExpoGo && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(mapRegion, 500);
      return;
    }

    if (!cameraRef.current) return;

    const bounds = getBoundsFromCoordinates(routeCoordinates);
    if (bounds) {
      cameraRef.current.fitBounds(bounds.ne, bounds.sw, [80, 40, 260, 40], 600);
      return;
    }

    cameraRef.current.setCamera({
      centerCoordinate: toLngLat(mapRegion),
      zoomLevel: zoomFromRegion(mapRegion),
      animationDuration: 500,
    });
  }, [currentCoordinate, currentStep, isExpoGo, isMapReady, mapRegion, routeCoordinates]);

  if (!canUseDriverPanel) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Bu alan sadece driver ve admin kullanicilar icin.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (currentStep === "map" && selectedRoute) {
    const startCoordinate = getCoordinate(selectedRoute.start_point);
    const endCoordinate = getCoordinate(selectedRoute.end_point);

    return (
        <View style={styles.mapScreen}>
          {isExpoGo ? (
            <ReactNativeMapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              onMapReady={() => setIsMapReady(true)}
              showsCompass
              rotateEnabled
              showsUserLocation={false}
            >
              {showTrafficLayer && trafficTileUrl ? (
                <UrlTile urlTemplate={trafficTileUrl} zIndex={2} maximumZ={22} flipY={false} />
              ) : null}

              {routeCoordinates.length > 1 ? (
                <ReactNativePolyline coordinates={routeCoordinates} strokeColor="rgba(148, 163, 184, 0.35)" strokeWidth={6} />
              ) : null}

              {routeProgress.completedSegment.length > 1 ? (
                <ReactNativePolyline coordinates={routeProgress.completedSegment} strokeColor="rgba(148, 163, 184, 0.55)" strokeWidth={7} />
              ) : null}

              {routeProgress.remainingSegment.length > 1 ? (
                <ReactNativePolyline coordinates={routeProgress.remainingSegment} strokeColor="rgba(15, 118, 110, 0.75)" strokeWidth={7} />
              ) : null}

              {traveledCoordinates.length > 1 ? (
                <ReactNativePolyline coordinates={traveledCoordinates} strokeColor="rgba(245, 158, 11, 0.95)" strokeWidth={5} />
              ) : null}

              {startCoordinate ? (
                <ReactNativeMarker coordinate={startCoordinate} anchor={{ x: 0.5, y: 1 }} zIndex={20}>
                  <RoutePin type="start" />
                </ReactNativeMarker>
              ) : null}

              {routeStops.map((stop) => {
                if (!stop.coordinate) return null;
                return (
                  <ReactNativeMarker
                    key={stop.key}
                    coordinate={stop.coordinate}
                    anchor={{ x: 0.5, y: 1 }}
                    zIndex={10}
                    onPress={() => {
                      setActiveStopId(stop.id);
                      confirmCompleteStop(stop);
                    }}
                  >
                    <RoutePin
                      type={stop.visited ? "visited" : "stop"}
                      label={String(stop.order)}
                      active={activeStopId === stop.id}
                    />
                  </ReactNativeMarker>
                );
              })}

              {endCoordinate ? (
                <ReactNativeMarker coordinate={endCoordinate} anchor={{ x: 0.5, y: 1 }} zIndex={20}>
                  <RoutePin type="end" />
                </ReactNativeMarker>
              ) : null}

              {currentCoordinate ? (
                <ReactNativeMarker coordinate={currentCoordinate} anchor={{ x: 0.5, y: 1 }} zIndex={30}>
                  <RoutePin type="driver" />
                </ReactNativeMarker>
              ) : null}
            </ReactNativeMapView>
          ) : (
            <MapLibreMapView
              ref={mapRef}
              style={styles.map}
              mapStyle={mapStyleUrl}
              compassEnabled
              scaleBarEnabled={false}
              logoEnabled={false}
              attributionEnabled={false}
              onDidFinishLoadingMap={() => setIsMapReady(true)}
            >
              {showTrafficLayer && trafficTileUrl ? (
                <RasterSource id="driver-traffic-source" tileUrlTemplates={[trafficTileUrl]} tileSize={256}>
                  <RasterLayer id="driver-traffic-layer" style={{ rasterOpacity: 0.84 }} />
                </RasterSource>
              ) : null}

              <Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: toLngLat(mapRegion),
                  zoomLevel: zoomFromRegion(mapRegion),
                }}
              />

              {routeCoordinates.length > 1 ? (
                <ShapeSource id="driver-route-base" shape={lineFeatureFromCoordinates(routeCoordinates)}>
                  <LineLayer
                    id="driver-route-base-line"
                    style={{ lineColor: "rgba(148, 163, 184, 0.35)", lineWidth: 6, lineCap: "round", lineJoin: "round" }}
                  />
                </ShapeSource>
              ) : null}

              {routeProgress.completedSegment.length > 1 ? (
                <ShapeSource id="driver-route-completed" shape={lineFeatureFromCoordinates(routeProgress.completedSegment)}>
                  <LineLayer
                    id="driver-route-completed-line"
                    style={{ lineColor: "rgba(148, 163, 184, 0.55)", lineWidth: 7, lineCap: "round", lineJoin: "round" }}
                  />
                </ShapeSource>
              ) : null}

              {routeProgress.remainingSegment.length > 1 ? (
                <ShapeSource id="driver-route-remaining" shape={lineFeatureFromCoordinates(routeProgress.remainingSegment)}>
                  <LineLayer
                    id="driver-route-remaining-line"
                    style={{ lineColor: "rgba(15, 118, 110, 0.75)", lineWidth: 7, lineCap: "round", lineJoin: "round" }}
                  />
                </ShapeSource>
              ) : null}

              {traveledCoordinates.length > 1 ? (
                <ShapeSource id="driver-traveled-route" shape={lineFeatureFromCoordinates(traveledCoordinates)}>
                  <LineLayer
                    id="driver-traveled-route-line"
                    style={{ lineColor: "rgba(245, 158, 11, 0.95)", lineWidth: 5, lineCap: "round", lineJoin: "round" }}
                  />
                </ShapeSource>
              ) : null}

              {startCoordinate ? (
                <MarkerView coordinate={toLngLat(startCoordinate)} anchor={{ x: 0.5, y: 1 }}>
                  <RoutePin type="start" />
                </MarkerView>
              ) : null}

              {routeStops.map((stop) => {
                if (!stop.coordinate) return null;
                return (
                  <MarkerView key={stop.key} coordinate={toLngLat(stop.coordinate)} anchor={{ x: 0.5, y: 1 }}>
                    <Pressable
                      onPress={() => {
                        setActiveStopId(stop.id);
                        confirmCompleteStop(stop);
                      }}
                    >
                      <RoutePin
                        type={stop.visited ? "visited" : "stop"}
                        label={String(stop.order)}
                        active={activeStopId === stop.id}
                      />
                    </Pressable>
                  </MarkerView>
                );
              })}

              {endCoordinate ? (
                <MarkerView coordinate={toLngLat(endCoordinate)} anchor={{ x: 0.5, y: 1 }}>
                  <RoutePin type="end" />
                </MarkerView>
              ) : null}

              {currentCoordinate ? (
                <MarkerView coordinate={toLngLat(currentCoordinate)} anchor={{ x: 0.5, y: 1 }}>
                  <RoutePin type="driver" />
                </MarkerView>
              ) : null}
            </MapLibreMapView>
          )}

        <View style={[styles.topOverlay, !isTopOverlayExpanded && styles.topOverlayCollapsed]}>
          <View style={styles.overlayHeaderRow}>
            <View style={styles.overlayHeaderText}>
              <Text style={styles.overlayTitle}>{selectedRoute.name || "Secili rota"}</Text>
              <Text style={styles.overlayMeta}>
                {routeStops.length} durak / {resolveRouteTimestamp(selectedRoute)}
              </Text>
            </View>
            <View style={styles.overlayHeaderActions}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{trackingEnabled ? "GPS Acik" : "GPS Kapali"}</Text>
              </View>
              <Pressable
                style={styles.overlayToggleButton}
                onPress={() => setIsTopOverlayExpanded((previous) => !previous)}
              >
                <MaterialCommunityIcons
                  name={isTopOverlayExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.text}
                />
              </Pressable>
            </View>
          </View>

          {!isTopOverlayExpanded ? (
            <Text style={styles.collapsedOverlayHint}>Kontrolleri ac</Text>
          ) : (
            <>
              <Text style={styles.overlayMeta}>
                Cizgiler: yesil kalan rota / sari gidilen yol / gri geride kalan rota
              </Text>

              {lastMatchedStop ? (
                <View style={styles.matchPill}>
                  <MaterialCommunityIcons name="map-marker-check" size={16} color={colors.success} />
                  <Text style={styles.matchPillText}>
                    Son islem {lastMatchedStop.delivery_point_id} / {formatDistanceMeters(lastMatchedStop.distance_meters)} / {lastDeliveryUpdateCount} siparis
                  </Text>
                </View>
              ) : (
                <Text style={styles.overlayMeta}>Haritadaki duraga dokunup teslimati manuel onaylayabilirsin.</Text>
              )}

              <View style={styles.toggleRow}>
                <Pressable
                  style={[styles.miniPill, followDriver && styles.miniPillActive]}
                  onPress={() => setFollowDriver((previous) => !previous)}
                >
                  <MaterialCommunityIcons name="crosshairs-gps" size={16} color={followDriver ? "#fff" : colors.primary} />
                  <Text style={[styles.miniPillText, followDriver && styles.miniPillTextActive]}>
                    {followDriver ? "Surus modu acik" : "Surus modu kapali"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.miniPill}
                  onPress={() => {
                    if (currentCoordinate) {
                      animateToDriver(currentCoordinate);
                    } else if (isExpoGo && mapRef.current?.animateToRegion) {
                      mapRef.current.animateToRegion(mapRegion, 500);
                    } else if (cameraRef.current && isMapReady) {
                      cameraRef.current.setCamera({
                        centerCoordinate: toLngLat(mapRegion),
                        zoomLevel: zoomFromRegion(mapRegion),
                        animationDuration: 500,
                      });
                    }
                  }}
                >
                  <MaterialCommunityIcons name="map-search-outline" size={16} color={colors.primary} />
                  <Text style={styles.miniPillText}>Merkeze al</Text>
                </Pressable>

                {trafficTileUrl ? (
                  <Pressable
                    style={[styles.miniPill, showTrafficLayer && styles.miniPillActive]}
                    onPress={() => setShowTrafficLayer((previous) => !previous)}
                  >
                    <MaterialCommunityIcons
                      name="traffic-light-outline"
                      size={16}
                      color={showTrafficLayer ? "#fff" : colors.primary}
                    />
                    <Text style={[styles.miniPillText, showTrafficLayer && styles.miniPillTextActive]}>
                      {showTrafficLayer ? "Trafik acik" : "Trafik kapali"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={() => {
                    stopTracking();
                    setCurrentStep("selection");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Rotalara Don</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, trackingEnabled ? styles.dangerButton : styles.primaryButton]}
                  onPress={trackingEnabled ? stopTracking : startTracking}
                  disabled={startingTracking}
                >
                  {startingTracking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{trackingEnabled ? "Takibi Durdur" : "Takibi Baslat"}</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={[styles.bottomSheet, isSheetExpanded ? styles.bottomSheetExpanded : styles.bottomSheetCollapsed]}>
          <Pressable style={styles.sheetHandleButton} onPress={() => setIsSheetExpanded((previous) => !previous)}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetHandleLabel}>{isSheetExpanded ? "Listeyi kucult" : "Listeyi buyut"}</Text>
          </Pressable>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Durak Sirasi ve Siparisler</Text>
            <Text style={styles.sheetSubtitle}>Haritadan veya buradan teslimati onaylayabilirsin.</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            {routeStops.map((stop) => {
              const isLastMatched = String(lastMatchedStop?.delivery_point_id || "") === stop.id;
              const isCompleting = completingStopId === stop.id;

              return (
                <View key={stop.key} style={[styles.stopCard, isLastMatched && styles.stopCardHighlight, activeStopId === stop.id && styles.stopCardActive]}>
                  <View style={styles.stopHeader}>
                    <View style={styles.stopOrderBadge}>
                      <Text style={styles.stopOrderText}>{stop.order}</Text>
                    </View>
                    <View style={styles.stopHeaderText}>
                      <Text style={styles.stopTitle}>{stop.title}</Text>
                      <Text style={styles.stopMeta}>{stop.address}</Text>
                    </View>
                    <View style={styles.stopAside}>
                      <Text style={styles.stopAsideTop}>{stop.requestCount} siparis</Text>
                      <Text style={styles.stopAsideBottom}>{stop.visited ? formatVisitTime(stop.visitTime) : "Bekliyor"}</Text>
                    </View>
                  </View>

                  {stop.requests.length ? (
                    <View style={styles.requestList}>
                      {stop.requests.map((request) => (
                        <View key={request.key} style={styles.requestItem}>
                          <View style={styles.requestBullet} />
                          <View style={styles.requestTextWrap}>
                            <Text style={styles.requestTitle}>{request.summary}</Text>
                            <Text style={styles.requestMeta}>
                              Durum: {request.status}
                              {request.serviceTime != null ? ` / Servis ${request.serviceTime} sn` : ""}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.requestFallback}>Bu durak icin siparis detayi bulunamadi.</Text>
                  )}

                  <View style={styles.stopActions}>
                    <Pressable
                      style={[styles.stopActionButton, styles.focusButton]}
                      onPress={() => {
                        setActiveStopId(stop.id);
                        centerMapOnCoordinate(stop.coordinate);
                      }}
                    >
                      <Text style={styles.focusButtonText}>Haritada Ac</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.stopActionButton, styles.completeButton, (stop.visited || isCompleting) && styles.completeButtonDisabled]}
                      onPress={() => confirmCompleteStop(stop)}
                      disabled={stop.visited || isCompleting}
                    >
                      {isCompleting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.completeButtonText}>{stop.visited ? "Tamamlandi" : "Teslim Et"}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Paneli</Text>
        <Text style={styles.subtitle}>Rotalar varsayilan olarak en yeni tarihe gore siralandi.</Text>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          style={[styles.sortChip, sortOrder === "desc" && styles.sortChipActive]}
          onPress={() => setSortOrder("desc")}
        >
          <Text style={[styles.sortChipText, sortOrder === "desc" && styles.sortChipTextActive]}>En Yeni</Text>
        </Pressable>
        <Pressable
          style={[styles.sortChip, sortOrder === "asc" && styles.sortChipActive]}
          onPress={() => setSortOrder("asc")}
        >
          <Text style={[styles.sortChipText, sortOrder === "asc" && styles.sortChipTextActive]}>En Eski</Text>
        </Pressable>
      </View>

      <FlatList
        data={sortedRoutes}
        keyExtractor={(item, index) => getRouteKey(item, index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRoutes(true)} />}
        renderItem={({ item, index }) => {
          const routeKey = getRouteKey(item, index);
          const isSelected = selectedRouteId === routeKey;
          const stops = buildRouteStops(item);
          const firstStop = stops[0];

          return (
            <Pressable onPress={() => setSelectedRouteId(routeKey)} style={[styles.routeCard, isSelected && styles.routeCardSelected]}>
              <View style={styles.routeHeader}>
                <Text style={styles.routeName}>{item.name || item.id || "Isimsiz rota"}</Text>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>{stops.length} durak</Text>
                </View>
              </View>

              <Text style={styles.routeMeta}>Tarih: {resolveRouteTimestamp(item)}</Text>
              <Text style={styles.routeMeta}>Kaynak: {item.source || "-"}</Text>
              <Text style={styles.routePreview}>
                Ilk musteri: {firstStop ? `${firstStop.order}. ${firstStop.title}` : "Durak bilgisi yok"}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>Uygun rota bulunamadi.</Text>}
        contentContainerStyle={sortedRoutes.length ? styles.listContent : styles.emptyContainer}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueButton, !selectedRoute && styles.continueButtonDisabled]}
          onPress={() => setCurrentStep("map")}
          disabled={!selectedRoute}
        >
          <Text style={styles.continueButtonText}>Secilen rota ile devam et</Text>
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
    paddingHorizontal: 20,
  },
  infoText: {
    color: colors.muted,
    textAlign: "center",
  },
  mapWarningText: {
    marginTop: 10,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
  },
  toolbar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortChipText: {
    color: colors.text,
    fontWeight: "700",
  },
  sortChipTextActive: {
    color: "#fff",
  },
  routeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
    ...shadows.card,
  },
  routeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#f0fdfa",
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  routeName: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  routeBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  routeBadgeText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  routeMeta: {
    color: colors.muted,
    marginTop: 4,
  },
  routePreview: {
    color: colors.text,
    marginTop: 8,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 110,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    color: colors.muted,
  },
  footer: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 16,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: "center",
    ...shadows.card,
  },
  continueButtonDisabled: {
    opacity: 0.45,
  },
  continueButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  mapScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },
  topOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  topOverlayCollapsed: {
    paddingBottom: 10,
  },
  overlayHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  overlayHeaderActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  overlayHeaderText: {
    flex: 1,
  },
  overlayTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 18,
  },
  overlayMeta: {
    color: colors.muted,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
  },
  statusPillText: {
    color: colors.success,
    fontWeight: "800",
    fontSize: 12,
  },
  overlayToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collapsedOverlayHint: {
    color: colors.muted,
    marginTop: 6,
    fontWeight: "700",
  },
  matchPill: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  matchPillText: {
    flex: 1,
    color: colors.text,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  miniPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  miniPillText: {
    color: colors.primary,
    fontWeight: "700",
  },
  miniPillTextActive: {
    color: "#fff",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  warningButton: {
    marginTop: 18,
    maxWidth: 220,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -6,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  bottomSheetCollapsed: {
    height: "31%",
  },
  bottomSheetExpanded: {
    height: "48%",
  },
  sheetHandleButton: {
    alignItems: "center",
    paddingBottom: 6,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 8,
  },
  sheetHandleLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  sheetHeader: {
    marginBottom: 10,
  },
  sheetTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 18,
  },
  sheetSubtitle: {
    color: colors.muted,
    marginTop: 4,
  },
  sheetContent: {
    paddingBottom: 36,
    gap: 12,
  },
  stopCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  stopCardHighlight: {
    borderColor: colors.success,
    backgroundColor: "#f0fdf4",
  },
  stopCardActive: {
    borderColor: colors.primary,
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stopOrderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stopOrderText: {
    color: "#fff",
    fontWeight: "800",
  },
  stopHeaderText: {
    flex: 1,
  },
  stopTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  stopMeta: {
    color: colors.muted,
    marginTop: 3,
  },
  stopAside: {
    alignItems: "flex-end",
  },
  stopAsideTop: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  stopAsideBottom: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  requestList: {
    marginTop: 12,
    gap: 10,
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  requestBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 6,
  },
  requestTextWrap: {
    flex: 1,
  },
  requestTitle: {
    color: colors.text,
    fontWeight: "700",
  },
  requestMeta: {
    color: colors.muted,
    marginTop: 2,
  },
  requestFallback: {
    marginTop: 12,
    color: colors.muted,
  },
  stopActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  stopActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  focusButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  focusButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  completeButton: {
    backgroundColor: colors.success,
  },
  completeButtonDisabled: {
    opacity: 0.55,
  },
  completeButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  pinWrap: {
    alignItems: "center",
  },
  pinWrapActive: {
    transform: [{ scale: 1.08 }],
  },
  pinBody: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
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
  pinBodyDriver: {
    backgroundColor: "#dc2626",
  },
  pinBodyVisited: {
    backgroundColor: colors.success,
  },
  pinBodyStop: {
    backgroundColor: colors.primary,
  },
  pinLabel: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 11,
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
  pinTailDriver: {
    borderTopColor: "#dc2626",
  },
  pinTailVisited: {
    borderTopColor: colors.success,
  },
  pinTailStop: {
    borderTopColor: colors.primary,
  },
  mapMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  depotMarker: {
    backgroundColor: colors.text,
  },
  endMarker: {
    backgroundColor: colors.accent,
  },
  driverMarker: {
    backgroundColor: colors.danger,
  },
  visitedMarker: {
    backgroundColor: colors.success,
  },
  activeMarker: {
    transform: [{ scale: 1.12 }],
  },
  markerText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
});
