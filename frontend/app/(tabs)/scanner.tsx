import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { Card, GradientSurface, Screen, SectionHeader, Text } from "@/components/ui";
import { useScannerStore } from "@/stores/scannerStore";
import { useAppTheme } from "@/theme/useTheme";

export default function ScannerTabScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const setPendingFile = useScannerStore((s) => s.setPendingFile);

  const onFilePicked = (f: PickedFile) => {
    setPendingFile(f);
    router.push("/scanner/adjust");
  };

  return (
    <Screen edges={["top"]}>
      <View>
        <Text variant="h1">Scanner</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: 4 }}>
          Capture documents and extract text
        </Text>
      </View>

      <GradientSurface radius="2xl" colors={theme.gradients.aiGlow} contentStyle={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: theme.onGradient.surface }]}>
          <Icon source="line-scan" size={28} color={theme.onGradient.primary} />
        </View>
        <Text variant="h3" style={{ color: theme.onGradient.primary, marginTop: 14 }}>
          Turn paper into digital
        </Text>
        <Text variant="bodySm" style={{ color: theme.onGradient.secondary, marginTop: 4 }}>
          Auto-detect edges, flatten, and export as a clean PDF.
        </Text>
      </GradientSurface>

      <SectionHeader title="Scan a document" subtitle="Take a photo or pick from gallery" />
      <FileUploader accept="image" onFilePicked={onFilePicked} label="Capture or pick a document" />

      <Card variant="tinted" tint={theme.colors.status.infoSoft} radius="lg">
        <View style={styles.tipRow}>
          <Icon source="lightbulb-on-outline" size={20} color={theme.colors.brand[700]} />
          <Text variant="bodySm" tone="primary" style={{ flex: 1 }}>
            For best results: good lighting, plain background, and keep the whole document in frame.
          </Text>
        </View>
      </Card>

      <SectionHeader title="Other modes" />
      <Card onPress={() => router.push("/scanner/ocr")}>
        <View style={styles.ocrRow}>
          <View style={[styles.ocrIconBg, { backgroundColor: theme.colors.brand[50] }]}>
            <Icon source="text-recognition" size={22} color={theme.colors.brand[700]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMd">OCR Mode</Text>
            <Text variant="bodySm" tone="secondary">
              Extract text from images or PDFs
            </Text>
          </View>
          <Icon source="chevron-right" size={22} color={theme.colors.text.muted} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 20, minHeight: 160 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ocrRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  ocrIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
