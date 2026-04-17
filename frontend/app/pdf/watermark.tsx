import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { List, Text, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function WatermarkScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState("0.3");
  const [fontSize, setFontSize] = useState("48");
  const [rotation, setRotation] = useState("30");
  const tool = usePdfTool({ endpoint: "/pdf/watermark", asyncTask: false });

  const opacityNum = parseFloat(opacity);
  const opacityValid = Number.isFinite(opacityNum) && opacityNum > 0 && opacityNum <= 1;
  const fsNum = parseInt(fontSize, 10);
  const fsValid = Number.isFinite(fsNum) && fsNum >= 8 && fsNum <= 200;

  return (
    <PdfToolShell
      title="Watermark PDF"
      subtitle="Overlay text on every page."
      submitLabel="Add watermark"
      canSubmit={!!file && text.trim().length > 0 && opacityValid && fsValid}
      onSubmit={() =>
        file &&
        tool.submit([file], {
          text,
          opacity: String(opacityNum),
          font_size: String(fsNum),
          rotation,
        })
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
      <TextInput
        label="Watermark text"
        value={text}
        onChangeText={setText}
        mode="outlined"
        style={styles.field}
      />
      <View style={styles.row}>
        <TextInput
          label="Opacity (0-1)"
          value={opacity}
          onChangeText={setOpacity}
          keyboardType="decimal-pad"
          mode="outlined"
          style={[styles.field, styles.flex]}
          error={!opacityValid}
        />
        <TextInput
          label="Font size"
          value={fontSize}
          onChangeText={setFontSize}
          keyboardType="number-pad"
          mode="outlined"
          style={[styles.field, styles.flex]}
          error={!fsValid}
        />
      </View>
      <TextInput
        label="Rotation (°)"
        value={rotation}
        onChangeText={setRotation}
        keyboardType="number-pad"
        mode="outlined"
        style={styles.field}
      />
      <Text variant="bodySmall" style={styles.hint}>
        Tip: 30° rotation with 0.2–0.4 opacity looks like a typical CONFIDENTIAL stamp.
      </Text>
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 12, backgroundColor: "transparent" },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  hint: { color: "#6B7280", marginTop: 8 },
});
