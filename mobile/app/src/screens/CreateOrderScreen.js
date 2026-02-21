import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { ordersApi, productsApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hh = String(Math.floor(index / 2)).padStart(2, "0");
  const mm = index % 2 === 0 ? "00" : "30";
  return `${hh}:${mm}`;
});

function dateStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function randomCode() {
  return Math.random().toString(36).slice(2, 5);
}

function buildOrderId() {
  return `order_${dateStamp()}_${randomCode()}`;
}

function buildTaskId() {
  return `task_${dateStamp()}_${randomCode()}`;
}

function toMinutes(value) {
  const [hh, mm] = String(value).split(":").map(Number);
  return (hh * 60) + mm;
}

export default function CreateOrderScreen() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState(null);

  const [quantity, setQuantity] = useState("1");
  const [readyTime, setReadyTime] = useState("09:00");
  const [dueTime, setDueTime] = useState("10:00");
  const [address, setAddress] = useState(user?.address || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timeTarget, setTimeTarget] = useState("ready");

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        const response = await productsApi.list({ token });
        const nextProducts = Array.isArray(response?.products) ? response.products : [];
        if (!mounted) return;

        setProducts(nextProducts);
        const defaultProduct =
          nextProducts.find((item) => item.product_id === "SU_0") || nextProducts[0] || null;
        setSelectedProductId(defaultProduct?.product_id || null);
      } catch (error) {
        if (!mounted) return;
        Alert.alert("Urunler yuklenemedi", error.message);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    };

    if (token) {
      loadProducts();
    }

    return () => {
      mounted = false;
    };
  }, [token]);

  const selectedProduct = useMemo(
    () => products.find((item) => item.product_id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const unitPrice = Number(selectedProduct?.price || 0);
  const demandUnit = Number(selectedProduct?.weight?.value || 19);
  const totalPrice = (Number(quantity || 0) * unitPrice).toFixed(2);

  const onSubmit = async () => {
    const cleanAddress = String(address || "").trim();
    const cleanReadyTime = String(readyTime || "").trim();
    const cleanDueTime = String(dueTime || "").trim();
    const qty = Number(quantity);

    if (!selectedProduct) {
      Alert.alert("Eksik bilgi", "Lutfen bir urun secin.");
      return;
    }
    if (!cleanAddress) {
      Alert.alert("Eksik bilgi", "Teslimat adresi zorunlu.");
      return;
    }
    if (!TIME_REGEX.test(cleanReadyTime) || !TIME_REGEX.test(cleanDueTime)) {
      Alert.alert("Gecersiz saat", "Hazir olma ve teslim saatini HH:MM formatinda girin.");
      return;
    }
    if (toMinutes(cleanDueTime) < toMinutes(cleanReadyTime)) {
      Alert.alert("Gecersiz saat", "Teslim saati hazir olma saatinden once olamaz.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      Alert.alert("Gecersiz veri", "Miktar en az 1 olmali.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      Alert.alert("Gecersiz veri", "Secili urunun birim fiyati gecersiz.");
      return;
    }

    const order = {
      order_id: buildOrderId(),
      task_id: buildTaskId(),
      customer_id: user?.user_id,
      location: {
        address: cleanAddress,
        latitude: Number(user?.latitude || 39.7598),
        longitude: Number(user?.longitude || 30.5042),
      },
      ready_time: cleanReadyTime,
      due_date: cleanDueTime,
      order_date: new Date().toISOString().slice(0, 10),
      service_time: 120,
      request: {
        product_id: selectedProduct.product_id,
        product_name: selectedProduct.name || selectedProduct.product_id,
        notes,
        quantity: qty,
        demand: qty * (Number.isFinite(demandUnit) && demandUnit > 0 ? demandUnit : 19),
      },
      status: "waiting",
      assigned_vehicle: "default_vehicle",
      assigned_route_id: "default_route",
      priority_level: 0,
      change_log: [],
      total_price: qty * unitPrice,
    };

    try {
      setSubmitting(true);
      await ordersApi.create({ token, order });
      Alert.alert("Basarili", "Siparis olusturuldu.");
      setNotes("");
      setQuantity("1");
      setReadyTime("09:00");
      setDueTime("10:00");
    } catch (error) {
      Alert.alert("Siparis olusturulamadi", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openTimePicker = (target) => {
    setTimeTarget(target);
    setTimePickerVisible(true);
  };

  const onSelectTime = (value) => {
    if (timeTarget === "ready") {
      setReadyTime(value);
    } else {
      setDueTime(value);
    }
    setTimePickerVisible(false);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Yeni Siparis</Text>
      <Text style={styles.subtitle}>Urunu sec, miktari gir, siparisi aninda olustur.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Urunler</Text>
        {loadingProducts ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Urunler yukleniyor...</Text>
          </View>
        ) : products.length === 0 ? (
          <Text style={styles.emptyText}>Urun bulunamadi.</Text>
        ) : (
          <View style={styles.productGrid}>
            {products.map((product) => {
              const selected = product.product_id === selectedProductId;
              return (
                <Pressable
                  key={product.product_id}
                  style={[styles.productCard, selected && styles.productCardSelected]}
                  onPress={() => setSelectedProductId(product.product_id)}
                >
                  {product.image_url ? <Image source={{ uri: product.image_url }} style={styles.productImage} /> : null}
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name || product.product_id}
                  </Text>
                  <Text style={styles.productMeta}>{`${Number(product.price || 0).toFixed(2)} TL`}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Miktar</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Miktar"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />

        <View style={styles.twoColumns}>
          <View style={styles.col}>
            <Text style={styles.label}>Hazir olma</Text>
            <Pressable style={styles.timeField} onPress={() => openTimePicker("ready")}>
              <Text style={styles.timeValue}>{readyTime}</Text>
              <Text style={styles.timeHint}>Sec</Text>
            </Pressable>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Teslim saati</Text>
            <Pressable style={styles.timeField} onPress={() => openTimePicker("due")}>
              <Text style={styles.timeValue}>{dueTime}</Text>
              <Text style={styles.timeHint}>Sec</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.label}>Adres</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={address}
          onChangeText={setAddress}
          placeholder="Teslimat adresi"
          placeholderTextColor={colors.muted}
          multiline
        />

        <Text style={styles.label}>Not</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Opsiyonel not"
          placeholderTextColor={colors.muted}
          multiline
        />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>Tahmini toplam</Text>
        <Text style={styles.summaryPrice}>{`${totalPrice} TL`}</Text>
      </View>

      <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Kaydediliyor..." : "Siparis Ver"}</Text>
      </Pressable>

      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {timeTarget === "ready" ? "Hazir olma saati" : "Teslim saati"}
            </Text>
            <ScrollView style={styles.timeList}>
              {TIME_OPTIONS.map((time) => (
                <Pressable key={time} style={styles.timeOption} onPress={() => onSelectTime(time)}>
                  <Text style={styles.timeOptionText}>{time}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setTimePickerVisible(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    ...shadows.card,
  },
  label: {
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
    marginTop: 8,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: colors.muted,
  },
  emptyText: {
    color: colors.muted,
    paddingVertical: 6,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  productCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  productCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  productImage: {
    width: "100%",
    height: 64,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#e2e8f0",
  },
  productName: {
    fontWeight: "700",
    color: colors.text,
    fontSize: 13,
    minHeight: 34,
  },
  productMeta: {
    marginTop: 4,
    color: colors.primary,
    fontWeight: "700",
  },
  twoColumns: {
    flexDirection: "row",
    gap: 10,
  },
  col: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    color: colors.text,
  },
  timeField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeValue: {
    color: colors.text,
    fontWeight: "700",
  },
  timeHint: {
    color: colors.primary,
    fontWeight: "700",
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  summaryCard: {
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: colors.primarySoft,
    borderColor: "#8fded4",
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
  },
  summaryText: {
    color: colors.muted,
    fontWeight: "700",
  },
  summaryPrice: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: "800",
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  timeList: {
    maxHeight: 360,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  timeOptionText: {
    color: colors.text,
    fontWeight: "700",
  },
  modalClose: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  modalCloseText: {
    color: colors.muted,
    fontWeight: "700",
  },
});
