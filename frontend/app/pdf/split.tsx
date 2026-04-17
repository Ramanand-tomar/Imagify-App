import { useState } from "react";
import { StyleSheet } from "react-native";
import { List, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose PDF" />
      ) : (
        <List.Item
          title={file.name}
          description={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
          left={(p) => <List.Icon {...p} icon="file-pdf-box" />}
          onPress={() => setFile(null)}
        />
      )}
      <TextInput
        label="Page ranges (e.g. 1-3,5-7)"
        value={ranges}
        onChangeText={setRanges}
        autoCapitalize="none"
        mode="outlined"
        style={styles.field}
      />
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 16, backgroundColor: "transparent" },
});
