import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { driverTrackingApi, routesApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

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

function resolveRouteTimestamp(route) {
  const rawValue =
    route?.timestamp ||
    route?.created_at ||
    route?.updated_at ||
    route?.createdAt ||
    route?.inserted_at;

  if (!rawValue) return "-";
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return String(rawValue);
  return parsed.toLocaleString("tr-TR");
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
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastMatchedStop, setLastMatchedStop] = useState(null);
  const [lastDeliveryUpdateCount, setLastDeliveryUpdateCount] = useState(0);
  const canUseDriverPanel = ["driver", "admin"].includes(user?.role);
  const mapRef = useRef(null);
  const locationSubscriptionRef = useRef(null);
  const lastPublishedAtRef = useRef(0);

  const loadRoutes = useCallback(
    async (isRefresh = false) => {
      if (!canUseDriverPanel) return;

      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await routesApi.list({ token });
        const nextRoutes = Array.isArray(response?.routes) ? response.routes : [];
        setRoutes(nextRoutes);
        if (selectedRouteId && !nextRoutes.some((route, index) => String(route.id || index) === selectedRouteId)) {
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

  const selectedRoute = useMemo(
    () => routes.find((route, index) => String(route.id || index) === selectedRouteId) || null,
    [routes, selectedRouteId]
  );
  const routeCoordinates = useMemo(() => buildRoutePath(selectedRoute), [selectedRoute]);
  const mapRegion = useMemo(() => getMapRegion(routeCoordinates), [routeCoordinates]);

  useEffect(() => {
    setLastMatchedStop(null);
    setLastDeliveryUpdateCount(0);
  }, [selectedRouteId]);

  const stopTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setTrackingEnabled(false);
  }, []);

  const publishLocation = useCallback(
    async (location) => {
      if (!selectedRoute || !token) return;

      const now = Date.now();
      if (now - lastPublishedAtRef.current < 4000) return;
      lastPublishedAtRef.current = now;
      setPublishing(true);

      try {
        const basePayload = {
          driver_id: user?.user_id || user?.email,
          driver_name: user?.full_name,
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
        }
      } catch (error) {
        console.warn("Driver location publish failed:", error?.message || error);
      } finally {
        setPublishing(false);
      }
    },
    [selectedRoute, token, user]
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

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(current);
      await publishLocation(current);

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (nextLocation) => {
          setCurrentLocation(nextLocation);
          await publishLocation(nextLocation);
        }
      );

      setTrackingEnabled(true);
    } catch (error) {
      Alert.alert("Konum takibi baslatilamadi", error.message);
    } finally {
      setStartingTracking(false);
    }
  }, [publishLocation, selectedRoute]);

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
    if (currentStep !== "map" || !routeCoordinates.length || !mapRef.current) return;
    mapRef.current.animateToRegion(mapRegion, 500);
  }, [currentStep, mapRegion, routeCoordinates]);

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
    const deliveryPoints = Array.isArray(selectedRoute.delivery_points) ? selectedRoute.delivery_points : [];

    return (
      <View style={styles.mapScreen}>
        <MapView ref={mapRef} style={styles.map} initialRegion={mapRegion}>
          {routeCoordinates.length > 1 ? (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="rgba(15, 118, 110, 0.42)"
              strokeWidth={6}
            />
          ) : null}

          {startCoordinate ? (
            <Marker coordinate={startCoordinate} title="Baslangic">
              <View style={[styles.mapMarker, styles.depotMarker]}>
                <MaterialCommunityIcons name="warehouse" size={16} color="#fff" />
              </View>
            </Marker>
          ) : null}

          {deliveryPoints.map((point, index) => {
            const coordinate = getCoordinate(point);
            if (!coordinate) return null;

            return (
              <Marker
                key={`${point.id || "delivery"}-${index}`}
                coordinate={coordinate}
                title={String(point?.id || `Teslimat ${index + 1}`)}
                description={`Sira: ${index + 1}`}
              >
                <View style={styles.mapMarker}>
                  <Text style={styles.markerText}>{index + 1}</Text>
                </View>
              </Marker>
            );
          })}

          {endCoordinate ? (
            <Marker coordinate={endCoordinate} title="Bitis">
              <View style={[styles.mapMarker, styles.endMarker]}>
                <MaterialCommunityIcons name="flag-checkered" size={16} color="#fff" />
              </View>
            </Marker>
          ) : null}

          {currentLocation?.coords ? (
            <Marker
              coordinate={{
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              }}
              title="Anlik Konum"
            >
              <View style={[styles.mapMarker, styles.driverMarker]}>
                <MaterialCommunityIcons name="truck-fast" size={16} color="#fff" />
              </View>
            </Marker>
          ) : null}
        </MapView>

        <View style={styles.overlayCard}>
          <Text style={styles.overlayTitle}>{selectedRoute.name || "Secili rota"}</Text>
          <Text style={styles.overlayMeta}>
            {deliveryPoints.length} teslimat noktasi | {resolveRouteTimestamp(selectedRoute)}
          </Text>
          <Text style={styles.overlayMeta}>
            Takip: {trackingEnabled ? "Acik" : "Kapali"} {publishing ? "| Yayinlaniyor" : ""}
          </Text>
          {lastMatchedStop ? (
            <Text style={styles.overlayMeta}>
              Son eslesen nokta: {lastMatchedStop.delivery_point_id} | {lastMatchedStop.distance_meters} m | {lastDeliveryUpdateCount} siparis guncellendi
            </Text>
          ) : null}

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
                <Text style={styles.primaryButtonText}>
                  {trackingEnabled ? "Takibi Durdur" : "Takibi Baslat"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Paneli</Text>
        <Text style={styles.subtitle}>Bir rota secip harita ve GPS takibini baslat.</Text>
      </View>

      <FlatList
        data={routes}
        keyExtractor={(item, index) => String(item.id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRoutes(true)} />}
        renderItem={({ item, index }) => {
          const routeKey = String(item.id || index);
          const isSelected = selectedRouteId === routeKey;

          return (
            <Pressable
              onPress={() => setSelectedRouteId(routeKey)}
              style={[styles.routeCard, isSelected && styles.routeCardSelected]}
            >
              <View style={styles.routeHeader}>
                <Text style={styles.routeName}>{item.name || item.id || "Isimsiz rota"}</Text>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>{(item.delivery_points || []).length} nokta</Text>
                </View>
              </View>
              <Text style={styles.routeMeta}>ID: {item.id || "-"}</Text>
              <Text style={styles.routeMeta}>Tarih: {resolveRouteTimestamp(item)}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>Uygun rota bulunamadi.</Text>}
        contentContainerStyle={routes.length ? styles.listContent : styles.emptyContainer}
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
  overlayCard: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
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
  markerText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
});
