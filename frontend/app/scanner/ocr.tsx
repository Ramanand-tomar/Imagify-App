import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { Icon, Menu, TextInput } from "react-native-paper";

import { FileUploader, type PickedFile } from "@/components/FileUploader";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Screen,
  SectionHeader,
  SelectedFileRow,
  Text,
} from "@/components/ui";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { api } from "@/services/api";
import { ocrService } from "@/services/ocrService";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";
import { resolveUrl } from "@/utils/env";
import { extractErrorMessage } from "@/utils/errors";

export default function OCRScreen() {
  const theme = useAppTheme();
  const snackbar = useSnackbar();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [language, setLanguage] = useState("eng");
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [languages, setLanguages] = useState<string[]>(["eng"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);

  const pollTask = useTaskStore((s) => s.pollTask);
  const activeTasks = useTaskStore((s) => s.active);

  useEffect(() => {
    ocrService
      .getLanguages()
      .then((data) => {
        if (data.languages && data.languages.length > 0) {
          setLanguages(data.languages);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let unpoll: (() => void) | undefined;
    if (taskId) {
      unpoll = pollTask(taskId);
    }
    return () => unpoll?.();
  }, [taskId, pollTask]);

  useEffect(() => {
    if (taskId && activeTasks[taskId]) {
      const task = activeTasks[taskId];
      if (task.status === "success") {
        fetchResult(taskId);
        setTaskId(null);
      } else if (task.status === "failed") {
        snackbar.error(`Extraction failed: ${task.error_message}`);
        setLoading(false);
        setTaskId(null);
      }
    }
  }, [taskId, activeTasks]);

  const fetchResult = async (id: string) => {
    try {
      const res = await api.get<{ download_url: string }>(`/tasks/${id}/result`);
      if (!res.data?.download_url) throw new Error("Missing download_url");
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(resolveUrl(res.data.download_url), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);
      setResult(await response.text());
    } catch (err) {
      snackbar.error(extractErrorMessage(err, "Failed to download extraction result."));
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
    } catch (err: unknown) {
      snackbar.error(`Error: ${extractErrorMessage(err, "Unknown error")}`);
      setLoading(false);
    }
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(result);
    snackbar.success("Copied to clipboard");
  };

  const onExport = async () => {
    try {
      const fileUri =
        FileSystem.cacheDirectory +
        (file?.name ? `${file.name.split(".")[0]}_extracted.txt` : "extracted.txt");
      await FileSystem.writeAsStringAsync(fileUri, result);
      await Share.share({ url: fileUri, title: "OCR Result" });
    } catch {
      Alert.alert("Export Error", "Failed to export result.");
    }
  };

  return (
    <>
      <AppHeader title="Extract text" subtitle="OCR for images and PDFs" />
      <Screen>
        <Text variant="body" tone="secondary">
          Turn images or PDFs into editable text using AI.
        </Text>

        {!file ? (
          <FileUploader accept="any" onFilePicked={setFile} label="Pick an image or PDF" />
        ) : (
          <SelectedFileRow
            name={file.name}
            sizeBytes={file.size}
            icon={file.mimeType === "application/pdf" ? "file-pdf-box" : "image-outline"}
            onRemove={() => {
              setFile(null);
              setResult("");
            }}
          />
        )}

        <View style={styles.controlsRow}>
          <View style={{ flex: 1 }}>
            <Text variant="label" tone="secondary" style={{ marginBottom: 6 }}>
              Language
            </Text>
            <Menu
              visible={langMenuVisible}
              onDismiss={() => setLangMenuVisible(false)}
              anchor={
                <Pressable
                  onPress={() => setLangMenuVisible(true)}
                  style={({ pressed }) => [
                    styles.langBtn,
                    {
                      borderColor: theme.colors.border.default,
                      backgroundColor: pressed ? theme.colors.surface.subtle : theme.colors.surface.card,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <Icon source="translate" size={18} color={theme.colors.text.secondary} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {language.toUpperCase()}
                  </Text>
                  <Icon source="menu-down" size={18} color={theme.colors.text.secondary} />
                </Pressable>
              }
            >
              {languages.map((l) => (
                <Menu.Item
                  key={l}
                  onPress={() => {
                    setLanguage(l);
                    setLangMenuVisible(false);
                  }}
                  title={l.toUpperCase()}
                />
              ))}
            </Menu>
          </View>
          <View style={{ flex: 1.2, alignSelf: "flex-end" }}>
            <Button
              label="Extract"
              icon="auto-fix"
              onPress={onExtract}
              loading={loading}
              disabled={!file || loading}
              fullWidth
              size="lg"
            />
          </View>
        </View>

        {loading && !result ? (
          <Card>
            <View style={styles.statusArea}>
              <ActivityIndicator size="large" color={theme.colors.brand.default} />
              <Text variant="body">{taskId ? "Running multi-page OCR…" : "Analyzing image…"}</Text>
            </View>
          </Card>
        ) : null}

        {result ? (
          <>
            <SectionHeader
              title="Extracted text"
              actionLabel={`${result.length} chars`}
              onAction={() => {}}
            />
            <Card>
              <View style={styles.resultHeader}>
                <Badge label={language.toUpperCase()} tone="brand" icon="translate" />
              </View>
              <TextInput
                multiline
                value={result}
                onChangeText={setResult}
                mode="flat"
                style={[styles.resultText, { backgroundColor: "transparent", fontFamily: theme.fontFamily.regular }]}
                placeholder="OCR output will appear here…"
                underlineColor="transparent"
                activeUnderlineColor="transparent"
              />
              <View style={styles.resultActions}>
                <Button label="Copy" icon="content-copy" variant="secondary" onPress={onCopy} style={{ flex: 1 }} fullWidth />
                <Button label="Export" icon="export-variant" variant="soft" onPress={onExport} style={{ flex: 1 }} fullWidth />
              </View>
            </Card>
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  controlsRow: { flexDirection: "row", gap: 10 },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
  },
  statusArea: { padding: 24, alignItems: "center", gap: 12 },
  resultHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  resultText: { minHeight: 220, fontSize: 14, lineHeight: 22 },
  resultActions: { flexDirection: "row", gap: 10, marginTop: 12 },
});
