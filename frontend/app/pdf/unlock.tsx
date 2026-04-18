import { useState } from "react";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { PdfToolShell } from "@/components/PdfToolShell";
import { Input, SelectedFileRow } from "@/components/ui";
import { usePdfTool } from "@/hooks/usePdfTool";

export default function UnlockScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
        <FileUploader accept="pdf" onFilePicked={setFile} label="Choose a PDF" />
      ) : (
        <SelectedFileRow name={file.name} sizeBytes={file.size} icon="file-lock" onRemove={() => setFile(null)} />
      )}
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!show}
        leftIcon="lock-open-outline"
        rightIcon={show ? "eye-off-outline" : "eye-outline"}
        onRightIconPress={() => setShow((s) => !s)}
      />
    </PdfToolShell>
  );
}
