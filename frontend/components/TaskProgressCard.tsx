import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import type { Task } from "@/stores/taskStore";
import { Badge, Card, ProgressBar, Text } from "@/components/ui";
import { useAppTheme } from "@/theme/useTheme";
import type { BadgeTone } from "@/components/ui";

interface TaskProgressCardProps {
  task: Task;
  title?: string;
  /** Optional callback that, when provided, shows a small trash icon. */
  onDelete?: (task: Task) => void;
  /** Disable the delete button while a request is in flight. */
  deleting?: boolean;
}

function statusMeta(
  status: Task["status"],
): { label: string; tone: BadgeTone; icon: string; progressTone: "brand" | "success" | "warning" | "error" } {
  switch (status) {
    case "pending":
      return { label: "Queued", tone: "neutral", icon: "clock-outline", progressTone: "brand" };
    case "in_progress":
      return { label: "Processing", tone: "brand", icon: "progress-clock", progressTone: "brand" };
    case "success":
      return { label: "Done", tone: "success", icon: "check-circle", progressTone: "success" };
    case "failed":
      return { label: "Failed", tone: "error", icon: "alert-circle", progressTone: "error" };
  }
}

function formatTaskType(t: Task["task_type"]): string {
  if (t === "ai") return "AI Enhance";
  if (t === "ocr") return "OCR";
  if (t === "pdf") return "PDF task";
  return "Image task";
}

export function TaskProgressCard({ task, title, onDelete, deleting }: TaskProgressCardProps) {
  const theme = useAppTheme();
  const meta = statusMeta(task.status);
  const pct = Math.max(0, Math.min(1, task.progress / 100));
  const busy = task.status === "in_progress" || task.status === "pending";

  return (
    <Card variant="elevated" radius="lg">
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: theme.colors.brand[50], borderColor: theme.colors.brand[100] },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.brand[600]} />
          ) : (
            <Icon
              source={meta.icon}
              size={20}
              color={task.status === "success" ? theme.colors.status.success : task.status === "failed" ? theme.colors.status.error : theme.colors.brand[600]}
            />
          )}
        </View>
        <View style={styles.headerText}>
          <Text variant="titleMd" numberOfLines={1}>
            {title ?? formatTaskType(task.task_type)}
          </Text>
          <Text variant="caption" tone="muted">
            {task.progress}%
          </Text>
        </View>
        <Badge label={meta.label} tone={meta.tone} />
        {onDelete ? (
          <Pressable
            onPress={() => onDelete(task)}
            hitSlop={8}
            disabled={busy || deleting}
            accessibilityLabel="Delete task"
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                backgroundColor: pressed ? theme.colors.status.errorSoft : "transparent",
                opacity: busy || deleting ? 0.4 : 1,
              },
            ]}
          >
            <Icon source="trash-can-outline" size={16} color={theme.colors.status.error} />
          </Pressable>
        ) : null}
      </View>
      <ProgressBar progress={pct} tone={meta.progressTone} style={{ marginTop: 12 }} />
      {task.error_message ? (
        <Text variant="caption" tone="error" style={{ marginTop: 8 }} numberOfLines={2}>
          {task.error_message}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
