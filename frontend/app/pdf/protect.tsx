import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Input, ProgressBar, SelectedFileRow, Text } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 4) s += 1;
  if (pw.length >= 8) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  const bucket = Math.min(4, s);
  const meta = [
    { label: "Very weak", tone: "error" as const },
    { label: "Weak", tone: "error" as const },
    { label: "Fair", tone: "warning" as const },
    { label: "Good", tone: "success" as const },
    { label: "Strong", tone: "success" as const },
  ][bucket];
  return { score: bucket / 4, ...meta };
}

export default function ProtectScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose a PDF" />
      ) : (
        <SelectedFileRow name={file.name} sizeBytes={file.size} onRemove={() => setFile(null)} />
      )}

      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        leftIcon="lock-outline"
        rightIcon={show ? "eye-off-outline" : "eye-outline"}
        onRightIconPress={() => setShow((s) => !s)}
      />

      {password.length > 0 ? (
        <View style={styles.strengthRow}>
          <View style={{ flex: 1 }}>
            <ProgressBar
              progress={st.score}
              tone={st.tone === "error" ? "error" : st.tone === "warning" ? "warning" : "success"}
            />
          </View>
          <Text
            variant="caption"
            tone={st.tone}
            weight="600"
          >
            {st.label}
          </Text>
        </View>
      ) : null}
    </PdfToolShell>
  );
}

const styles = StyleSheet.create({
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -4 },
});
