import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, List, Text } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

type Quality = "low" | "medium" | "high";

export default function CompressScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [quality, setQuality] = useState<Quality>("medium");
  const tool = usePdfTool({ endpoint: "/pdf/compress", asyncTask: true });

  const estimatedSize = (() => {
    if (!file) return "";
    const factor = quality === "low" ? 0.3 : quality === "medium" ? 0.55 : 0.8;
    return `~${(file.size * factor / 1024 / 1024).toFixed(2)} MB`;
  })();

  return (
    <PdfToolShell
      title="Compress PDF"
      subtitle="Pick a quality level. Processing runs in the background."
      submitLabel="Compress"
      canSubmit={!!file}
      onSubmit={() => file && tool.submit([file], { quality })}
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose PDF" />
      ) : (
        <List.Item
          title={file.name}
          description={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
          left={(p) => <List.Icon {...p} icon="file-pdf-box" />}
          onPress={() => setFile(null)}
        />
      )}
      <Text variant="titleSmall" style={styles.label}>Quality</Text>
      <View style={styles.chips}>
        {(["low", "medium", "high"] as Quality[]).map((q) => (
          <Chip key={q} selected={quality === q} onPress={() => setQuality(q)} style={styles.chip}>
            {q[0].toUpperCase() + q.slice(1)}
          </Chip>
        ))}
      </View>
      {file && (
        <Text variant="bodySmall" style={styles.estimate}>
          Estimated output: {estimatedSize}
        </Text>
      )}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 8 },
  chip: {},
  estimate: { color: "#6B7280", marginTop: 8 },
});
