import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, List, Text } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

type PageSize = "A4" | "Letter" | "fit";

export default function FromImagesScreen() {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("A4");
  const tool = usePdfTool({ endpoint: "/pdf/from-images", asyncTask: false });

  const add = (f: PickedFile) => setFiles((prev) => (prev.length < 50 ? [...prev, f] : prev));
  const remove = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  return (
    <PdfToolShell
      title="Images → PDF"
      subtitle="Combine up to 50 images into a single PDF."
      submitLabel={`Build PDF from ${files.length} image${files.length === 1 ? "" : "s"}`}
      canSubmit={files.length >= 1}
      onSubmit={() => tool.submit(files, { page_size: pageSize })}
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
      <FileUploader accept="image" onFilePicked={add} label="Add image" />
      {files.length > 0 && (
        <View style={styles.list}>
          {files.map((f, i) => (
            <List.Item
              key={`${f.uri}-${i}`}
              title={f.name}
              description={`${(f.size / 1024 / 1024).toFixed(2)} MB`}
              left={(p) => <List.Icon {...p} icon="image" />}
              right={() => <Button compact onPress={() => remove(i)}>✕</Button>}
            />
          ))}
          <Text variant="bodySmall" style={styles.count}>{files.length}/50 images</Text>
        </View>
      )}
      <Text variant="titleSmall" style={styles.label}>Page size</Text>
      <View style={styles.chips}>
        {(["A4", "Letter", "fit"] as PageSize[]).map((s) => (
          <Chip key={s} selected={pageSize === s} onPress={() => setPageSize(s)}>
            {s === "fit" ? "Fit image" : s}
          </Chip>
        ))}
      </View>
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 12 },
  count: { color: "#6B7280", textAlign: "right", marginTop: 4 },
  label: { marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 8 },
});
