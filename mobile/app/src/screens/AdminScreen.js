import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

function resolveAddress(user) {
  if (!user || typeof user !== "object") return "-";
  const direct = String(user.address || "").trim();
  if (direct) return direct;
  const nested = String(user?.location?.address || "").trim();
  if (nested) return nested;
  return "-";
}

export default function AdminScreen() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [previewImageUri, setPreviewImageUri] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const isAdmin = user?.role === "admin";

  const closeImagePreview = () => setPreviewImageUri("");
  const closeUserModal = () => setSelectedUser(null);

  const loadUsers = useCallback(
    async (isRefresh = false) => {
      if (!isAdmin) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await usersApi.list({ token });
        setUsers(response.users || []);
      } catch (error) {
        Alert.alert("Kullanicilar yuklenemedi", error.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, isAdmin]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useFocusEffect(
    useCallback(() => {
      loadUsers(true);
    }, [loadUsers])
  );

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Bu alan sadece admin kullanicilar icin.</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Paneli</Text>
        <Text style={styles.subtitle}>{users.length} kullanici kaydi</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item, index) => item.user_id || item.email || String(index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>Kullanici bulunamadi.</Text>}
        contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.listContent}
        renderItem={({ item }) => {
          const address = resolveAddress(item);
          const profilePicture = String(item?.profile_picture || "").trim();
          const initial = String(item?.full_name || item?.user_id || "?").trim().slice(0, 1).toUpperCase();

          return (
            <View style={styles.card}>
              <View style={styles.userHeader}>
                {profilePicture ? (
                  <Pressable onPress={() => setPreviewImageUri(profilePicture)} hitSlop={8}>
                    <Image source={{ uri: profilePicture }} style={styles.avatar} />
                  </Pressable>
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{initial || "?"}</Text>
                  </View>
                )}

                <Pressable style={styles.userHeaderText} onPress={() => setSelectedUser(item)}>
                  <Text style={styles.name}>{item.full_name || "-"}</Text>
                  <Text style={styles.meta}>ID: {item.user_id || "-"}</Text>
                </Pressable>
              </View>

              <Text style={styles.meta}>E-posta: {item.email || "-"}</Text>
              <Text style={styles.meta}>Rol: {item.role || "-"}</Text>
              <Text style={styles.meta}>Adres: {address}</Text>
            </View>
          );
        }}
      />

      <Modal visible={!!previewImageUri} transparent animationType="fade" onRequestClose={closeImagePreview}>
        <Pressable style={styles.imageModalOverlay} onPress={closeImagePreview}>
          <Pressable style={styles.imageModalCard} onPress={() => {}}>
            {previewImageUri ? <Image source={{ uri: previewImageUri }} style={styles.previewImage} /> : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedUser} transparent animationType="fade" onRequestClose={closeUserModal}>
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalCard}>
            <Text style={styles.detailTitle}>Kullanici Detayi</Text>

            <View style={styles.detailHeader}>
              {String(selectedUser?.profile_picture || "").trim() ? (
                <Image source={{ uri: String(selectedUser.profile_picture) }} style={styles.detailAvatar} />
              ) : (
                <View style={styles.detailAvatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {String(selectedUser?.full_name || selectedUser?.user_id || "?")
                      .trim()
                      .slice(0, 1)
                      .toUpperCase() || "?"}
                  </Text>
                </View>
              )}

              <View style={styles.detailHeaderText}>
                <Text style={styles.name}>{selectedUser?.full_name || "-"}</Text>
                <Text style={styles.meta}>ID: {selectedUser?.user_id || "-"}</Text>
              </View>
            </View>

            <Text style={styles.meta}>E-posta: {selectedUser?.email || "-"}</Text>
            <Text style={styles.meta}>Rol: {selectedUser?.role || "-"}</Text>
            <Text style={styles.meta}>Adres: {resolveAddress(selectedUser)}</Text>

            <View style={styles.detailActions}>
              <Pressable style={styles.closeButton} onPress={closeUserModal}>
                <Text style={styles.closeButtonText}>Kapat</Text>
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
    paddingHorizontal: 20,
  },
  infoText: {
    color: colors.muted,
    textAlign: "center",
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  avatarFallbackText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 16,
  },
  userHeaderText: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontWeight: "800",
    marginBottom: 2,
  },
  meta: {
    color: colors.muted,
    marginBottom: 2,
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: colors.muted,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  imageModalCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#0f172a",
  },
  previewImage: {
    width: "100%",
    height: 420,
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  detailModalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadows.card,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  detailAvatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  detailAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  closeButton: {
    minWidth: 110,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
