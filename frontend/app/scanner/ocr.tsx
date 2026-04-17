import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system";
import React, { useState, useEffect } from "react";
import { ScrollView, StyleSheet, View, Share, Alert } from "react-native";
import { Button, Card, Menu, Text, TextInput, ActivityIndicator, IconButton, Divider, Snackbar } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from 'expo-clipboard';

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import { ocrService } from "@/services/ocrService";
import { useTaskStore } from "@/stores/taskStore";
import { api } from "@/services/api";

export default function OCRScreen() {
  const router = useRouter();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [language, setLanguage] = useState("eng");
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [languages, setLanguages] = useState<string[]>(["eng"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");

  const pollTask = useTaskStore((s) => s.pollTask);
  const activeTasks = useTaskStore((s) => s.active);

  useEffect(() => {
    ocrService.getLanguages().then((data) => {
      if (data.languages && data.languages.length > 0) {
        setLanguages(data.languages);
      }
    }).catch(() => {
      // fallback to eng
    });
  }, []);

  useEffect(() => {
    let unpoll: (() => void) | undefined;
    if (taskId) {
      unpoll = pollTask(taskId);
    }
    return () => unpoll?.();
  }, [taskId]);

  useEffect(() => {
    if (taskId && activeTasks[taskId]) {
      const task = activeTasks[taskId];
      if (task.status === "success") {
        fetchResult(taskId);
        setTaskId(null);
      } else if (task.status === "failed") {
        setSnackbarMsg(`Extraction failed: ${task.error_message}`);
        setSnackbarVisible(true);
        setLoading(false);
        setTaskId(null);
      }
    }
  }, [taskId, activeTasks]);

  const fetchResult = async (id: string) => {
    try {
      const res = await api.get<{ download_url: string }>(`/tasks/${id}/result`);
      const text = await fetch(res.data.download_url).then(r => r.text());
      setResult(text);
    } catch (err) {
      setSnackbarMsg("Failed to download extraction result.");
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const onExtract = async () => {
    if (!file) return;
    setLoading(true);
    setResult("");
    try {
      if (file.mimeType === "application/pdf") {
        const res = await ocrService.extractFromPdf(file.uri, file.name, language);
        setTaskId(res.task_id);
      } else {
        const data = await ocrService.extractFromImage(file.uri, file.name, language);
        setResult(data.text);
        setLoading(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Unknown error";
      setSnackbarMsg(`Error: ${msg}`);
      setSnackbarVisible(true);
      setLoading(false);
    }
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(result);
    setSnackbarMsg("Copied to clipboard!");
    setSnackbarVisible(true);
  };

  const onExport = async () => {
    try {
      const fileUri = FileSystem.cacheDirectory + (file?.name ? `${file.name.split('.')[0]}_extracted.txt` : "extracted.txt");
      await FileSystem.writeAsStringAsync(fileUri, result);
      await Share.share({
        url: fileUri,
        title: "OCR Result",
      });
    } catch (err) {
      Alert.alert("Export Error", "Failed to export result.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
            <IconButton icon="arrow-left" onPress={() => router.back()} />
            <Text variant="headlineSmall" style={styles.title}>Extract Text (OCR)</Text>
        </View>
        
        <Text variant="bodyMedium" style={styles.subtitle}>
          Turn images or PDFs into editable text using AI. Use clear photos for best results.
        </Text>

        <FileUploader 
          accept="any" 
          onFilePicked={setFile} 
          label={file ? `Selected: ${file.name}` : "Step 1: Pick an image or PDF"} 
        />

        <View style={styles.controls}>
          <View style={styles.langWrapper}>
            <Text variant="labelMedium">Language:</Text>
            <Menu
              visible={langMenuVisible}
              onDismiss={() => setLangMenuVisible(false)}
              anchor={
                <Button mode="outlined" onPress={() => setLangMenuVisible(true)} style={styles.langBtn}>
                  {language}
                </Button>
              }
            >
              <ScrollView style={{ maxHeight: 200 }}>
                {languages.map((l) => (
                  <Menu.Item
                    key={l}
                    onPress={() => {
                      setLanguage(l);
                      setLangMenuVisible(false);
                    }}
                    title={l}
                  />
                ))}
              </ScrollView>
            </Menu>
          </View>

          <Button 
            mode="contained" 
            onPress={onExtract} 
            loading={loading} 
            disabled={!file || loading}
            icon="auto-fix"
            style={styles.extractBtn}
          >
            Start
          </Button>
        </View>

        {loading && !result && (
          <View style={styles.statusArea}>
            <ActivityIndicator animating size="large" color="#4F46E5" />
            <Text variant="bodyMedium">
              {taskId ? "Running multi-page OCR..." : "Analyzing image..."}
            </Text>
          </View>
        )}

        {result ? (
          <Card style={styles.resultCard}>
            <Card.Content>
              <TextInput
                multiline
                value={result}
                onChangeText={setResult}
                mode="flat"
                style={styles.resultText}
                placeholder="OCR output will appear here..."
              />
            </Card.Content>
            <Divider />
            <Card.Actions>
              <Button icon="content-copy" onPress={onCopy}>Copy</Button>
              <Button icon="export-variant" onPress={onExport}>Export</Button>
            </Card.Actions>
          </Card>
        ) : null}
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
  title: { fontWeight: "700" },
  subtitle: { color: "#4B5563", marginBottom: 8 },
  controls: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  langWrapper: { flex: 1, gap: 4 },
  langBtn: { borderRadius: 8 },
  extractBtn: { flex: 1.2, height: 48, justifyContent: "center", borderRadius: 8 },
  statusArea: { padding: 40, alignItems: "center", gap: 16 },
  resultCard: { elevation: 2, borderRadius: 12, overflow: "hidden", backgroundColor: '#F9FAFB' },
  resultText: { backgroundColor: "transparent", minHeight: 250, fontSize: 14, lineHeight: 22 },
});
