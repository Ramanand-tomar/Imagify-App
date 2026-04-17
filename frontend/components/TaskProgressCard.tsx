import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Icon, ProgressBar, Text } from "react-native-paper";

import type { Task } from "@/stores/taskStore";

interface TaskProgressCardProps {
  task: Task;
  title?: string;
}

function statusMeta(status: Task["status"]) {
  switch (status) {
    case "pending":
      return { label: "Queued", color: "#6B7280", icon: "clock-outline" };
    case "in_progress":
      return { label: "Processing", color: "#4F46E5", icon: "progress-clock" };
    case "success":
      return { label: "Done", color: "#059669", icon: "check-circle" };
    case "failed":
      return { label: "Failed", color: "#DC2626", icon: "alert-circle" };
  }
}

export function TaskProgressCard({ task, title }: TaskProgressCardProps) {
  const meta = statusMeta(task.status);
  const pct = task.progress / 100;

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            {task.status === "in_progress" || task.status === "pending" ? (
              <ActivityIndicator size="small" color={meta.color} />
            ) : (
              <Icon source={meta.icon} size={22} color={meta.color} />
            )}
          </View>
          <View style={styles.headerText}>
            <Text variant="titleSmall" numberOfLines={1}>
              {title ?? `${task.task_type.toUpperCase()} task`}
            </Text>
            <Text variant="bodySmall" style={{ color: meta.color }}>{meta.label}</Text>
          </View>
          <Text variant="bodySmall" style={styles.percent}>{task.progress}%</Text>
        </View>
        <ProgressBar progress={pct} color={meta.color} style={styles.bar} />
        {task.error_message && (
          <Text variant="bodySmall" style={styles.error} numberOfLines={2}>
            {task.error_message}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: 6 },
  content: { gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 24, alignItems: "center" },
  headerText: { flex: 1 },
  percent: { color: "#6B7280" },
  bar: { height: 6, borderRadius: 3 },
  error: { color: "#DC2626" },
});
