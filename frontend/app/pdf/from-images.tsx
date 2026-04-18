import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Badge, ChipGroup, SelectedFileRow, Text } from "@/components/ui";
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
      <FileUploader accept="image" onFilePicked={add} label={files.length === 0 ? "Add first image" : "Add another image"} />

      {files.length > 0 ? (
        <View style={styles.list}>
          <View style={styles.countRow}>
            <Text variant="titleSm" tone="secondary">
              Images to include
            </Text>
            <Badge label={`${files.length}/50`} tone={files.length >= 1 ? "success" : "neutral"} />
          </View>
          {files.map((f, i) => (
            <SelectedFileRow
              key={`${f.uri}-${i}`}
              name={f.name}
              sizeBytes={f.size}
              icon="image-outline"
              index={i}
              onRemove={() => remove(i)}
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text variant="titleSm">Page size</Text>
        <ChipGroup
          value={pageSize}
          onChange={setPageSize}
          options={[
            { value: "A4", label: "A4" },
            { value: "Letter", label: "Letter" },
            { value: "fit", label: "Fit to image" },
          ]}
        />
      </View>
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
