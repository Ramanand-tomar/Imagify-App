import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { List, ProgressBar, Text, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { usePdfTool } from "@/hooks/usePdfTool";

function strength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 4) s += 1;
  if (pw.length >= 8) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  const bucket = Math.min(4, s);
  const meta = [
    { label: "Very weak", color: "#EF4444" },
    { label: "Weak", color: "#F59E0B" },
    { label: "Fair", color: "#EAB308" },
    { label: "Good", color: "#10B981" },
    { label: "Strong", color: "#059669" },
  ][bucket];
  return { score: bucket / 4, ...meta };
}

export default function ProtectScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState("");
  const tool = usePdfTool({ endpoint: "/pdf/protect", asyncTask: false });
  const st = useMemo(() => strength(password), [password]);

  return (
    <PdfToolShell
      title="Protect PDF"
      subtitle="Encrypt with AES-128. Password must be at least 4 characters."
      submitLabel="Protect"
      canSubmit={!!file && password.length >= 4}
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
          left={(p) => <List.Icon {...p} icon="file-pdf-box" />}
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
      {password.length > 0 && (
        <View style={styles.strengthRow}>
          <ProgressBar progress={st.score} color={st.color} style={styles.bar} />
          <Text variant="bodySmall" style={[styles.label, { color: st.color }]}>{st.label}</Text>
        </View>
      )}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 16, backgroundColor: "transparent" },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  label: { width: 80, textAlign: "right" },
});
