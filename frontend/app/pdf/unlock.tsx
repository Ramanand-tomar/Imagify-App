import { useState } from "react";
import { StyleSheet } from "react-native";
import { List, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function UnlockScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState("");
  const tool = usePdfTool({ endpoint: "/pdf/unlock", asyncTask: false });

  return (
    <PdfToolShell
      title="Unlock PDF"
      subtitle="Remove password protection by providing the current password."
      submitLabel="Unlock"
      canSubmit={!!file && password.length > 0}
      onSubmit={() => file && tool.submit([file], { password })}
      phase={tool.phase}
      uploadPercent={tool.uploadPercent}
      progress={tool.progress}
      error={tool.error}
      result={tool.result}
      activeTask={tool.activeTask}
      onReset={() => {
        setFile(null);
        setPassword("");
        tool.reset();
      }}
    >
      {!file ? (
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose PDF" />
      ) : (
        <List.Item
          title={file.name}
          description={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
          left={(p) => <List.Icon {...p} icon="file-lock" />}
          onPress={() => setFile(null)}
        />
      )}
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        mode="outlined"
        style={styles.field}
      />
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 16, backgroundColor: "transparent" },
});
