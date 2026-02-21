import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { colors, radii, shadows } from "../theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [userIdOrEmail, setUserIdOrEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!userIdOrEmail) {
      Alert.alert("Eksik bilgi", "Kullanici ID veya e-posta zorunlu.");
      return;
    }

    try {
      setSubmitting(true);
      await login({ userIdOrEmail });
    } catch (error) {
      Alert.alert("Giris basarisiz", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.bgCircleA} />
      <View style={styles.bgCircleB} />
      <View style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.logo}>OPEVA</Text>
          <Text style={styles.brandText}>Su Siparis Mobil</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Hos geldiniz</Text>
          <Text style={styles.subtitle}>Devam etmek icin kullanici ID veya e-posta girin.</Text>

          <TextInput
            style={styles.input}
            placeholder="Kullanici ID veya E-posta"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            value={userIdOrEmail}
            onChangeText={setUserIdOrEmail}
          />

          <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={onSubmit} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? "Giris yapiliyor..." : "Giris Yap"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  bgCircleA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#d8f3ee",
    top: -60,
    left: -40,
  },
  bgCircleB: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#fff0d1",
    bottom: 40,
    right: -30,
  },
  brand: {
    marginBottom: 18,
  },
  logo: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: colors.primary,
  },
  brandText: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
    ...shadows.card,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    color: colors.text,
  },
  button: {
    marginTop: 2,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
