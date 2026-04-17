import { useState } from "react";
import { List } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose PDF" />
      ) : (
        <List.Item
          title={file.name}
          description={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
          left={(p) => <List.Icon {...p} icon="file-pdf-box" />}
          onPress={() => setFile(null)}
        />
      )}
    </PdfToolShell>
  );
}
