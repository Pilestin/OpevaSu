import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { ordersApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

const ADMIN_COLLECTION_FILTERS = [
  { key: "orders", label: "Orders" },
  { key: "orders_s", label: "Orders_S" },
];

const EDIT_STATUSES = ["waiting", "completed", "cancelled"];

function toMinutes(value) {
  const [hh, mm] = String(value).split(":").map(Number);
  return (hh * 60) + mm;
}

export default function OrdersScreen() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [collectionFilter, setCollectionFilter] = useState("orders");

  const [editingOrder, setEditingOrder] = useState(null);
  const [editAddress, setEditAddress] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editReadyTime, setEditReadyTime] = useState("09:00");
  const [editDueTime, setEditDueTime] = useState("10:00");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("waiting");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setCollectionFilter("orders");
    }
  }, [isAdmin]);

  const loadOrders = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await ordersApi.list({
          token,
          status: statusFilter,
          collection: isAdmin ? collectionFilter : null,
        });
        setOrders(response.orders || []);
      } catch (error) {
        Alert.alert("Siparisler yuklenemedi", error.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, statusFilter, isAdmin, collectionFilter]
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useFocusEffect(
    useCallback(() => {
      loadOrders(true);
    }, [loadOrders])
  );

  const closeEditModal = () => {
    setEditingOrder(null);
    setSavingEdit(false);
  };

  const openEditModal = (order) => {
    const request = order.request || {};
    const location = order.location || {};
    setEditingOrder(order);
    setEditAddress(location.address || "");
    setEditQuantity(String(request.quantity || 1));
    setEditReadyTime(String(order.ready_time || "09:00"));
    setEditDueTime(String(order.due_date || "10:00"));
    setEditNotes(String(request.notes || ""));
    setEditStatus(String(order.status || "waiting"));
  };

  const onDeleteOrder = (order) => {
    Alert.alert(
      "Siparis silinsin mi?",
      `${order.order_id || "Bu siparis"} kalici olarak silinecek.`,
      [
        { text: "Vazgec", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await ordersApi.remove({ token, orderId: order.order_id });
              await loadOrders(true);
            } catch (error) {
              Alert.alert("Siparis silinemedi", error.message);
            }
          },
        },
      ]
    );
  };

  const onSaveEdit = async () => {
    if (!editingOrder) return;

    const qty = Number(editQuantity);
    const address = String(editAddress || "").trim();
    const ready = String(editReadyTime || "").trim();
    const due = String(editDueTime || "").trim();
    const notes = String(editNotes || "");

    if (!address) {
      Alert.alert("Eksik bilgi", "Adres zorunlu.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      Alert.alert("Gecersiz veri", "Miktar en az 1 olmali.");
      return;
    }
    if (!TIME_REGEX.test(ready) || !TIME_REGEX.test(due)) {
      Alert.alert("Gecersiz saat", "Saatleri HH:MM formatinda girin.");
      return;
    }
    if (toMinutes(due) < toMinutes(ready)) {
      Alert.alert("Gecersiz saat", "Teslim saati hazir olma saatinden once olamaz.");
      return;
    }

    const oldQuantity = Number(editingOrder?.request?.quantity || 1);
    const oldTotal = Number(editingOrder?.total_price || 0);
    const unitPrice = oldQuantity > 0 ? oldTotal / oldQuantity : oldTotal;
    const nextTotalPrice = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice * qty : oldTotal;

    try {
      setSavingEdit(true);
      await ordersApi.update({
        token,
        orderId: editingOrder.order_id,
        updates: {
          location: {
            address,
            latitude: Number(editingOrder?.location?.latitude),
            longitude: Number(editingOrder?.location?.longitude),
          },
          ready_time: ready,
          due_date: due,
          request: {
            quantity: qty,
            notes,
          },
          status: editStatus,
          total_price: nextTotalPrice,
        },
      });
      closeEditModal();
      await loadOrders(true);
    } catch (error) {
      Alert.alert("Siparis guncellenemedi", error.message);
      setSavingEdit(false);
    }
  };

  const editingTitle = useMemo(
    () => (editingOrder ? `${editingOrder.order_id || "Siparis"} duzenleniyor` : ""),
    [editingOrder]
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

        {isAdmin && item.source_collection ? (
          <Text style={styles.sourceText}>{item.source_collection}</Text>
        ) : null}

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

        <View style={styles.actionsRow}>
          <Pressable style={styles.editButton} onPress={() => openEditModal(item)}>
            <Text style={styles.editText}>Duzenle</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={() => onDeleteOrder(item)}>
            <Text style={styles.deleteText}>Sil</Text>
          </Pressable>
        </View>
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
        <Text style={styles.title}>Siparisler</Text>
        <Text style={styles.subtitle}>{orders.length} kayit</Text>
      </View>

      {isAdmin ? (
        <View style={styles.filters}>
          {ADMIN_COLLECTION_FILTERS.map((filter) => {
            const active = collectionFilter === filter.key;
            return (
              <Pressable
                key={filter.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCollectionFilter(filter.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

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

      <Modal visible={!!editingOrder} transparent animationType="fade" onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Siparis Duzenle</Text>
            <Text style={styles.modalSub}>{editingTitle}</Text>

            <Text style={styles.modalLabel}>Adres</Text>
            <TextInput style={styles.modalInput} value={editAddress} onChangeText={setEditAddress} />

            <View style={styles.modalRow}>
              <View style={styles.modalCol}>
                <Text style={styles.modalLabel}>Miktar</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editQuantity}
                  onChangeText={setEditQuantity}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.modalCol}>
                <Text style={styles.modalLabel}>Durum</Text>
                <View style={styles.statusWrap}>
                  {EDIT_STATUSES.map((statusKey) => {
                    const active = editStatus === statusKey;
                    return (
                      <Pressable
                        key={statusKey}
                        style={[styles.statusChip, active && styles.statusChipActive]}
                        onPress={() => setEditStatus(statusKey)}
                      >
                        <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                          {STATUS_LABELS[statusKey]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.modalRow}>
              <View style={styles.modalCol}>
                <Text style={styles.modalLabel}>Hazir olma</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editReadyTime}
                  onChangeText={setEditReadyTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.modalCol}>
                <Text style={styles.modalLabel}>Teslim</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDueTime}
                  onChangeText={setEditDueTime}
                  placeholder="10:00"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>Not</Text>
            <TextInput
              style={[styles.modalInput, styles.modalMultiline]}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={closeEditModal} disabled={savingEdit}>
                <Text style={styles.cancelText}>Vazgec</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, savingEdit && styles.saveButtonDisabled]}
                onPress={onSaveEdit}
                disabled={savingEdit}
              >
                <Text style={styles.saveText}>{savingEdit ? "Kaydediliyor..." : "Kaydet"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  sourceText: {
    marginBottom: 8,
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
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
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  editText: {
    color: colors.primary,
    fontWeight: "700",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  deleteText: {
    color: colors.danger,
    fontWeight: "700",
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 120,
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
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
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  modalSub: {
    color: colors.muted,
    marginBottom: 6,
  },
  modalLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontWeight: "700",
    color: colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    color: colors.text,
  },
  modalMultiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  modalRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCol: {
    flex: 1,
  },
  statusWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  statusChipText: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 12,
  },
  statusChipTextActive: {
    color: colors.primary,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  cancelText: {
    color: colors.muted,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
