import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ResultViewer } from "@/components/ResultViewer";
import { TaskProgressCard } from "@/components/TaskProgressCard";
import { AppHeader, Button, Screen, SectionHeader, Text } from "@/components/ui";
import type { ToolResult } from "@/hooks/usePdfTool";
import type { Task } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";

interface PdfToolShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
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
  error,
  result,
  activeTask,
  onReset,
}: PdfToolShellProps) {
  const theme = useAppTheme();
  const busy = phase === "uploading" || phase === "processing";

  return (
    <>
      <AppHeader title={title} />
      <Screen>
        {subtitle ? (
          <Text variant="body" tone="secondary">
            {subtitle}
          </Text>
        ) : null}

        {children}

        {activeTask && phase === "processing" ? (
          <TaskProgressCard task={activeTask} title={`${title} — in progress`} />
        ) : null}

        {result ? (
          <View style={{ gap: 10 }}>
            <SectionHeader title="Result" />
            <ResultViewer
              filename={result.original_filename}
              mimeType={result.mime_type}
              sizeBytes={result.size_bytes}
              downloadUrl={result.download_url}
            />
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: theme.colors.status.errorSoft,
                borderColor: theme.colors.status.error,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text variant="bodySm" tone="error">
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {phase === "success" || phase === "error" ? (
            <Button label="Start over" icon="restart" variant="soft" onPress={onReset} fullWidth />
          ) : (
            <Button
              label={submitLabel}
              onPress={onSubmit}
              disabled={!canSubmit || busy}
              loading={busy}
              fullWidth
              size="lg"
            />
          )}
        </View>
      </Screen>
      <LoadingOverlay visible={phase === "uploading"} message="Uploading file..." progress={uploadPercent} />
    </>
  );
}

const styles = StyleSheet.create({
  errorBanner: { padding: 12, borderWidth: 1 },
  actions: { marginTop: 4 },
});
