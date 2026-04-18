import { useState } from "react";
import { View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { ChipGroup, Input, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

type Angle = "90" | "180" | "270";

export default function RotateScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [degrees, setDegrees] = useState<Angle>("90");
  const [pages, setPages] = useState("");
  const tool = usePdfTool({ endpoint: "/pdf/rotate", asyncTask: false });

  return (
    <PdfToolShell
      title="Rotate PDF"
      subtitle="Rotate all or selected pages by 90, 180, or 270°."
      submitLabel="Rotate"
      canSubmit={!!file}
      onSubmit={() =>
        file &&
        tool.submit([file], {
          degrees,
          ...(pages.trim() ? { pages: pages.trim() } : {}),
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose a PDF" />
      ) : (
        <SelectedFileRow name={file.name} sizeBytes={file.size} onRemove={() => setFile(null)} />
      )}
      <View style={{ gap: 8 }}>
        <Text variant="titleSm">Angle</Text>
        <ChipGroup
          value={degrees}
          onChange={setDegrees}
          options={[
            { value: "90", label: "90°", icon: "rotate-right" },
            { value: "180", label: "180°", icon: "rotate-right" },
            { value: "270", label: "270°", icon: "rotate-left" },
          ]}
        />
      </View>
      <Input
        label="Pages (optional)"
        placeholder="e.g. 1,3,5-7 — leave blank for all"
        value={pages}
        onChangeText={setPages}
        leftIcon="format-list-bulleted"
      />
    </PdfToolShell>
  );
}
