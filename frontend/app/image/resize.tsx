import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { List, Switch, Text, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function ImageResizeScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [widthStr, setWidthStr] = useState("");
  const [heightStr, setHeightStr] = useState("");
  const [maintainRatio, setMaintainRatio] = useState(true);
  const tool = usePdfTool({ endpoint: "/image/resize", asyncTask: false });

  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);
  const widthValid = !widthStr || (Number.isFinite(width) && width >= 1 && width <= 10000);
  const heightValid = !heightStr || (Number.isFinite(height) && height >= 1 && height <= 10000);
  const hasDims = widthStr.length > 0 || heightStr.length > 0;

  const submit = () => {
    if (!file) return;
    const extra: Record<string, string> = { maintain_ratio: String(maintainRatio) };
    if (widthStr) extra.width = String(width);
    if (heightStr) extra.height = String(height);
    tool.submit([file], extra);
  };

  return (
    <PdfToolShell
      title="Resize Image"
      subtitle="Provide width, height, or both. Keep aspect ratio is on by default."
      submitLabel="Resize"
      canSubmit={!!file && widthValid && heightValid && hasDims}
      onSubmit={submit}
      phase={tool.phase}
      uploadPercent={tool.uploadPercent}
      progress={tool.progress}
      error={tool.error}
      result={tool.result}
      activeTask={tool.activeTask}
      onReset={() => {
        setFile(null);
        setWidthStr("");
        setHeightStr("");
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
      <View style={styles.row}>
        <TextInput
          label="Width (px)"
          value={widthStr}
          onChangeText={setWidthStr}
          keyboardType="number-pad"
          mode="outlined"
          style={[styles.field, styles.flex]}
          error={!widthValid}
        />
        <TextInput
          label="Height (px)"
          value={heightStr}
          onChangeText={setHeightStr}
          keyboardType="number-pad"
          mode="outlined"
          style={[styles.field, styles.flex]}
          error={!heightValid}
        />
      </View>
      <View style={styles.ratioRow}>
        <Text variant="bodyMedium">Maintain aspect ratio</Text>
        <Switch value={maintainRatio} onValueChange={setMaintainRatio} />
      </View>
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 12, backgroundColor: "transparent" },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  ratioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
});
