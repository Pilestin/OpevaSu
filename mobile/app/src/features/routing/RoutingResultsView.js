import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { colors, radii, shadows } from "../../theme";
import { MapUtils } from "./mapUtils";

const ROUTE_COLORS = ["#ef4444", "#0ea5e9", "#22c55e", "#8b5cf6", "#f59e0b", "#14b8a6", "#f97316"];

function toCoordinate(location) {
  if (!location) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function addWaypoints(collection, waypoints) {
  if (!Array.isArray(waypoints)) return;
  const limit = waypoints.length > 2 ? waypoints.length - 2 : 0;
  waypoints.slice(0, limit).forEach((waypoint) => {
    const coordinate = toCoordinate(waypoint?.location);
    if (coordinate) collection.push(coordinate);
  });
}

function formatStat(value, suffix) {
  const num = Number(value);
  if (!Number.isFinite(num)) return `0 ${suffix}`;
  return `${num.toFixed(2)} ${suffix}`;
}

export default function RoutingResultsView({ results, onReset }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const routes = results?.routes?.routes || [];
  const stats = results?.stats || {};

  const initialRegion = useMemo(() => {
    const first = routes[0];
    const firstCoordinate = toCoordinate(first?.start_point?.location);
    if (firstCoordinate) {
      return {
        ...firstCoordinate,
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
  }, [routes]);

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
      <Text style={styles.markerText}>{MapUtils.getPointTypeLabel(type)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={initialRegion}>
          {routes.map((route, routeIndex) => {
            const polylineCoordinates = [];
            const startCoordinate = toCoordinate(route?.start_point?.location);
            const endCoordinate = toCoordinate(route?.end_point?.location);

            if (startCoordinate) {
              polylineCoordinates.push(startCoordinate);
              addWaypoints(polylineCoordinates, route?.start_point?.waypoints);
            }

            const deliveryMarkers = (route?.delivery_points || []).map((point, deliveryIndex) => {
              addWaypoints(polylineCoordinates, point?.waypoints);
              const coordinate = toCoordinate(point?.location);
              if (coordinate) {
                polylineCoordinates.push(coordinate);
              }
              const pointType = MapUtils.determinePointType(point);
              if (!coordinate) return null;
              return (
                <Marker
                  key={`route-${routeIndex}-delivery-${deliveryIndex}`}
                  coordinate={coordinate}
                  onPress={() => openPointModal(point, pointType, point?.id, deliveryIndex + 1, routeIndex)}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  {renderMarkerView(pointType, point?.visited)}
                </Marker>
              );
            });

            if (endCoordinate) {
              polylineCoordinates.push(endCoordinate);
            }

            return (
              <React.Fragment key={`route-${routeIndex}`}>
                {polylineCoordinates.length > 1 ? (
                  <Polyline
                    coordinates={polylineCoordinates}
                    strokeColor={ROUTE_COLORS[routeIndex % ROUTE_COLORS.length]}
                    strokeWidth={4}
                  />
                ) : null}
                {startCoordinate ? (
                  <Marker
                    coordinate={startCoordinate}
                    onPress={() => openPointModal(route?.start_point, "start", "Depot", 0, routeIndex)}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    {renderMarkerView("start", route?.start_point?.visited)}
                  </Marker>
                ) : null}
                {deliveryMarkers}
                {endCoordinate ? (
                  <Marker
                    coordinate={endCoordinate}
                    onPress={() => openPointModal(route?.end_point, "end", "Depot", 0, routeIndex)}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    {renderMarkerView("end", route?.end_point?.visited)}
                  </Marker>
                ) : null}
              </React.Fragment>
            );
          })}
        </MapView>
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
                          {toCoordinate(selectedPoint.point?.location)
                            ? `${toCoordinate(selectedPoint.point?.location).latitude.toFixed(5)}, ${toCoordinate(
                                selectedPoint.point?.location
                              ).longitude.toFixed(5)}`
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
                      {selectedPoint.point?.node_detail?.customer?.requests ? (
                        <>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Talep</Text>
                            <Text style={styles.modalValue}>
                              {selectedPoint.point.node_detail.customer.requests.quantity || "-"}
                            </Text>
                          </View>
                          <View style={styles.modalRow}>
                            <Text style={styles.modalLabel}>Yuk</Text>
                            <Text style={styles.modalValue}>
                              {selectedPoint.point.node_detail.customer.requests.load_information?.quantity || "-"}
                            </Text>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  markerText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
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
    width: "35%",
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
