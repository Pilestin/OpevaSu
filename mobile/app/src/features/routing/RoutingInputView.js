import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Asset } from "expo-asset";
import { colors, radii, shadows } from "../../theme";
import { runRoutingOptimization } from "./routingApi";
import { DEFAULT_FILES, PROBLEM_FILES, REQUIRED_FILE_NAMES } from "./routingAssets";
import { getAlgorithms } from "./routingConfig";

export default function RoutingInputView({ onOptimizationComplete }) {
  const [files, setFiles] = useState({});
  const [problemFile, setProblemFile] = useState(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("ALNS");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [showProblemModal, setShowProblemModal] = useState(false);

  const availableProblems = useMemo(() => Object.keys(PROBLEM_FILES), []);
  const algorithms = useMemo(() => getAlgorithms(), []);

  const loadDefaults = async () => {
    setLoading(true);
    setStatusText("Standart dosyalar yukleniyor...");
    try {
      const loadedFiles = {};
      for (const filename of REQUIRED_FILE_NAMES) {
        const asset = Asset.fromModule(DEFAULT_FILES[filename]);
        await asset.downloadAsync();
        loadedFiles[filename] = {
          uri: asset.localUri || asset.uri,
          name: filename,
          type: "text/xml",
          isAsset: true,
        };
      }
      setFiles(loadedFiles);
    } catch (error) {
      Alert.alert("Dosya Hatasi", `Standart dosyalar yuklenemedi: ${error.message}`);
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const selectDefaultProblem = async (filename) => {
    try {
      const asset = Asset.fromModule(PROBLEM_FILES[filename]);
      await asset.downloadAsync();
      setProblemFile({
        uri: asset.localUri || asset.uri,
        name: filename,
        type: "text/xml",
        isAsset: true,
      });
      setShowProblemModal(false);
    } catch (error) {
      Alert.alert("Dosya Hatasi", `Problem dosyasi yuklenemedi: ${error.message}`);
    }
  };

  const pickFile = async (key) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const picked = result.assets[0];
      if (key === "Problem") {
        setProblemFile(picked);
      } else {
        setFiles((prev) => ({ ...prev, [key]: picked }));
      }
    } catch (error) {
      Alert.alert("Dosya Hatasi", `Dosya secilemedi: ${error.message}`);
    }
  };

  const startOptimization = async () => {
    setLoading(true);
    setStatusText("Algoritma calistiriliyor...");
    try {
      const data = await runRoutingOptimization({
        algorithm: selectedAlgorithm,
        files,
        problemFile,
      });
      onOptimizationComplete(data);
    } catch (error) {
      Alert.alert("Rotalama Basarisiz", error.message);
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1) Standart Konfigurasyon</Text>
          <Pressable style={styles.buttonSecondary} onPress={loadDefaults} disabled={loading}>
            <Text style={styles.buttonSecondaryText}>Standart Dosyalari Yukle</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2) Algoritma</Text>
          <View style={styles.rowWrap}>
            {algorithms.map((algorithm) => {
              const selected = selectedAlgorithm === algorithm;
              return (
                <Pressable
                  key={algorithm}
                  style={[styles.algoButton, selected && styles.algoButtonSelected]}
                  onPress={() => setSelectedAlgorithm(algorithm)}
                >
                  <Text style={[styles.algoText, selected && styles.algoTextSelected]}>{algorithm}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>3) Zorunlu XML Dosyalari</Text>
          {REQUIRED_FILE_NAMES.map((name) => (
            <Pressable
              key={name}
              style={[styles.fileButton, files[name] && styles.fileButtonSelected]}
              onPress={() => pickFile(name)}
            >
              <Text style={styles.fileText}>{files[name] ? `Yuklendi: ${files[name].name}` : `Sec: ${name}`}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>4) Problem Dosyasi</Text>
          <Pressable style={styles.fileButton} onPress={() => setShowProblemModal(true)}>
            <Text style={styles.fileText}>Gomulu Problem Sec ({availableProblems.length})</Text>
          </Pressable>
          <Pressable
            style={[styles.fileButton, problemFile && styles.fileButtonSelected]}
            onPress={() => pickFile("Problem")}
          >
            <Text style={styles.fileText}>
              {problemFile ? `Secili: ${problemFile.name}` : "Veya Ozel Problem Dosyasi Sec"}
            </Text>
          </Pressable>
        </View>

        <Pressable style={[styles.buttonPrimary, loading && styles.buttonDisabled]} onPress={startOptimization} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonPrimaryText}>Rotalamayi Baslat</Text>}
        </Pressable>

        {loading && statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
      </ScrollView>

      <Modal visible={showProblemModal} transparent animationType="slide" onRequestClose={() => setShowProblemModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Problem Secimi</Text>
            <FlatList
              data={availableProblems}
              keyExtractor={(item) => item}
              style={styles.modalList}
              renderItem={({ item }) => (
                <Pressable style={styles.modalItem} onPress={() => selectDefaultProblem(item)}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.modalClose} onPress={() => setShowProblemModal(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
    ...shadows.card,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  algoButton: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  algoButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  algoText: {
    color: colors.text,
    fontWeight: "700",
  },
  algoTextSelected: {
    color: "#ffffff",
  },
  fileButton: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
  },
  fileButtonSelected: {
    borderColor: colors.success,
    backgroundColor: "#ecfdf3",
  },
  fileText: {
    color: colors.text,
    fontSize: 13,
  },
  buttonPrimary: {
    marginTop: 2,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  buttonSecondary: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    alignItems: "center",
    paddingVertical: 11,
  },
  buttonSecondaryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusText: {
    textAlign: "center",
    color: colors.muted,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    maxHeight: "80%",
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalList: {
    maxHeight: 360,
  },
  modalItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  modalItemText: {
    color: colors.text,
    fontSize: 14,
  },
  modalClose: {
    marginTop: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.text,
    alignItems: "center",
    paddingVertical: 11,
  },
  modalCloseText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
