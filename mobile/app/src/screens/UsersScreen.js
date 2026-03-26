import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme";

export default function UsersScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Kullanici Ekrani</Text>
        <Text style={styles.body}>Admin paneli bu dosyadan ayrilip `AdminScreen.js` icine tasindi.</Text>
        <Text style={styles.body}>
          Aktif kullanici: {user?.full_name || user?.user_id || user?.email || "-"}
        </Text>
        <Text style={styles.body}>Rol: {user?.role || "-"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  body: {
    color: colors.muted,
    lineHeight: 22,
  },
});
