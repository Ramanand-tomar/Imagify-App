import { Pressable, StyleSheet, View } from "react-native";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

interface SectionHeaderProps {
  overline?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ overline, title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        {overline ? (
          <Text variant="overline" tone="brand" style={{ marginBottom: 4 }}>
            {overline.toUpperCase()}
          </Text>
        ) : null}
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="bodySm" tone="secondary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="titleSm" tone="brand">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  titles: { flex: 1 },
});
