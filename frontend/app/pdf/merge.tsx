import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Badge, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function MergeScreen() {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const tool = usePdfTool({ endpoint: "/pdf/merge", asyncTask: false });

  const add = (f: PickedFile) => setFiles((prev) => (prev.length < 10 ? [...prev, f] : prev));
  const remove = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const moveUp = (idx: number) =>
    setFiles((prev) => {
      if (idx === 0) return prev;
      const copy = [...prev];
      [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
      return copy;
    });

  return (
    <PdfToolShell
      title="Merge PDFs"
      subtitle="Combine 2–10 PDFs into one file. Reorder with the arrows."
      submitLabel={`Merge ${files.length} file${files.length === 1 ? "" : "s"}`}
      canSubmit={files.length >= 2}
      onSubmit={() => tool.submit(files, {})}
      phase={tool.phase}
      uploadPercent={tool.uploadPercent}
      progress={tool.progress}
      error={tool.error}
      result={tool.result}
      activeTask={tool.activeTask}
      onReset={() => {
        setFiles([]);
        tool.reset();
      }}
    >
      <FileUploader accept="pdf" onFilePicked={add} label={files.length === 0 ? "Add first PDF" : "Add another PDF"} />
      {files.length > 0 ? (
        <View style={styles.list}>
          <View style={styles.countRow}>
            <Text variant="titleSm" tone="secondary">
              Files in order
            </Text>
            <Badge label={`${files.length}/10`} tone={files.length >= 2 ? "success" : "neutral"} />
          </View>
          {files.map((f, i) => (
            <SelectedFileRow
              key={`${f.uri}-${i}`}
              name={f.name}
              sizeBytes={f.size}
              index={i}
              onMoveUp={() => moveUp(i)}
              canMoveUp={i > 0}
              onRemove={() => remove(i)}
            />
          ))}
        </View>
      ) : null}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
});
