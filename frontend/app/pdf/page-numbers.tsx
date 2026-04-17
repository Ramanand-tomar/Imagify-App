import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, List, Text, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

const POSITIONS = [
  "top-left", "top-center", "top-right",
  "bottom-left", "bottom-center", "bottom-right",
] as const;

type Position = (typeof POSITIONS)[number];

export default function PageNumbersScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [position, setPosition] = useState<Position>("bottom-center");
  const [startNumber, setStartNumber] = useState("1");
  const tool = usePdfTool({ endpoint: "/pdf/page-numbers", asyncTask: false });

  const start = parseInt(startNumber, 10);
  const startValid = Number.isFinite(start) && start >= 1;

  return (
    <PdfToolShell
      title="Add Page Numbers"
      submitLabel="Add numbers"
      canSubmit={!!file && startValid}
      onSubmit={() =>
        file && tool.submit([file], { position, start_number: String(start) })
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
      <Text variant="titleSmall" style={styles.label}>Position</Text>
      <View style={styles.grid}>
        {POSITIONS.map((p) => (
          <Chip
            key={p}
            selected={position === p}
            onPress={() => setPosition(p)}
            style={styles.chip}
          >
            {p.replace("-", " ")}
          </Chip>
        ))}
      </View>
      <TextInput
        label="Start number"
        value={startNumber}
        onChangeText={setStartNumber}
        keyboardType="number-pad"
        mode="outlined"
        style={styles.field}
        error={!startValid}
      />
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {},
  field: { marginTop: 16, backgroundColor: "transparent" },
});
