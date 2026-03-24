import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, Pressable, ActivityIndicator, Alert, Dimensions, ScrollView } from "react-native";
import MapView, { Marker, Callout, Polyline } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors, radii, shadows } from "../theme";

const VEHICLES_API_URL = "http://157.230.17.89:3001/api/vehicles/locations/fiware";
const ROUTES_API_URL = "http://157.230.17.89:3001/api/routes";
const POLLING_INTERVAL = 5000; // Increased interval for backend optimization

const TRACKABLE_VEHICLES = ["musoshi001", "musoshi004", "musoshi006"];

export default function FleetScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [vehicles, setVehicles] = useState([]);
  const [routesData, setRoutesData] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState(["musoshi001", "musoshi004", "musoshi006"]);
  
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const mapRef = useRef(null);

  useEffect(() => {
    if (isAdmin) {
      fetchRoutes();
    }
  }, [isAdmin]);

  useEffect(() => {
    let intervalId;
    if (isTracking) {
      fetchVehicles();
      intervalId = setInterval(fetchVehicles, POLLING_INTERVAL);
    } else {
      clearInterval(intervalId);
    }
    return () => clearInterval(intervalId);
  }, [isTracking]);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const res = await fetch(ROUTES_API_URL);
      if (res.ok) {
        const data = await res.json();
        // Sayet array degil de obje geldiyse array'e ceviriyoruz
        const routesArray = Array.isArray(data) ? data : (data ? [data] : []);
        // Ekrana cok yuku olmasin diye en guncel 5 rotayi baz alabiliriz veya hepsini cizeriz
        // Su anlik en son eklenenleri gostermek (veya hepsini) amaciyla tersten siralayip ilk 5'i alacagiz (Opsiyonel)
        setRoutesData(routesArray.slice(-5)); 
      }
    } catch (err) {
      console.warn("Rotalar cekilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await fetch(VEHICLES_API_URL);
      if (!response.ok) return;
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // Backend bazi durumlarda enlem(39) ve boylam(30) degerlerini ters atmis olabilir, ayarliyoruz
        const parseCoordinate = (lat, lng) => {
          let parsedLat = Number(lat);
          let parsedLng = Number(lng);
          // Eger lat 30 ile basliyorsa ve lng 39 ise (Turkiye icin) bunlari degistir
          if (parsedLat < 35 && parsedLng > 35) {
            const temp = parsedLat;
            parsedLat = parsedLng;
            parsedLng = temp;
          }
          return { lat: parsedLat, lng: parsedLng };
        };

        const mappedVehicles = data.map(v => {
          const coords = parseCoordinate(v.latitude, v.longitude);
          
          // Completed delivery points string bir JSON gibi geliyor. "[\"101\", \"102\"]" veya "[{\"order_id\":\"115\"}]"
          let parsedCompleted = [];
          if (typeof v.completed_delivery_points === 'string') {
            try {
              const parsed = JSON.parse(v.completed_delivery_points);
              // Eger icinde { order_id: "..." } formatindaysa:
              parsedCompleted = parsed.map(item => typeof item === 'object' ? String(item.order_id) : String(item));
            } catch (e) {
              parsedCompleted = [];
            }
          } else if (Array.isArray(v.completed_delivery_points)) {
            parsedCompleted = v.completed_delivery_points.map(String);
          }

          return {
            ...v,
            latitude: coords.lat,
            longitude: coords.lng,
            completed_points_array: parsedCompleted
          };
        });

        // unique vehicles yapalim
        const uniqueVehicles = Object.values(
          mappedVehicles.reduce((acc, curr) => {
            acc[curr.vehicle_id] = curr;
            return acc;
          }, {})
        );
        
        setVehicles(uniqueVehicles);
      }
    } catch (error) {
      console.error("Arac verisi cekilemedi:", error);
    }
  };

  const toggleTracking = () => setIsTracking((prev) => !prev);

  const toggleFilter = (vid) => {
    setSelectedVehicles(prev => 
      prev.includes(vid) ? prev.filter(x => x !== vid) : [...prev, vid]
    );
  };

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Bu alan sadece admin kullanicilar icin.</Text>
      </View>
    );
  }

  // Eskisehir merkez
  const initialRegion = {
    latitude: 39.75,
    longitude: 30.48,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  // Secili araclara gore filtrele
  const filteredVehicles = vehicles.filter(v => selectedVehicles.includes(v.vehicle_id));

  // O secili aracin tamamladigi musterileri set olarak tut
  const allCompletedPoints = new Set();
  filteredVehicles.forEach(v => {
    v.completed_points_array?.forEach(point => allCompletedPoints.add(point));
  });

  return (
    <View style={styles.container}>
      {/* 
        Sadece arac id'si secili olanlarin verilerini ciziyor.
        NOT: Eger Rota verisi (routesData) aracin ID'si ile eslesiyorsa sadece onlari cizebiliriz.
        Fakat route API'sinde arac ID bilgisi her zaman acik olmayabiliyor (ornegin "ev_route_0_...").
        Simdilik var olan route'larin hepsini cizmeye karar verdik. Isterseniz sadece 1 tanesini de cizdirebilirsiniz.
      */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
      >
        {routesData.map((route, rIndex) => {
          // --- 1. Rota Cizgi (Polyline) Parcalanmis (Segments) ---
          const mapWp = (wps) => {
            if (!wps || !Array.isArray(wps)) return [];
            return wps.map(w => {
              let lat = Number(w?.location?.latitude || w?.lat || w?.[0]);
              let lng = Number(w?.location?.longitude || w?.lng || w?.[1]);
              return { latitude: lat, longitude: lng };
            }).filter(c => !isNaN(c.latitude) && !isNaN(c.longitude));
          };

          let segments = [];
          const dps = route.delivery_points || [];

          if (route.start_point?.waypoints?.length > 0) {
            let targetId = dps.length > 0 ? String(dps[0].id || dps[0].customer_id || "0") : 'END';
            let isTraveled = targetId !== 'END' ? allCompletedPoints.has(targetId) : false;
            segments.push({ isTraveled, coords: mapWp(route.start_point.waypoints) });
          }

          for (let i = 0; i < dps.length; i++) {
            let dp = dps[i];
            if (dp.waypoints && dp.waypoints.length > 0) {
              let nextId = (i + 1 < dps.length) ? String(dps[i+1].id || dps[i+1].customer_id || String(i+1)) : 'END';
              let isTraveled = nextId !== 'END' ? allCompletedPoints.has(nextId) : false;
              segments.push({ isTraveled, coords: mapWp(dp.waypoints) });
            }
          }

          if (route.end_point?.waypoints?.length > 0) {
            segments.push({ isTraveled: false, coords: mapWp(route.end_point.waypoints) });
          }

          return (
            <React.Fragment key={`route-group-${rIndex}`}>
              {/* --- Rota Cizgileri --- */}
              {segments.map((seg, sIdx) => {
                if (!seg.coords || seg.coords.length === 0) return null;
                return (
                  <Polyline
                    key={`route-${rIndex}-seg-${sIdx}`}
                    coordinates={seg.coords}
                    strokeColor={seg.isTraveled ? colors.success : colors.primary}
                    strokeWidth={seg.isTraveled ? 5 : 3}
                    lineDashPattern={seg.isTraveled ? null : [2, 4]} // Gidilmemis yollar kesikli, gidilenler cizgili
                  />
                );
              })}

              {/* --- 2. Depo Pini (Start / End Point) --- */}
              {route.start_point && (
                <Marker
                  coordinate={{
                    latitude: Number(route.start_point.lat || route.start_point.latitude || route.start_point[0] || route.start_point.location?.latitude),
                    longitude: Number(route.start_point.lng || route.start_point.longitude || route.start_point[1] || route.start_point.location?.longitude)
                  }}
                  title={`Depo (Baslangic)`}
                  zIndex={900}
                >
                  <View style={[styles.nodeMarker, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                    <MaterialCommunityIcons name="store" size={16} color={colors.primary} />
                  </View>
                </Marker>
              )}

              {/* --- 3. Musteri Duraklari (Delivery Points) --- */}
              {Array.isArray(route.delivery_points) && route.delivery_points.map((dp, dIndex) => {
                const pointId = String(dp.id || dp.customer_id || dIndex);
                const isDelivered = allCompletedPoints.has(pointId);
                
                // Location map
                let dLat = dp.lat || dp.latitude || dp[0];
                let dLng = dp.lng || dp.longitude || dp[1];
                if (dp.location && typeof dp.location === 'object') {
                  dLat = dp.location.latitude;
                  dLng = dp.location.longitude;
                } else if (typeof dp.location === 'string') {
                   // "{latitude=39.7; longitude=30.4}" stringi parse
                   const ltMatch = dp.location.match(/latitude=([\d\.]+)/);
                   const lgMatch = dp.location.match(/longitude=([\d\.]+)/);
                   if (ltMatch) dLat = parseFloat(ltMatch[1]);
                   if (lgMatch) dLng = parseFloat(lgMatch[1]);
                }
                
                return dLat && dLng ? (
                  <Marker
                    key={`dp-${pointId}-${dIndex}-${rIndex}`}
                    coordinate={{ latitude: Number(dLat), longitude: Number(dLng) }}
                    title={`Müşteri: ${pointId}`}
                    description={isDelivered ? "Teslim Edildi" : "Bekliyor"}
                    zIndex={800}
                  >
                    <View style={[
                      styles.nodeMarker, 
                      isDelivered ? styles.nodeDelivered : styles.nodePending
                    ]}>
                      <MaterialCommunityIcons 
                        name={isDelivered ? "check-circle" : "clock-time-four"} 
                        size={16} 
                        color="#fff" 
                      />
                    </View>
                  </Marker>
                ) : null;
              })}
            </React.Fragment>
          );
        })}

        {/* --- 4. Araclarin Guncel Konumlari --- */}
        {filteredVehicles.map((v) => {
          if (!v.latitude || !v.longitude) return null;
          const isReal = v.vehicle_type === "REAL" || v.vehicle_id.includes("musoshi");
          return (
            <Marker
              key={`veh-${v.vehicle_id}`}
              coordinate={{ latitude: v.latitude, longitude: v.longitude }}
              title={v.vehicle_id}
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
                  <Text style={styles.calloutTitle}>{v.vehicle_id}</Text>
                  <Text style={styles.calloutText}>Tip: {v.vehicle_type || "Bilinmiyor"}</Text>
                  <Text style={styles.calloutText}>Hiz: {Number(v.speed || 0).toFixed(1)} km/h</Text>
                  <Text style={styles.calloutText}>Sarj: %{Number(v.charge || 0).toFixed(0)}</Text>
                  {v.route_id ? <Text style={styles.calloutText}>Rota: {v.route_id}</Text> : null}
                  <Text style={[styles.calloutText, {marginTop:4, fontWeight: "bold"}]}>
                    Tamamlanan: {v.completed_points_array.length} 
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.overlayTop}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Canli Filo Takibi</Text>
            {isTracking && loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          <Text style={styles.statusSub}>
            {isTracking
              ? `Takip ediliyor (${filteredVehicles.length} Secili Arac)`
              : "Takip su an duraklatildi."}
          </Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {TRACKABLE_VEHICLES.map(vid => {
              const active = selectedVehicles.includes(vid);
              return (
                <Pressable
                  key={vid}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => toggleFilter(vid)}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{vid}</Text>
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
          <Text style={styles.buttonText}>
            {isTracking ? "Takibi Durdur" : "Araclari Izle"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  infoText: { color: colors.muted },
  container: { flex: 1 },
  map: { width: Dimensions.get("window").width, height: Dimensions.get("window").height },
  overlayTop: { position: "absolute", top: 20, left: 20, right: 20, zIndex: 10 },
  statusCard: { backgroundColor: colors.surface, padding: 16, borderRadius: radii.md, ...shadows.card },
  statusHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  statusSub: { marginTop: 4, fontSize: 13, color: colors.muted },
  
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

  overlayBottom: { position: "absolute", bottom: 30, left: 40, right: 40, zIndex: 10 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: radii.lg, ...shadows.card },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  
  markerBody: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  markerReal: { backgroundColor: colors.danger },
  markerSumo: { backgroundColor: "#3b82f6" },
  
  nodeMarker: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  nodeDelivered: { backgroundColor: colors.success || "#22c55e", borderColor: "#fff" },
  nodePending: { backgroundColor: colors.warning || "#eab308", borderColor: "#fff" },
  
  callout: { width: 140, padding: 10 },
  calloutTitle: { fontWeight: "800", color: colors.text, marginBottom: 4 },
  calloutText: { fontSize: 12, color: colors.muted },
});