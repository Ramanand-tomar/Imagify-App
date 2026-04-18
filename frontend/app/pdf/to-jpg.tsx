import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Input, SelectedFileRow } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function ToJpgScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [quality, setQuality] = useState("85");
  const [dpi, setDpi] = useState("150");
  const tool = usePdfTool({ endpoint: "/pdf/to-jpg", asyncTask: true });

  const q = parseInt(quality, 10);
  const d = parseInt(dpi, 10);
  const qValid = Number.isFinite(q) && q >= 30 && q <= 100;
  const dValid = Number.isFinite(d) && d >= 72 && d <= 300;

  return (
    <PdfToolShell
      title="PDF → JPG"
      subtitle="Export each page as a JPG. Result is a ZIP of page_001.jpg, page_002.jpg, …"
      submitLabel="Convert"
      canSubmit={!!file && qValid && dValid}
      onSubmit={() => file && tool.submit([file], { quality: String(q), dpi: String(d) })}
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
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Input
            label="Quality (30-100)"
            value={quality}
            onChangeText={setQuality}
            keyboardType="number-pad"
            errorText={!qValid ? "30–100" : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="DPI (72-300)"
            value={dpi}
            onChangeText={setDpi}
            keyboardType="number-pad"
            errorText={!dValid ? "72–300" : undefined}
          />
        </View>
      </View>
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
});
