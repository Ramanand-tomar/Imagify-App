import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Badge, Card, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";
import { useAppTheme } from "@/theme/useTheme";

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ImageCompressScreen() {
  const theme = useAppTheme();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [quality, setQuality] = useState(75);
  const tool = usePdfTool({ endpoint: "/image/compress", asyncTask: false });

  const originalSize = file?.size ?? 0;
  const compressedSize = tool.result?.size_bytes ?? 0;
  const savingsPct =
    originalSize > 0 && compressedSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : null;

  return (
    <PdfToolShell
      title="Compress Image"
      subtitle="Re-encode as JPEG at the chosen quality level."
      submitLabel="Compress"
      canSubmit={!!file}
      onSubmit={() => file && tool.submit([file], { quality: String(Math.round(quality)) })}
      phase={tool.phase}
      uploadPercent={tool.uploadPercent}
      progress={tool.progress}
      error={tool.error}
      result={tool.result}
      activeTask={tool.activeTask}
      onReset={() => {
        setFile(null);
        tool.reset();
      }}
    >
      {!file ? (
        <FileUploader accept="image" onFilePicked={setFile} label="Choose an image" />
      ) : (
        <SelectedFileRow name={file.name} sizeBytes={file.size} icon="image-outline" onRemove={() => setFile(null)} />
      )}

      <View style={styles.qualityBlock}>
        <View style={styles.row}>
          <Text variant="titleSm">Quality</Text>
          <Text variant="titleSm" tone="brand">
            {Math.round(quality)}
          </Text>
        </View>
        <Slider
          minimumValue={10}
          maximumValue={100}
          step={1}
          value={quality}
          onValueChange={setQuality}
          minimumTrackTintColor={theme.colors.brand.default}
          maximumTrackTintColor={theme.colors.border.default}
          thumbTintColor={theme.colors.brand.default}
        />
      </View>

      {originalSize > 0 && compressedSize > 0 ? (
        <Card variant="tinted" tint={theme.colors.status.successSoft}>
          <View style={styles.comparison}>
            <Text variant="caption" tone="secondary">
              Original
            </Text>
            <Text variant="titleMd">{formatMB(originalSize)}</Text>
          </View>
          <View style={styles.comparison}>
            <Text variant="caption" tone="secondary">
              Compressed
            </Text>
            <Text variant="titleMd">{formatMB(compressedSize)}</Text>
          </View>
          {savingsPct !== null ? (
            <View style={{ marginTop: 10, alignItems: "flex-start" }}>
              <Badge label={`Saved ${savingsPct}%`} tone="success" icon="trending-down" size="md" />
            </View>
          ) : null}
        </Card>
      ) : null}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  qualityBlock: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  comparison: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
});
