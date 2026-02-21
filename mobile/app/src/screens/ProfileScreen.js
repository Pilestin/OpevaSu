import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { profileApi } from "../services/api";
import { colors, radii, shadows } from "../theme";

export default function ProfileScreen() {
  const { token, user, updateUser, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || "");
  const [address, setAddress] = useState(user?.address || "");
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await profileApi.get({ token, userId: user.user_id });
        const current = response.user;
        setFullName(current.full_name || "");
        setEmail(current.email || "");
        setPhoneNumber(current.phone_number || "");
        setAddress(current.address || "");
        setProfilePicture(current.profile_picture || "");
        await updateUser(current);
      } catch (error) {
        Alert.alert("Profil yuklenemedi", error.message);
      }
    };

    if (user?.user_id) {
      loadProfile();
    }
  }, [token, user?.user_id]);

  const onSave = async () => {
    try {
      setSaving(true);
      const response = await profileApi.update({
        token,
        userId: user.user_id,
        updates: {
          full_name: fullName,
          email,
          phone_number: phoneNumber,
          address,
          profile_picture: profilePicture,
        },
      });
      await updateUser(response.user);
      Alert.alert("Basarili", "Profil guncellendi.");
    } catch (error) {
      Alert.alert("Profil guncellenemedi", error.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (fullName || user?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.header}>Profil</Text>
      <View style={styles.card}>
        <View style={styles.profileHead}>
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initials || "U"}</Text>
            </View>
          )}
          <View style={styles.profileMeta}>
            <Text style={styles.nameText}>{fullName || "Isimsiz Kullanici"}</Text>
            <Text style={styles.meta}>ID: {user?.user_id || "-"}</Text>
            <Text style={styles.meta}>Rol: {user?.role || "-"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Ad Soyad</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Ad Soyad" placeholderTextColor={colors.muted} />

        <Text style={styles.label}>E-posta</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Telefon</Text>
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Telefon"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Profil resmi URL</Text>
        <TextInput
          style={styles.input}
          value={profilePicture}
          onChangeText={setProfilePicture}
          placeholder="https://..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Adres</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={address}
          onChangeText={setAddress}
          placeholder="Adres"
          placeholderTextColor={colors.muted}
          multiline
        />
      </View>

      <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Kaydediliyor..." : "Profili Kaydet"}</Text>
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Cikis Yap</Text>
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
  header: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
    ...shadows.card,
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileMeta: {
    marginLeft: 12,
    flex: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  avatarFallbackText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "800",
  },
  nameText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: colors.muted,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadows.card,
  },
  label: {
    marginTop: 8,
    marginBottom: 6,
    color: colors.text,
    fontWeight: "700",
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
  button: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  logoutButton: {
    marginTop: 10,
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "700",
  },
});
