import { useState } from "react";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Card, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function RepairScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const tool = usePdfTool({ endpoint: "/pdf/repair", asyncTask: false });

  return (
    <PdfToolShell
      title="Repair PDF"
      subtitle="Best-effort reparse for PDFs that won't open normally."
      submitLabel="Repair"
      canSubmit={!!file}
      onSubmit={() => file && tool.submit([file], {})}
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
      <Card variant="tinted">
        <Text variant="titleSm" tone="brand">
          What this does
        </Text>
        <Text variant="bodySm" tone="secondary" style={{ marginTop: 6 }}>
          Attempts to recover text and page structure from PDFs with damaged or partial data. Output
          may not be byte-identical to the original but should open in standard viewers.
        </Text>
      </Card>
    </PdfToolShell>
  );
}
