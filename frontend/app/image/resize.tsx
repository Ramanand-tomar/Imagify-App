import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Switch } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Card, Input, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";
import { useAppTheme } from "@/theme/useTheme";

export default function ImageResizeScreen() {
  const theme = useAppTheme();
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
        <FileUploader accept="image" onFilePicked={setFile} label="Choose an image" />
      ) : (
        <SelectedFileRow name={file.name} sizeBytes={file.size} icon="image-outline" onRemove={() => setFile(null)} />
      )}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Input
            label="Width (px)"
            value={widthStr}
            onChangeText={setWidthStr}
            keyboardType="number-pad"
            leftIcon="arrow-expand-horizontal"
            errorText={!widthValid ? "1–10000" : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Height (px)"
            value={heightStr}
            onChangeText={setHeightStr}
            keyboardType="number-pad"
            leftIcon="arrow-expand-vertical"
            errorText={!heightValid ? "1–10000" : undefined}
          />
        </View>
      </View>
      <Card padded={false}>
        <View style={styles.ratioRow}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMd">Maintain aspect ratio</Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Prevents distortion when resizing
            </Text>
          </View>
          <Switch
            value={maintainRatio}
            onValueChange={setMaintainRatio}
            color={theme.colors.brand.default}
          />
        </View>
      </Card>
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  ratioRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
});
