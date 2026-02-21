import React, { useCallback, useEffect, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { ordersApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

const STATUS_LABELS = {
  waiting: "Bekliyor",
  processing: "Hazirlaniyor",
  shipping: "Yolda",
  completed: "Teslim edildi",
  cancelled: "Iptal edildi",
};

const STATUS_COLORS = {
  waiting: "#f59e0b",
  processing: "#3b82f6",
  shipping: "#0ea5e9",
  completed: "#16a34a",
  cancelled: "#ef4444",
};

const FILTERS = [
  { key: null, label: "Tum Siparisler" },
  { key: "waiting", label: "Bekleyen" },
  { key: "completed", label: "Tamamlanan" },
];

export default function OrdersScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);

  const loadOrders = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await ordersApi.list({ token, status: statusFilter });
        setOrders(response.orders || []);
      } catch (error) {
        Alert.alert("Siparisler yuklenemedi", error.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, statusFilter]
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useFocusEffect(
    useCallback(() => {
      loadOrders(true);
    }, [loadOrders])
  );

  const renderItem = ({ item }) => {
    const request = item.request || {};
    const label = STATUS_LABELS[item.status] || item.status || "-";
    const badgeColor = STATUS_COLORS[item.status] || colors.muted;
    const createdDate = item.order_date ? new Date(item.order_date).toLocaleString("tr-TR") : "-";

    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.orderId}>{item.order_id || "Siparis"}</Text>
          <View style={[styles.badge, { backgroundColor: `${badgeColor}1a`, borderColor: `${badgeColor}55` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{label}</Text>
          </View>
        </View>

        <Text style={styles.row}>
          <Text style={styles.rowLabel}>Urun:</Text> {request.product_name || "Su"}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.rowLabel}>Miktar:</Text> {request.quantity || 1}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.rowLabel}>Toplam:</Text> {Number(item.total_price || 0).toFixed(2)} TL
        </Text>
        <Text style={styles.dateText}>{createdDate}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Siparislerim</Text>
        <Text style={styles.subtitle}>{orders.length} kayit</Text>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((filter) => {
          const active = statusFilter === filter.key;
          return (
            <Pressable
              key={String(filter.key)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setStatusFilter(filter.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item, index) => item.order_id || String(index)}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>Siparis bulunamadi.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} />}
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    color: colors.muted,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.muted,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderId: {
    fontWeight: "700",
    color: colors.text,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    color: colors.text,
    marginBottom: 2,
  },
  rowLabel: {
    color: colors.muted,
    fontWeight: "700",
  },
  dateText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 90,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
  },
});
