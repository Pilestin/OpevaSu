import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

export default function UsersScreen() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const isAdmin = user?.role === "admin";

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
        <Text style={styles.title}>Tum Kullanicilar</Text>
        <Text style={styles.subtitle}>{users.length} kayit</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item, index) => item.user_id || item.email || String(index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>Kullanici bulunamadi.</Text>}
        contentContainerStyle={users.length === 0 ? styles.emptyContainer : styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.full_name || "-"}</Text>
            <Text style={styles.meta}>ID: {item.user_id || "-"}</Text>
            <Text style={styles.meta}>E-posta: {item.email || "-"}</Text>
            <Text style={styles.meta}>Rol: {item.role || "-"}</Text>
          </View>
        )}
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
  name: {
    color: colors.text,
    fontWeight: "800",
    marginBottom: 6,
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
});
