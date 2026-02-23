import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, radii, shadows } from "../../theme";
import { MapUtils } from "./mapUtils";

const ROUTE_COLORS = ["#ef4444", "#0ea5e9", "#22c55e", "#8b5cf6", "#f59e0b", "#14b8a6", "#f97316"];

const MAP_LAYERS = {
  default: { label: "Default", urlTemplate: "" },
  cartoLight: { label: "Carto Light", urlTemplate: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" },
  cartoDark: { label: "Carto Dark", urlTemplate: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" },
};

function toCoordinate(location) {
  if (!location) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function dedupeCoordinates(coords) {
  const deduped = [];
  coords.forEach((coord) => {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.latitude !== coord.latitude || prev.longitude !== coord.longitude) {
      deduped.push(coord);
    }
  });
  return deduped;
}

function mapWaypoints(waypoints) {
  if (!Array.isArray(waypoints)) return [];
  return waypoints
    .map((waypoint) => toCoordinate(waypoint?.location))
    .filter(Boolean);
}

function formatStat(value, suffix) {
  const num = Number(value);
  if (!Number.isFinite(num)) return `0 ${suffix}`;
  return `${num.toFixed(2)} ${suffix}`;
}

function buildRouteGeometry(route) {
  const polylineCoordinates = [];
  const segments = [];
  const startCoordinate = toCoordinate(route?.start_point?.location);
  const endCoordinate = toCoordinate(route?.end_point?.location);
  const deliveryPointsRaw = route?.delivery_points || [];

  const deliveryPoints = deliveryPointsRaw.map((point, deliveryIndex) => ({
    point,
    deliveryIndex,
    coordinate: toCoordinate(point?.location),
    type: MapUtils.determinePointType(point),
  }));

  const nodes = [];
  if (startCoordinate) {
    nodes.push({
      type: "start",
      coordinate: startCoordinate,
      point: route?.start_point,
      waypoints: route?.start_point?.waypoints,
    });
  }
  deliveryPoints.forEach((delivery) => {
    if (delivery.coordinate) {
      nodes.push({
        type: "delivery",
        coordinate: delivery.coordinate,
        point: delivery.point,
        waypoints: delivery.point?.waypoints,
      });
    }
  });
  if (endCoordinate) {
    nodes.push({
      type: "end",
      coordinate: endCoordinate,
      point: route?.end_point,
      waypoints: [], // end_point waypointleri bilerek kullanilmiyor.
    });
  }

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const current = nodes[i];
    const next = nodes[i + 1];
    const segmentWaypoints = current.type === "end" ? [] : mapWaypoints(current.waypoints);
    const segmentCoords = dedupeCoordinates([current.coordinate, ...segmentWaypoints, next.coordinate]);
    if (segmentCoords.length > 1) {
      segments.push(segmentCoords);
      if (polylineCoordinates.length === 0) {
        polylineCoordinates.push(...segmentCoords);
      } else {
        polylineCoordinates.push(...segmentCoords.slice(1));
      }
    }
  }

  return {
    polylineCoordinates,
    segments,
    startCoordinate,
    endCoordinate,
    deliveryPoints,
  };
}

export default function RoutingResultsView({ results, onReset }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [layerPanelVisible, setLayerPanelVisible] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState("default");

  const routes = results?.routes?.routes || [];
  const stats = results?.stats || {};

  const routeGeometries = useMemo(() => routes.map((route) => buildRouteGeometry(route)), [routes]);

  const initialRegion = useMemo(() => {
    const firstGeometry = routeGeometries[0];
    if (firstGeometry?.startCoordinate) {
      return {
        ...firstGeometry.startCoordinate,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 39.75,
      longitude: 30.48,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }, [routeGeometries]);

  const selectedCoordinate = toCoordinate(selectedPoint?.point?.location);
  const customerRequests = selectedPoint?.point?.node_detail?.customer?.requests;
  const loadInformation = customerRequests?.load_information || null;
  const requestQuantity = customerRequests?.quantity ?? loadInformation?.quantity ?? null;
  const unitWeight = loadInformation?.weight ?? null;
  const computedLoadKg =
    Number.isFinite(Number(requestQuantity)) && Number.isFinite(Number(unitWeight))
      ? (Number(requestQuantity) * Number(unitWeight)).toFixed(2)
      : null;

  const openPointModal = (point, type, id, index, routeIndex) => {
    setSelectedPoint({ point, type, id, index, routeIndex });
    setModalVisible(true);
  };

  const renderMarkerView = (type, visited) => (
    <View
      style={[
        styles.marker,
        {
          borderColor: visited ? colors.success : MapUtils.getPointTypeColor(type),
          borderWidth: visited ? 3 : 2,
        },
      ]}
    >
      <MaterialCommunityIcons name={MapUtils.getPointTypeIcon(type)} size={18} color={MapUtils.getPointTypeColor(type)} />
      {visited ? (
        <View style={styles.visitedBadge}>
          <MaterialCommunityIcons name="check" size={10} color="#ffffff" />
        </View>
      ) : null}
    </View>
  );

  const activeLayerConfig = MAP_LAYERS[selectedLayer] || MAP_LAYERS.default;

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          mapType={selectedLayer === "default" ? "standard" : Platform.OS === "android" ? "none" : "standard"}
        >
          {selectedLayer !== "default" ? (
            <UrlTile
              urlTemplate={activeLayerConfig.urlTemplate}
              maximumZ={20}
              shouldReplaceMapContent={Platform.OS === "ios"}
              zIndex={0}
            />
          ) : null}

          {routeGeometries.map((geometry, routeIndex) => {
            const routeColor = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];

            return (
              <React.Fragment key={`route-${routeIndex}`}>
                {geometry.segments.map((segmentCoordinates, segmentIndex) => {
                  return (
                    <React.Fragment key={`route-${routeIndex}-segment-${segmentIndex}`}>
                      <Polyline coordinates={segmentCoordinates} strokeColor={routeColor} strokeWidth={4} />
                    </React.Fragment>
                  );
                })}

                {geometry.startCoordinate ? (
                  <Marker
                    coordinate={geometry.startCoordinate}
                    onPress={() =>
                      openPointModal(
                        routes[routeIndex]?.start_point,
                        "start",
                        routes[routeIndex]?.start_point?.id || "Depot",
                        0,
                        routeIndex
                      )
                    }
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    {renderMarkerView("start", routes[routeIndex]?.start_point?.visited)}
                  </Marker>
                ) : null}

                {geometry.deliveryPoints.map((delivery) =>
                  delivery.coordinate ? (
                    <Marker
                      key={`route-${routeIndex}-delivery-${delivery.deliveryIndex}`}
                      coordinate={delivery.coordinate}
                      onPress={() =>
                        openPointModal(delivery.point, delivery.type, delivery.point?.id, delivery.deliveryIndex + 1, routeIndex)
                      }
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      {renderMarkerView(delivery.type, delivery.point?.visited)}
                    </Marker>
                  ) : null
                )}

                {geometry.endCoordinate ? (
                  <Marker
                    coordinate={geometry.endCoordinate}
                    onPress={() =>
                      openPointModal(
                        routes[routeIndex]?.end_point,
                        "end",
                        routes[routeIndex]?.end_point?.id || "Depot",
                        0,
                        routeIndex
                      )
                    }
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    {renderMarkerView("end", routes[routeIndex]?.end_point?.visited)}
                  </Marker>
                ) : null}
              </React.Fragment>
            );
          })}
        </MapView>

        <View style={styles.layerControlWrap}>
          <Pressable style={styles.layerButton} onPress={() => setLayerPanelVisible((prev) => !prev)}>
            <MaterialCommunityIcons name="layers-triple" size={18} color="#ffffff" />
            <Text style={styles.layerButtonText}>Katmanlar</Text>
          </Pressable>

          {layerPanelVisible ? (
            <View style={styles.layerPanel}>
              <Text style={styles.layerTitle}>Harita Katmani</Text>
              <View style={styles.layerOptionRow}>
                {Object.keys(MAP_LAYERS).map((layerKey) => {
                  const isActive = selectedLayer === layerKey;
                  return (
                    <Pressable
                      key={layerKey}
                      style={[styles.layerOption, isActive && styles.layerOptionActive]}
                      onPress={() => setSelectedLayer(layerKey)}
                    >
                      <Text style={[styles.layerOptionText, isActive && styles.layerOptionTextActive]}>
                        {MAP_LAYERS[layerKey].label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.bottomSheet}>
        <Text style={styles.title}>Rotalama Sonucu</Text>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mesafe</Text>
            <Text style={styles.statValue}>{formatStat(stats.distance, "km")}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Sure</Text>
            <Text style={styles.statValue}>{formatStat(stats.duration, "dk")}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Enerji</Text>
            <Text style={styles.statValue}>{formatStat(stats.energy, "kWh")}</Text>
          </View>
        </View>
        <Pressable style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetText}>Yeni Rotalama</Text>
        </Pressable>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                {selectedPoint ? (
                  <>
                    <Text style={styles.modalTitle}>
                      {selectedPoint.type.toUpperCase()}
                      {selectedPoint.index > 0 ? ` ${selectedPoint.index}` : ""}
                    </Text>
                    <Text style={styles.modalSubtitle}>Rota {selectedPoint.routeIndex + 1}</Text>
                    <ScrollView style={styles.modalBody}>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>ID</Text>
                        <Text style={styles.modalValue}>{selectedPoint.id || "-"}</Text>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Koordinat</Text>
                        <Text style={styles.modalValue}>
                          {selectedCoordinate
                            ? `${selectedCoordinate.latitude.toFixed(5)}, ${selectedCoordinate.longitude.toFixed(5)}`
                            : "-"}
                        </Text>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Ziyaret</Text>
                        <Text style={styles.modalValue}>{selectedPoint.point?.visited ? "Evet" : "Hayir"}</Text>
                      </View>
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>Ziyaret Saati</Text>
                        <Text style={styles.modalValue}>{MapUtils.formatVisitTime(selectedPoint.point?.visit_time)}</Text>
                      </View>

                      {customerRequests ? (
                        <>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Urun</Text>
                            <Text style={styles.modalValue}>{customerRequests.product_name || customerRequests.product_id || "-"}</Text>
                          </View>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Talep (Adet)</Text>
                            <Text style={styles.modalValue}>{requestQuantity ?? "-"}</Text>
                          </View>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Birim Agirlik</Text>
                            <Text style={styles.modalValue}>
                              {unitWeight !== null && unitWeight !== undefined ? `${unitWeight} kg` : "-"}
                            </Text>
                          </View>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Toplam Yuk</Text>
                            <Text style={styles.modalValue}>{computedLoadKg ? `${computedLoadKg} kg` : "-"}</Text>
                          </View>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Ready Time</Text>
                            <Text style={styles.modalValue}>{customerRequests.ready_time ?? "-"}</Text>
                          </View>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Due Date</Text>
                            <Text style={styles.modalValue}>{customerRequests.due_date ?? "-"}</Text>
                          </View>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Service Time</Text>
                            <Text style={styles.modalValue}>{customerRequests.service_time ?? "-"}</Text>
                          </View>
                        </>
                      ) : null}
                    </ScrollView>
                    <Pressable style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                      <Text style={styles.modalCloseText}>Kapat</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapWrap: {
    flex: 2,
  },
  map: {
    flex: 1,
  },
  layerControlWrap: {
    position: "absolute",
    right: 12,
    top: 12,
    alignItems: "flex-end",
  },
  layerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.84)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  layerButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  layerPanel: {
    marginTop: 8,
    width: 260,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    ...shadows.card,
  },
  layerTitle: {
    color: colors.text,
    fontWeight: "800",
    marginBottom: 8,
  },
  layerOptionRow: {
    gap: 6,
  },
  layerOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  layerOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  layerOptionText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 12,
  },
  layerOptionTextActive: {
    color: "#ffffff",
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 15,
  },
  resetButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  resetText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  marker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  visitedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  modalTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 20,
    textAlign: "center",
  },
  modalSubtitle: {
    textAlign: "center",
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10,
  },
  modalBody: {
    maxHeight: 320,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalLabel: {
    color: colors.muted,
    width: "38%",
  },
  modalValue: {
    color: colors.text,
    flex: 1,
    textAlign: "right",
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.text,
    alignItems: "center",
    paddingVertical: 11,
  },
  modalCloseText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
