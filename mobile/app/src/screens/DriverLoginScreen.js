import React, { useState } from "react";
import {
  Alert,
  Image,
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

const appLogo = require("../../assets/opeva-logo-2.png");

export default function DriverLoginScreen({ navigation }) {
  const { loginDriver } = useAuth();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!userName || !password) {
      Alert.alert("Eksik bilgi", "Driver kullanici adi ve sifre zorunlu.");
      return;
    }

    try {
      setSubmitting(true);
      await loginDriver({ userName, password });
    } catch (error) {
      Alert.alert("Driver girisi basarisiz", error.message);
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
          <Image source={appLogo} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.logo}>OPEVA</Text>
          <Text style={styles.brandText}>Driver Girisi</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Driver girisi</Text>
          <Text style={styles.subtitle}>Bu ekran sadece driver hesaplari icindir.</Text>

          <TextInput
            style={styles.input}
            placeholder="Driver kullanici adi"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            value={userName}
            onChangeText={setUserName}
          />

          <TextInput
            style={styles.input}
            placeholder="Sifre"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={onSubmit} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? "Driver girisi yapiliyor..." : "Driver Olarak Giris Yap"}</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()} disabled={submitting}>
            <Text style={styles.secondaryButtonText}>Normal girise don</Text>
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
    alignItems: "center",
    marginBottom: 18,
  },
  logoImage: {
    width: 96,
    height: 96,
    marginBottom: 10,
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
  secondaryButton: {
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f8fafc",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
});
