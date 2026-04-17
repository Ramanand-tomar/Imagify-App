import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Card, Divider, Icon, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { useScannerStore } from "@/stores/scannerStore";

export default function ScannerTabScreen() {
  const router = useRouter();
  const setPendingFile = useScannerStore((s) => s.setPendingFile);

  const onFilePicked = (f: PickedFile) => {
    setPendingFile(f);
    router.push("/scanner/adjust");
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.inner}>
        <Text variant="headlineSmall" style={styles.title}>Document Scanner</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Take a photo of a document or pick one from your gallery. The app will auto-detect
          the edges and let you fine-tune before flattening and exporting.
        </Text>

        <Card style={styles.tipCard}>
          <Card.Content style={styles.tipRow}>
            <Icon source="lightbulb-outline" size={22} color="#4F46E5" />
            <Text variant="bodySmall" style={styles.tipText}>
              For best results: good lighting, plain background, and keep the whole document in frame.
            </Text>
          </Card.Content>
        </Card>

        <FileUploader accept="image" onFilePicked={onFilePicked} label="Capture or pick a document" />

        <Divider style={{ marginVertical: 8 }} />

        <Card style={styles.ocrCard} onPress={() => router.push("/scanner/ocr")}>
          <Card.Content style={styles.ocrRow}>
            <View style={styles.ocrIconBg}>
              <Icon source="text-recognition" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: '600' }}>OCR Mode</Text>
              <Text variant="bodySmall" style={{ color: '#6B7280' }}>Extract text from images or PDFs</Text>
            </View>
            <Icon source="chevron-right" size={24} color="#9CA3AF" />
          </Card.Content>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { padding: 16, gap: 16 },
  title: { fontWeight: "700" },
  subtitle: { color: "#6B7280" },
  tipCard: { backgroundColor: "#EEF2FF" },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipText: { flex: 1, color: "#374151" },
  ocrCard: { backgroundColor: "#fff", elevation: 1, borderRadius: 12 },
  ocrRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  ocrIconBg: { backgroundColor: "#4F46E5", padding: 8, borderRadius: 8 },
});
