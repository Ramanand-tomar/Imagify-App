import { Stack } from "expo-router";
import { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ResultViewer } from "@/components/ResultViewer";
import { TaskProgressCard } from "@/components/TaskProgressCard";
import type { ToolResult } from "@/hooks/usePdfTool";
import type { Task } from "@/stores/taskStore";

interface PdfToolShellProps {
  title: string;
  subtitle?: string;
  /** UI for picking files + tool-specific options (forms, sliders, inputs) */
  children: ReactNode;
  /** Submit button label */
  submitLabel?: string;
  onSubmit: () => void;
  canSubmit: boolean;

  phase: "idle" | "uploading" | "processing" | "success" | "error";
  uploadPercent: number;
  progress: number;
  error: string | null;
  result: ToolResult | null;
  activeTask: Task | null;
  onReset: () => void;
}

export function PdfToolShell({
  title,
  subtitle,
  children,
  submitLabel = "Process",
  onSubmit,
  canSubmit,
  phase,
  uploadPercent,
  progress,
  error,
  result,
  activeTask,
  onReset,
}: PdfToolShellProps) {
  const busy = phase === "uploading" || phase === "processing";

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {subtitle && <Text variant="bodyMedium" style={styles.subtitle}>{subtitle}</Text>}

        <View style={styles.section}>{children}</View>

        {activeTask && phase === "processing" && (
          <View style={styles.section}>
            <TaskProgressCard task={activeTask} title={`${title} — in progress`} />
          </View>
        )}

        {result && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.resultTitle}>Result</Text>
            <ResultViewer
              filename={result.original_filename}
              mimeType={result.mime_type}
              sizeBytes={result.size_bytes}
              downloadUrl={result.download_url}
            />
          </View>
        )}

        {error && <HelperText type="error" visible>{error}</HelperText>}

        <View style={styles.actions}>
          {phase === "success" || phase === "error" ? (
            <Button mode="contained-tonal" icon="restart" onPress={onReset}>Start over</Button>
          ) : (
            <Button
              mode="contained"
              onPress={onSubmit}
              disabled={!canSubmit || busy}
              loading={busy}
            >
              {submitLabel}
            </Button>
          )}
        </View>
      </ScrollView>

      <LoadingOverlay
        visible={phase === "uploading"}
        message="Uploading file..."
        progress={uploadPercent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  subtitle: { color: "#6B7280", marginBottom: 12 },
  section: { marginBottom: 16 },
  resultTitle: { fontWeight: "700", marginBottom: 8 },
  actions: { marginTop: 8 },
});
