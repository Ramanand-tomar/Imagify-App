import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, List, Text } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
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
      subtitle="Combine 2–10 PDFs into a single file. Reorder using the arrows."
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
      <FileUploader accept="pdf" onFilePicked={add} label="Add PDF" />
      {files.length > 0 && (
        <View style={styles.list}>
          {files.map((f, i) => (
            <List.Item
              key={`${f.uri}-${i}`}
              title={f.name}
              description={`${(f.size / 1024 / 1024).toFixed(2)} MB`}
              left={(p) => <List.Icon {...p} icon="file-pdf-box" />}
              right={() => (
                <View style={styles.row}>
                  <Button compact onPress={() => moveUp(i)} disabled={i === 0}>↑</Button>
                  <Button compact onPress={() => remove(i)}>✕</Button>
                </View>
              )}
            />
          ))}
          <Text variant="bodySmall" style={styles.count}>
            {files.length}/10 files
          </Text>
        </View>
      )}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center" },
  count: { color: "#6B7280", textAlign: "right", marginTop: 4 },
});
