import { Modal, StyleSheet, View } from "react-native";
import { ActivityIndicator, ProgressBar, Text } from "react-native-paper";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
}

export function LoadingOverlay({ visible, message, progress }: LoadingOverlayProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" />
          {message && <Text variant="bodyMedium" style={styles.message}>{message}</Text>}
          {typeof progress === "number" && (
            <View style={styles.progressRow}>
              <ProgressBar progress={Math.max(0, Math.min(1, progress / 100))} style={styles.progress} />
              <Text variant="bodySmall" style={styles.percent}>{Math.round(progress)}%</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 24,
    width: 280,
    gap: 12,
    alignItems: "center",
  },
  message: { textAlign: "center", color: "#374151" },
  progressRow: { width: "100%", gap: 4 },
  progress: { height: 6, borderRadius: 3 },
  percent: { textAlign: "right", color: "#6B7280" },
});
