import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { List, Text, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function ToJpgScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [quality, setQuality] = useState("85");
  const [dpi, setDpi] = useState("150");
  const tool = usePdfTool({ endpoint: "/pdf/to-jpg", asyncTask: true });

  const q = parseInt(quality, 10);
  const d = parseInt(dpi, 10);
  const qValid = Number.isFinite(q) && q >= 30 && q <= 100;
  const dValid = Number.isFinite(d) && d >= 72 && d <= 300;

  return (
    <PdfToolShell
      title="PDF → JPG"
      subtitle="Export each page as a JPG. Result is a ZIP of page_001.jpg, page_002.jpg, ..."
      submitLabel="Convert"
      canSubmit={!!file && qValid && dValid}
      onSubmit={() =>
        file && tool.submit([file], { quality: String(q), dpi: String(d) })
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose PDF" />
      ) : (
        <List.Item
          title={file.name}
          description={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
          left={(p) => <List.Icon {...p} icon="file-pdf-box" />}
          onPress={() => setFile(null)}
        />
      )}
      <Text variant="titleSmall" style={styles.label}>Quality: {quality}</Text>
      <View style={styles.row}>
        <TextInput
          label="Quality (30-100)"
          value={quality}
          onChangeText={setQuality}
          keyboardType="number-pad"
          mode="outlined"
          style={[styles.field, styles.flex]}
          error={!qValid}
        />
        <TextInput
          label="DPI (72-300)"
          value={dpi}
          onChangeText={setDpi}
          keyboardType="number-pad"
          mode="outlined"
          style={[styles.field, styles.flex]}
          error={!dValid}
        />
      </View>
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 4 },
  field: { marginTop: 8, backgroundColor: "transparent" },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
