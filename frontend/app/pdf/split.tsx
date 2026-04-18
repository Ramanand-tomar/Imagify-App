import { useState } from "react";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Input, SelectedFileRow } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function SplitScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [ranges, setRanges] = useState("1-3");
  const tool = usePdfTool({ endpoint: "/pdf/split", asyncTask: false });

  return (
    <PdfToolShell
      title="Split PDF"
      subtitle="Extract page ranges. Multiple ranges will be zipped."
      submitLabel="Split"
      canSubmit={!!file && ranges.trim().length > 0}
      onSubmit={() => file && tool.submit([file], { ranges })}
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
      <Input
        label="Page ranges"
        value={ranges}
        onChangeText={setRanges}
        autoCapitalize="none"
        leftIcon="format-list-numbered"
        helper="Examples: 1-3  ·  1-3,5-7  ·  2"
      />
    </PdfToolShell>
  );
}
