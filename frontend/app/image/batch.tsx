import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ResultViewer } from "@/components/ResultViewer";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  ChipGroup,
  Input,
  ProgressBar,
  Screen,
  SectionHeader,
  SelectedFileRow,
  Text,
} from "@/components/ui";
import { api } from "@/services/api";
import { useTaskStore, type BatchStatus } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";

type Operation = "compress" | "convert" | "resize" | "histogram" | "denoise";

export default function BatchImageScreen() {
  const theme = useAppTheme();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [operation, setOperation] = useState<Operation>("compress");
  const [params, setParams] = useState<Record<string, string>>({
    quality: "80",
    format: "webp",
    width: "",
    height: "",
  });

  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);

  const pollBatch = useTaskStore((s) => s.pollBatch);

  const addFile = (f: PickedFile) => {
    if (files.length >= 5) {
      setError("Maximum 5 files allowed for batch processing.");
      return;
    }
    setFiles((prev) => [...prev, f]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateParam = (key: string, val: string) => {
    setParams((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError("Please select at least one image.");
      return;
    }

    try {
      setPhase("uploading");
      setError(null);
      setUploadPercent(0);

      const formData = new FormData();
      files.forEach((file) => {
        // @ts-ignore
        formData.append("files", { uri: file.uri, name: file.name, type: file.mimeType });
      });
      formData.append("operation", operation);

      const finalParams: Record<string, any> = {};
      if (operation === "compress") finalParams.quality = parseInt(params.quality) || 80;
      if (operation === "convert") {
        finalParams.format = params.format;
        finalParams.quality = parseInt(params.quality) || 80;
      }
      if (operation === "resize") {
        if (params.width) finalParams.width = parseInt(params.width);
        if (params.height) finalParams.height = parseInt(params.height);
        finalParams.maintain_ratio = true;
      }
      formData.append("params_json", JSON.stringify(finalParams));

      const { data } = await api.post("/image/batch", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (ev) => {
          if (ev.total) {
            const pct = Math.round((ev.loaded * 100) / ev.total);
            setUploadPercent(Math.min(100, Math.max(0, pct)));
          }
        },
      });

      setPhase("processing");
      pollBatch(data.batch_id, (status) => {
        setBatchStatus(status);
        if (status.completed + status.failed === status.total) {
          setPhase("success");
        }
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to start batch processing");
      setPhase("error");
    }
  };

  const handleReset = () => {
    setFiles([]);
    setBatchStatus(null);
    setPhase("idle");
    setError(null);
  };

  const operationOptions = [
    { value: "compress" as Operation, label: "Compress" },
    { value: "convert" as Operation, label: "Convert" },
    { value: "resize" as Operation, label: "Resize" },
    { value: "histogram" as Operation, label: "Histogram" },
    { value: "denoise" as Operation, label: "Denoise" },
  ];

  const isConfiguring = phase === "idle" || phase === "error";
  const batchProgress = batchStatus ? batchStatus.completed / batchStatus.total : 0;

  return (
    <>
      <AppHeader title="Batch Processing" subtitle="Run the same op on up to 5 images" />
      <Screen>

        {isConfiguring ? (
          <>
            <SectionHeader title="Images" subtitle="Add up to 5" />
            <FileUploader accept="image" onFilePicked={addFile} label={files.length === 0 ? "Add first image" : "Add another image"} />
            {files.length > 0 ? (
              <View style={{ gap: 8 }}>
                <View style={styles.countRow}>
                  <Text variant="titleSm" tone="secondary">
                    Selected
                  </Text>
                  <Badge label={`${files.length}/5`} tone={files.length > 0 ? "success" : "neutral"} />
                </View>
                {files.map((f, i) => (
                  <SelectedFileRow
                    key={`${f.uri}-${i}`}
                    name={f.name}
                    sizeBytes={f.size}
                    icon="image-outline"
                    index={i}
                    onRemove={() => removeFile(i)}
                  />
                ))}
              </View>
            ) : null}

            <SectionHeader title="Operation" />
            <ChipGroup wrap value={operation} onChange={setOperation} options={operationOptions} />

            <SectionHeader title="Options" />
            {operation === "compress" ? (
              <Input label="Quality (1-100)" value={params.quality} onChangeText={(v) => handleUpdateParam("quality", v)} keyboardType="numeric" leftIcon="quality-high" />
            ) : null}
            {operation === "convert" ? (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Input label="Format" value={params.format} onChangeText={(v) => handleUpdateParam("format", v)} leftIcon="image-sync" helper="jpg · png · webp" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Quality" value={params.quality} onChangeText={(v) => handleUpdateParam("quality", v)} keyboardType="numeric" />
                </View>
              </View>
            ) : null}
            {operation === "resize" ? (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Input label="Width (px)" value={params.width} onChangeText={(v) => handleUpdateParam("width", v)} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Height (px)" value={params.height} onChangeText={(v) => handleUpdateParam("height", v)} keyboardType="numeric" />
                </View>
              </View>
            ) : null}
            {(operation === "histogram" || operation === "denoise") ? (
              <Card variant="tinted">
                <Text variant="bodySm" tone="secondary">
                  No additional parameters required for this operation.
                </Text>
              </Card>
            ) : null}
          </>
        ) : null}

        {phase === "processing" && batchStatus ? (
          <Card variant="tinted">
            <View style={styles.statusRow}>
              <Text variant="titleMd">Processing…</Text>
              <Badge label={`${batchStatus.completed}/${batchStatus.total}`} tone="brand" />
            </View>
            {batchStatus.failed > 0 ? (
              <Text variant="caption" tone="error" style={{ marginTop: 4 }}>
                {batchStatus.failed} failed
              </Text>
            ) : null}
            <ProgressBar progress={batchProgress} style={{ marginTop: 10 }} />
          </Card>
        ) : null}

        {phase === "success" && batchStatus ? (
          <View style={{ gap: 10 }}>
            <SectionHeader title="Results" subtitle={`${batchStatus.results.length} files ready`} />
            {batchStatus.results.map((res) => (
              <ResultViewer
                key={res.task_id}
                filename={res.original_filename}
                mimeType={res.mime_type}
                sizeBytes={res.size_bytes}
                downloadUrl={res.download_url}
              />
            ))}
            <Button label="Start new batch" icon="restart" variant="soft" onPress={handleReset} fullWidth />
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.status.errorSoft, borderRadius: theme.radius.md }]}>
            <Text variant="bodySm" tone="error">
              {error}
            </Text>
          </View>
        ) : null}

        {phase === "idle" ? (
          <Button label="Start batch process" onPress={handleSubmit} disabled={files.length === 0} fullWidth size="lg" />
        ) : null}
        {phase === "error" ? (
          <Button label="Try again" variant="soft" icon="restart" onPress={handleReset} fullWidth />
        ) : null}
      </Screen>
      <LoadingOverlay visible={phase === "uploading"} message={`Uploading ${files.length} files...`} progress={uploadPercent} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  errorBanner: { padding: 12 },
});
