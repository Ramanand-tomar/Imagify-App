import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, List, Text } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

type Format = "jpeg" | "png" | "webp" | "bmp" | "tiff";

export default function ImageConvertScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [format, setFormat] = useState<Format>("webp");
  const [quality, setQuality] = useState(90);
  const tool = usePdfTool({ endpoint: "/image/convert", asyncTask: false });

  const qualityRelevant = format === "jpeg" || format === "webp";

  return (
    <PdfToolShell
      title="Convert Image"
      subtitle="Change the image's file format."
      submitLabel={`Convert to ${format.toUpperCase()}`}
      canSubmit={!!file}
      onSubmit={() =>
        file &&
        tool.submit([file], { target_format: format, quality: String(Math.round(quality)) })
      }
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
          description={`${(file.size / 1024 / 1024).toFixed(2)} MB · ${file.mimeType}`}
          left={(p) => <List.Icon {...p} icon="image" />}
          onPress={() => setFile(null)}
        />
      )}
      <Text variant="titleSmall" style={styles.label}>Target format</Text>
      <View style={styles.chips}>
        {(["jpeg", "png", "webp", "bmp", "tiff"] as Format[]).map((f) => (
          <Chip key={f} selected={format === f} onPress={() => setFormat(f)}>
            {f.toUpperCase()}
          </Chip>
        ))}
      </View>
      {qualityRelevant && (
        <View style={styles.qualityBlock}>
          <View style={styles.row}>
            <Text variant="bodyMedium">Quality</Text>
            <Text variant="bodySmall" style={styles.qValue}>{Math.round(quality)}</Text>
          </View>
          <Slider minimumValue={10} maximumValue={100} step={1} value={quality} onValueChange={setQuality} />
        </View>
      )}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qualityBlock: { marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  qValue: { color: "#4F46E5", fontWeight: "700" },
});
