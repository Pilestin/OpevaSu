import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { ordersApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function buildOrderId() {
  return `order_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function buildTaskId() {
  return `task_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function toMinutes(value) {
  const [hh, mm] = String(value).split(":").map(Number);
  return (hh * 60) + mm;
}

export default function CreateOrderScreen() {
  const { token, user } = useAuth();
  const [productName, setProductName] = useState("Damacana Su");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("100");
  const [readyTime, setReadyTime] = useState("09:00");
  const [dueTime, setDueTime] = useState("10:00");
  const [address, setAddress] = useState(user?.address || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const cleanProductName = String(productName || "").trim();
    const cleanAddress = String(address || "").trim();
    const cleanReadyTime = String(readyTime || "").trim();
    const cleanDueTime = String(dueTime || "").trim();
    const qty = Number(quantity);
    const price = Number(unitPrice);

    if (!cleanProductName) {
      Alert.alert("Eksik bilgi", "Urun adi zorunlu.");
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
    if (!Number.isFinite(qty) || qty < 1 || !Number.isFinite(price) || price <= 0) {
      Alert.alert("Gecersiz veri", "Miktar ve birim fiyat alanlarini kontrol edin.");
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
      service_time: 120,
      request: {
        product_id: "SU_0",
        product_name: cleanProductName,
        notes,
        quantity: qty,
        demand: qty * 19,
      },
      status: "waiting",
      assigned_vehicle: null,
      assigned_route_id: null,
      priority_level: 0,
      total_price: qty * price,
    };

    try {
      setSubmitting(true);
      await ordersApi.create({ token, order });
      Alert.alert("Basarili", "Siparis olusturuldu.");
      setNotes("");
      setQuantity("1");
    } catch (error) {
      Alert.alert("Siparis olusturulamadi", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Yeni Siparis</Text>
      <Text style={styles.subtitle}>Kisa form ile dakikalar icinde siparis olusturun.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Urun adi</Text>
        <TextInput
          style={styles.input}
          value={productName}
          onChangeText={setProductName}
          placeholder="Urun adi"
          placeholderTextColor={colors.muted}
        />

        <View style={styles.twoColumns}>
          <View style={styles.col}>
            <Text style={styles.label}>Miktar</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Miktar"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Birim fiyat</Text>
            <TextInput
              style={styles.input}
              value={unitPrice}
              onChangeText={setUnitPrice}
              placeholder="TL"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.twoColumns}>
          <View style={styles.col}>
            <Text style={styles.label}>Hazir olma</Text>
            <TextInput
              style={styles.input}
              value={readyTime}
              onChangeText={setReadyTime}
              placeholder="09:00"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Teslim saati</Text>
            <TextInput
              style={styles.input}
              value={dueTime}
              onChangeText={setDueTime}
              placeholder="10:00"
              placeholderTextColor={colors.muted}
            />
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
        <Text style={styles.summaryPrice}>
          {`${(Number(quantity || 0) * Number(unitPrice || 0)).toFixed(2)} TL`}
        </Text>
      </View>

      <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Kaydediliyor..." : "Siparis Ver"}</Text>
      </Pressable>
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
});
