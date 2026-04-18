import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

interface SelectedFileRowProps {
  name: string;
  sizeBytes?: number;
  icon?: string;
  onRemove?: () => void;
  onMoveUp?: () => void;
  canMoveUp?: boolean;
  index?: number;
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function SelectedFileRow({
  name,
  sizeBytes,
  icon = "file-pdf-box",
  onRemove,
  onMoveUp,
  canMoveUp,
  index,
}: SelectedFileRowProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface.card,
          borderColor: theme.colors.border.subtle,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.brand[50] }]}>
        <Icon source={icon} size={20} color={theme.colors.brand.default} />
      </View>
      <View style={{ flex: 1 }}>
        {typeof index === "number" ? (
          <Text variant="caption" tone="muted" style={{ marginBottom: 2 }}>
            #{index + 1}
          </Text>
        ) : null}
        <Text variant="titleMd" numberOfLines={1}>
          {name}
        </Text>
        {sizeBytes !== undefined ? (
          <Text variant="caption" tone="secondary">
            {formatBytes(sizeBytes)}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onMoveUp ? (
          <Pressable
            onPress={onMoveUp}
            disabled={!canMoveUp}
            hitSlop={6}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: pressed ? theme.colors.surface.subtle : "transparent",
                opacity: canMoveUp ? 1 : 0.35,
              },
            ]}
          >
            <Icon source="arrow-up" size={18} color={theme.colors.text.secondary} />
          </Pressable>
        ) : null}
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={6}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: pressed ? theme.colors.status.errorSoft : "transparent" },
            ]}
          >
            <Icon source="close" size={18} color={theme.colors.status.error} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 4 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
