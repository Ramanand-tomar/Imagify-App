import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, List, Text, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function RotateScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [degrees, setDegrees] = useState<90 | 180 | 270>(90);
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
          degrees: String(degrees),
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose PDF" />
      ) : (
        <List.Item
          title={file.name}
          description={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
          left={(p) => <List.Icon {...p} icon="file-pdf-box" />}
          onPress={() => setFile(null)}
        />
      )}
      <Text variant="titleSmall" style={styles.label}>Angle</Text>
      <View style={styles.chips}>
        {[90, 180, 270].map((d) => (
          <Chip
            key={d}
            selected={degrees === d}
            onPress={() => setDegrees(d as 90 | 180 | 270)}
            icon="rotate-right"
          >
            {d}°
          </Chip>
        ))}
      </View>
      <TextInput
        label="Pages (e.g. 1,3,5-7)"
        placeholder="Leave blank for all pages"
        value={pages}
        onChangeText={setPages}
        mode="outlined"
        style={styles.field}
      />
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", gap: 8 },
  field: { marginTop: 16, backgroundColor: "transparent" },
});
