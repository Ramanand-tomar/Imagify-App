import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { List, Text } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ImageCompressScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [quality, setQuality] = useState(75);
  const tool = usePdfTool({ endpoint: "/image/compress", asyncTask: false });

  const originalSize = file?.size ?? 0;
  const compressedSize = tool.result?.size_bytes ?? 0;
  const savingsPct =
    originalSize > 0 && compressedSize > 0
      ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
      : null;

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
        <FileUploader accept="image" onFilePicked={setFile} label="Choose image" />
      ) : (
        <List.Item
          title={file.name}
          description={`${formatMB(file.size)} · ${file.mimeType}`}
          left={(p) => <List.Icon {...p} icon="image" />}
          onPress={() => setFile(null)}
        />
      )}
      <View style={styles.qualityBlock}>
        <View style={styles.row}>
          <Text variant="bodyMedium">Quality</Text>
          <Text variant="bodySmall" style={styles.qValue}>{Math.round(quality)}</Text>
        </View>
        <Slider minimumValue={10} maximumValue={100} step={1} value={quality} onValueChange={setQuality} />
      </View>
      {originalSize > 0 && compressedSize > 0 && (
        <View style={styles.comparison}>
          <Text variant="bodySmall" style={styles.cmpLabel}>Original: {formatMB(originalSize)}</Text>
          <Text variant="bodySmall" style={styles.cmpLabel}>Compressed: {formatMB(compressedSize)}</Text>
          {savingsPct !== null && (
            <Text variant="bodyMedium" style={styles.savings}>
              Saved {savingsPct}%
            </Text>
          )}
        </View>
      )}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  qualityBlock: { marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  qValue: { color: "#4F46E5", fontWeight: "700" },
  comparison: { marginTop: 12, gap: 4 },
  cmpLabel: { color: "#6B7280" },
  savings: { color: "#059669", fontWeight: "700", marginTop: 4 },
});
