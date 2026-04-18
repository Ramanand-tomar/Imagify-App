import { StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import { useAppTheme } from "@/theme/useTheme";
import { Button } from "./Button";
import { Text } from "./Text";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = "inbox-outline", title, description, actionLabel, onAction }: EmptyStateProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.container}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.brand[50],
          marginBottom: theme.spacing.lg,
        }}
      >
        <Icon source={icon} size={36} color={theme.colors.brand[600]} />
      </View>
      <Text variant="h3" align="center">{title}</Text>
      {description ? (
        <Text variant="body" tone="secondary" align="center" style={{ marginTop: 6, maxWidth: 320 }}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: theme.spacing.xl }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: 32, paddingHorizontal: 24 },
});
