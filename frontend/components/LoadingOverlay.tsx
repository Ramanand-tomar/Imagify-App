import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";

import { ProgressBar, Text } from "@/components/ui";
import { useAppTheme } from "@/theme/useTheme";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
}

export function LoadingOverlay({ visible, message, progress }: LoadingOverlayProps) {
  const theme = useAppTheme();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={[styles.backdrop, { backgroundColor: theme.colors.surface.overlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface.card,
              borderRadius: theme.radius.xl,
              ...theme.shadow.lg,
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.brand.default} />
          {message ? (
            <Text variant="bodyLg" align="center" style={{ marginTop: 4 }}>
              {message}
            </Text>
          ) : null}
          {typeof progress === "number" ? (
            <View style={styles.progressWrap}>
              <ProgressBar progress={Math.max(0, Math.min(1, progress / 100))} />
              <Text variant="caption" tone="muted" align="right" style={{ marginTop: 6 }}>
                {Math.round(progress)}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: 24, width: 280, gap: 16, alignItems: "center" },
  progressWrap: { width: "100%" },
});
