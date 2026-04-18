import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Switch } from "react-native-paper";

import { CornerAdjuster } from "@/components/CornerAdjuster";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AppHeader, Button, Card, ChipGroup, EmptyState, Screen, SectionHeader, Text } from "@/components/ui";
import { useScanner, type ScanConfig } from "@/hooks/useScanner";
import { useScannerStore } from "@/stores/scannerStore";
import { useAppTheme } from "@/theme/useTheme";

export default function ScannerAdjustScreen() {
  const theme = useAppTheme();
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
      <>
        <AppHeader title="Adjust corners" />
        <Screen>
          <EmptyState
            icon="image-off-outline"
            title="No image selected"
            description="Go back to the Scanner tab to pick one."
            actionLabel="Back to Scanner"
            onAction={() => router.replace("/(tabs)/scanner")}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Adjust corners" subtitle="Drag the handles to refine detection" />
      <Screen>
        {!scanner.sourceUri ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.brand.default} />
            <Text variant="body" tone="secondary" style={{ marginTop: 12 }}>
              Uploading image…
            </Text>
          </View>
        ) : (
          <>
            <Card padded={false} radius="xl" style={{ overflow: "hidden" }}>
              <CornerAdjuster
                imageUri={scanner.sourceUri}
                imageWidth={scanner.sourceWidth}
                imageHeight={scanner.sourceHeight}
                corners={scanner.corners}
                onCornersChange={scanner.setCorners}
              />
            </Card>

            {scanner.detecting ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={theme.colors.brand.default} />
                <Text variant="caption" tone="secondary">
                  Detecting edges…
                </Text>
              </View>
            ) : null}

            <SectionHeader title="Processing" />
            <Card padded={false}>
              <View style={[styles.settingRow, { borderBottomColor: theme.colors.border.subtle }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMd">Deskew</Text>
                  <Text variant="caption" tone="secondary">
                    Straighten tilted pages
                  </Text>
                </View>
                <Switch
                  value={config.do_deskew}
                  onValueChange={(v) => setConfig((c) => ({ ...c, do_deskew: v }))}
                  color={theme.colors.brand.default}
                />
              </View>
              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMd">Remove shadows</Text>
                  <Text variant="caption" tone="secondary">
                    Clean up uneven lighting
                  </Text>
                </View>
                <Switch
                  value={config.do_shadow_removal}
                  onValueChange={(v) => setConfig((c) => ({ ...c, do_shadow_removal: v }))}
                  color={theme.colors.brand.default}
                />
              </View>
            </Card>

            <View style={{ gap: 8 }}>
              <Text variant="titleSm">Output style</Text>
              <ChipGroup
                value={config.binarize}
                onChange={(v) => setConfig((c) => ({ ...c, binarize: v as ScanConfig["binarize"] }))}
                options={[
                  { value: "none", label: "Color" },
                  { value: "adaptive", label: "B&W" },
                  { value: "otsu", label: "High contrast" },
                ]}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text variant="titleSm">Export as</Text>
              <ChipGroup
                value={config.export_as}
                onChange={(v) => setConfig((c) => ({ ...c, export_as: v as ScanConfig["export_as"] }))}
                options={[
                  { value: "image", label: "JPEG", icon: "image-outline" },
                  { value: "pdf", label: "PDF", icon: "file-pdf-box" },
                ]}
              />
            </View>

            {scanner.error ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.colors.status.errorSoft, borderRadius: theme.radius.md }]}>
                <Text variant="bodySm" tone="error">
                  {scanner.error}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button
                label="Re-detect"
                variant="secondary"
                icon="auto-fix"
                onPress={() => scanner.detectEdges()}
                disabled={scanner.detecting}
                style={{ flex: 1 }}
                fullWidth
              />
              <Button
                label="Scan"
                icon="scan-helper"
                onPress={onProcess}
                loading={scanner.processing}
                disabled={scanner.processing || scanner.corners.length !== 4}
                style={{ flex: 1 }}
                fullWidth
              />
            </View>
          </>
        )}
      </Screen>
      <LoadingOverlay visible={scanner.processing} message="Processing document…" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { padding: 48, alignItems: "center", justifyContent: "center" },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  actions: { flexDirection: "row", gap: 10 },
  errorBanner: { padding: 12 },
});
