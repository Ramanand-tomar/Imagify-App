import { useState } from "react";
import { View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Card, ChipGroup, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

type Quality = "low" | "medium" | "high";

export default function CompressScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [quality, setQuality] = useState<Quality>("medium");
  const tool = usePdfTool({ endpoint: "/pdf/compress", asyncTask: true });

  const estimatedSize = (() => {
    if (!file) return "";
    const factor = quality === "low" ? 0.3 : quality === "medium" ? 0.55 : 0.8;
    return `~${((file.size * factor) / 1024 / 1024).toFixed(2)} MB`;
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose a PDF" />
      ) : (
        <SelectedFileRow name={file.name} sizeBytes={file.size} onRemove={() => setFile(null)} />
      )}

      <View style={{ gap: 8 }}>
        <Text variant="titleSm">Quality</Text>
        <ChipGroup
          value={quality}
          onChange={setQuality}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
        />
      </View>

      {file ? (
        <Card variant="tinted">
          <Text variant="caption" tone="secondary">
            Estimated output
          </Text>
          <Text variant="h3" style={{ marginTop: 4 }}>
            {estimatedSize}
          </Text>
        </Card>
      ) : null}
    </PdfToolShell>
  );
}
