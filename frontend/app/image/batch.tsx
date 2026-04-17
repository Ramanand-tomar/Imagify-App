import { Stack } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, HelperText, IconButton, List, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ResultViewer } from "@/components/ResultViewer";
import { api } from "@/services/api";
import { useTaskStore, type BatchStatus } from "@/stores/taskStore";

type Operation = "compress" | "convert" | "resize" | "histogram" | "denoise";

export default function BatchImageScreen() {
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
        formData.append("files", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        });
      });
      formData.append("operation", operation);
      
      // Clean up params based on operation
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
      // histogram and denoise use defaults or extra params can be added here
      
      formData.append("params_json", JSON.stringify(finalParams));

      const { data } = await api.post("/image/batch", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (ev) => {
          if (ev.total) setUploadPercent(Math.round((ev.loaded * 100) / ev.total));
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

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Batch Processing" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Process up to 5 images simultaneously with the same operation.
        </Text>

        {phase === "idle" || phase === "error" ? (
          <>
            <View style={styles.section}>
              <FileUploader accept="image" onFilePicked={addFile} label="Add Images (Max 5)" />
              {files.length > 0 && (
                <View style={styles.fileList}>
                  {files.map((f, i) => (
                    <List.Item
                      key={`${f.uri}-${i}`}
                      title={f.name}
                      description={`${(f.size / 1024).toFixed(1)} KB`}
                      left={(p) => <List.Icon {...p} icon="image" />}
                      right={() => (
                        <IconButton icon="close" size={20} onPress={() => removeFile(i)} />
                      )}
                      style={styles.fileItem}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Select Operation</Text>
              <SegmentedButtons
                value={operation}
                onValueChange={(v) => setOperation(v as Operation)}
                buttons={[
                  { value: "compress", label: "Compress" },
                  { value: "convert", label: "Convert" },
                  { value: "resize", label: "Resize" },
                ]}
                style={styles.segmented}
              />
              <SegmentedButtons
                value={operation}
                onValueChange={(v) => setOperation(v as Operation)}
                buttons={[
                  { value: "histogram", label: "Histogram" },
                  { value: "denoise", label: "Denoise" },
                ]}
                style={styles.segmented}
              />
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Options</Text>
              {operation === "compress" && (
                <TextInput
                  label="Quality (1-100)"
                  value={params.quality}
                  onChangeText={(v) => handleUpdateParam("quality", v)}
                  keyboardType="numeric"
                  mode="outlined"
                />
              )}
              {operation === "convert" && (
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Format (jpg, png, webp)"
                      value={params.format}
                      onChangeText={(v) => handleUpdateParam("format", v)}
                      mode="outlined"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Quality"
                      value={params.quality}
                      onChangeText={(v) => handleUpdateParam("quality", v)}
                      keyboardType="numeric"
                      mode="outlined"
                    />
                  </View>
                </View>
              )}
              {operation === "resize" && (
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <TextInput
                      label="Width"
                      value={params.width}
                      onChangeText={(v) => handleUpdateParam("width", v)}
                      keyboardType="numeric"
                      mode="outlined"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      label="Height"
                      value={params.height}
                      onChangeText={(v) => handleUpdateParam("height", v)}
                      keyboardType="numeric"
                      mode="outlined"
                    />
                  </View>
                </View>
              )}
              {(operation === "histogram" || operation === "denoise") && (
                <Text variant="bodySmall">No additional parameters required for this operation.</Text>
              )}
            </View>
          </>
        ) : null}

        {phase === "processing" && batchStatus && (
          <View style={styles.section}>
            <Card style={styles.statusCard}>
              <Card.Content>
                <Text variant="titleMedium">Processing Batch...</Text>
                <Text variant="bodyMedium">
                  {batchStatus.completed}/{batchStatus.total} completed
                  {batchStatus.failed > 0 ? ` (${batchStatus.failed} failed)` : ""}
                </Text>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${(batchStatus.completed / batchStatus.total) * 100}%` }
                    ]} 
                  />
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        {phase === "success" && batchStatus && (
          <View style={styles.section}>
            <Text variant="titleLarge" style={styles.resultTitle}>Batch Results</Text>
            {batchStatus.results.map((res) => (
              <View key={res.task_id} style={{ marginBottom: 12 }}>
                <ResultViewer
                  filename={res.original_filename}
                  mimeType={res.mime_type}
                  sizeBytes={res.size_bytes}
                  downloadUrl={res.download_url}
                />
              </View>
            ))}
            <Button mode="contained-tonal" onPress={handleReset} style={styles.resetBtn}>
              Batch Again
            </Button>
          </View>
        )}

        {error && <HelperText type="error" visible>{error}</HelperText>}

        {phase === "idle" && (
          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={files.length === 0}
            style={styles.submitBtn}
          >
            Start Batch Process
          </Button>
        )}

        {phase === "error" && (
          <Button mode="contained-tonal" onPress={handleReset} style={styles.submitBtn}>
            Try Again
          </Button>
        )}
      </ScrollView>

      <LoadingOverlay
        visible={phase === "uploading"}
        message={`Uploading ${files.length} files...`}
        progress={uploadPercent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 16 },
  subtitle: { color: "#6B7280", marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontWeight: "700", marginBottom: 12 },
  fileList: { marginTop: 12, backgroundColor: "#F9FAFB", borderRadius: 8 },
  fileItem: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  segmented: { marginBottom: 8 },
  row: { flexDirection: "row" },
  submitBtn: { marginTop: 8 },
  resetBtn: { marginTop: 16 },
  statusCard: { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE", borderWidth: 1 },
  progressBarBg: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, marginTop: 12, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#4F46E5" },
  resultTitle: { fontWeight: "700", marginBottom: 16 },
});
