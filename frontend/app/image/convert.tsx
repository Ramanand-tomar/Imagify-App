import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { ChipGroup, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";
import { useAppTheme } from "@/theme/useTheme";

type Format = "jpeg" | "png" | "webp" | "bmp" | "tiff";

export default function ImageConvertScreen() {
  const theme = useAppTheme();
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
      onSubmit={() => file && tool.submit([file], { target_format: format, quality: String(Math.round(quality)) })}
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
      <View style={{ gap: 8 }}>
        <Text variant="titleSm">Target format</Text>
        <ChipGroup
          wrap
          value={format}
          onChange={setFormat}
          options={(["jpeg", "png", "webp", "bmp", "tiff"] as Format[]).map((f) => ({ value: f, label: f.toUpperCase() }))}
        />
      </View>
      {qualityRelevant ? (
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
      ) : null}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  qualityBlock: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
