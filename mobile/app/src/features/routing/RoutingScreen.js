import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme";
import RoutingInputView from "./RoutingInputView";
import RoutingResultsView from "./RoutingResultsView";

export default function RoutingScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [results, setResults] = useState(null);

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>Bu alan sadece admin kullanicilar icin.</Text>
      </View>
    );
  }

  if (results) {
    return <RoutingResultsView results={results} onReset={() => setResults(null)} />;
  }

  return <RoutingInputView onOptimizationComplete={setResults} />;
}

const styles = StyleSheet.create({
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
});
