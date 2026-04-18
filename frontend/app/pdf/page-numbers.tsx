import { useState } from "react";
import { View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { ChipGroup, Input, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

const POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
type Position = (typeof POSITIONS)[number];

function label(p: Position): string {
  return p.replace("-", " · ");
}

export default function PageNumbersScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [startNumber, setStartNumber] = useState("1");
  const tool = usePdfTool({ endpoint: "/pdf/page-numbers", asyncTask: false });

  const start = parseInt(startNumber, 10);
  const startValid = Number.isFinite(start) && start >= 1;

  return (
    <PdfToolShell
      title="Add Page Numbers"
      subtitle="Stamp page numbers on every page."
      submitLabel="Add numbers"
      canSubmit={!!file && startValid}
      onSubmit={() => file && tool.submit([file], { position, start_number: String(start) })}
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
        <Text variant="titleSm">Position</Text>
        <ChipGroup
          wrap
          value={position}
          onChange={setPosition}
          options={POSITIONS.map((p) => ({ value: p, label: label(p) }))}
        />
      </View>
      <Input
        label="Start number"
        value={startNumber}
        onChangeText={setStartNumber}
        keyboardType="number-pad"
        leftIcon="numeric"
        errorText={!startValid ? "Start number must be a positive integer" : undefined}
      />
    </PdfToolShell>
  );
}
