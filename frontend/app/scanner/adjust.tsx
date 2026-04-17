import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Chip, HelperText, SegmentedButtons, Switch, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { CornerAdjuster } from "@/components/CornerAdjuster";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useScanner, type ScanConfig } from "@/hooks/useScanner";
import { useScannerStore } from "@/stores/scannerStore";

export default function ScannerAdjustScreen() {
  const router = useRouter();
  const scanner = useScanner();
  const pendingFile = useScannerStore((s) => s.pendingFile);

  const [config, setConfig] = useState<ScanConfig>({
    do_deskew: true,
    do_shadow_removal: true,
    binarize: "adaptive",
    export_as: "image",
  });

  useEffect(() => {
    if (pendingFile && !scanner.sessionId && !scanner.uploading) {
      scanner.upload(pendingFile);
    }
  }, [pendingFile, scanner]);

  useEffect(() => {
    if (scanner.sessionId && scanner.corners.length === 0 && !scanner.detecting) {
      scanner.detectEdges();
    }
  }, [scanner.sessionId, scanner.corners.length, scanner.detecting, scanner]);

  useEffect(() => {
    if (scanner.result) {
      router.replace({
        pathname: "/scanner/result",
        params: {
          url: scanner.result.download_url,
          filename: scanner.result.original_filename,
          mime: scanner.result.mime_type,
          size: String(scanner.result.size_bytes),
        },
      });
    }
  }, [scanner.result, router]);

  const onProcess = () => scanner.process(config);

  if (!pendingFile) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Adjust corners" }} />
        <View style={styles.center}>
          <Text variant="bodyMedium">No image selected. Go back to the Scanner tab.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Adjust corners" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {!scanner.sourceUri ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.mt}>Uploading image...</Text>
          </View>
        ) : (
          <>
            <CornerAdjuster
              imageUri={scanner.sourceUri}
              imageWidth={scanner.sourceWidth}
              imageHeight={scanner.sourceHeight}
              corners={scanner.corners}
              onCornersChange={scanner.setCorners}
            />

            {scanner.detecting && (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" />
                <Text variant="bodySmall" style={styles.hint}>Detecting edges...</Text>
              </View>
            )}

            <Text variant="titleSmall" style={styles.sectionLabel}>Processing</Text>

            <View style={styles.settingRow}>
              <Text>Deskew</Text>
              <Switch
                value={config.do_deskew}
                onValueChange={(v) => setConfig((c) => ({ ...c, do_deskew: v }))}
              />
            </View>
            <View style={styles.settingRow}>
              <Text>Remove shadows</Text>
              <Switch
                value={config.do_shadow_removal}
                onValueChange={(v) => setConfig((c) => ({ ...c, do_shadow_removal: v }))}
              />
            </View>

            <Text variant="bodyMedium" style={styles.groupLabel}>Output style</Text>
            <SegmentedButtons
              value={config.binarize}
              onValueChange={(v) => setConfig((c) => ({ ...c, binarize: v as ScanConfig["binarize"] }))}
              buttons={[
                { value: "none", label: "Color" },
                { value: "adaptive", label: "B&W" },
                { value: "otsu", label: "High contrast" },
              ]}
            />

            <Text variant="bodyMedium" style={styles.groupLabel}>Export as</Text>
            <View style={styles.chipRow}>
              <Chip
                icon="image"
                selected={config.export_as === "image"}
                onPress={() => setConfig((c) => ({ ...c, export_as: "image" }))}
              >
                JPEG
              </Chip>
              <Chip
                icon="file-pdf-box"
                selected={config.export_as === "pdf"}
                onPress={() => setConfig((c) => ({ ...c, export_as: "pdf" }))}
              >
                PDF
              </Chip>
            </View>

            {scanner.error && <HelperText type="error" visible>{scanner.error}</HelperText>}

            <View style={styles.actions}>
              <Button
                mode="outlined"
                icon="auto-fix"
                onPress={() => scanner.detectEdges()}
                disabled={scanner.detecting}
              >
                Re-detect
              </Button>
              <Button
                mode="contained"
                icon="scan-helper"
                onPress={onProcess}
                loading={scanner.processing}
                disabled={scanner.processing || scanner.corners.length !== 4}
                style={styles.scan}
              >
                Scan
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      <LoadingOverlay visible={scanner.processing} message="Processing document..." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  mt: { marginTop: 12, color: "#6B7280" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hint: { color: "#6B7280" },
  sectionLabel: { marginTop: 12, fontWeight: "700" },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  groupLabel: { marginTop: 10 },
  chipRow: { flexDirection: "row", gap: 8 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  scan: { minWidth: 120 },
});
