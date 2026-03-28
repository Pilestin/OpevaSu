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

    return (
      <View style={styles.mapScreen}>
        <MapView ref={mapRef} style={styles.map} initialRegion={mapRegion}>
          {routeCoordinates.length > 1 ? (
            <Polyline coordinates={routeCoordinates} strokeColor="rgba(15, 118, 110, 0.32)" strokeWidth={7} />
          ) : null}

          {startCoordinate ? (
            <Marker coordinate={startCoordinate} title="Baslangic">
              <View style={[styles.mapMarker, styles.depotMarker]}>
                <MaterialCommunityIcons name="warehouse" size={16} color="#fff" />
              </View>
            </Marker>
          ) : null}

          {routeStops.map((stop) => {
            if (!stop.coordinate) return null;
            return (
              <Marker
                key={stop.key}
                coordinate={stop.coordinate}
                title={`${stop.order}. ${stop.title}`}
                description={`${stop.address} | ${stop.requestCount} siparis`}
              >
                <View style={[styles.mapMarker, stop.visited && styles.visitedMarker]}>
                  <Text style={styles.markerText}>{stop.order}</Text>
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

        <View style={styles.topOverlay}>
          <View style={styles.overlayHeaderRow}>
            <View style={styles.overlayHeaderText}>
              <Text style={styles.overlayTitle}>{selectedRoute.name || "Secili rota"}</Text>
              <Text style={styles.overlayMeta}>
                {routeStops.length} durak / {resolveRouteTimestamp(selectedRoute)}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{trackingEnabled ? "GPS Acik" : "GPS Kapali"}</Text>
            </View>
          </View>

          {lastMatchedStop ? (
            <View style={styles.matchPill}>
              <MaterialCommunityIcons name="map-marker-check" size={16} color={colors.success} />
              <Text style={styles.matchPillText}>
                Son eslesme {lastMatchedStop.delivery_point_id} / {formatDistanceMeters(lastMatchedStop.distance_meters)} / {lastDeliveryUpdateCount} siparis
              </Text>
            </View>
          ) : (
            <Text style={styles.overlayMeta}>Rota cizildi. Alttan durak sirasi ve siparisleri gorebilirsiniz.</Text>
          )}

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
        </View>

        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Durak Sirasi ve Siparisler</Text>
            <Text style={styles.sheetSubtitle}>Harita acik kalir; siradaki kullanicilari ve siparislerini buradan takip edebilirsin.</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            {routeStops.map((stop) => {
              const isLastMatched = String(lastMatchedStop?.delivery_point_id || "") === stop.id;

              return (
                <View key={stop.key} style={[styles.stopCard, isLastMatched && styles.stopCardHighlight]}>
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
  overlayHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
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
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 10,
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
  markerText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },
});
