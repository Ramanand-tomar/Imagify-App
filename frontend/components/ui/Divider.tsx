import { StyleSheet, View } from "react-native";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

interface DividerProps {
  label?: string;
  spacing?: number;
}

export function Divider({ label, spacing }: DividerProps) {
  const theme = useAppTheme();
  const marginVertical = spacing ?? theme.spacing.md;

  if (!label) {
    return (
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.border.default,
          marginVertical,
        }}
      />
    );
  }

  return (
    <View style={[styles.row, { marginVertical }]}>
      <View style={[styles.line, { backgroundColor: theme.colors.border.default }]} />
      <Text variant="caption" tone="muted" style={{ marginHorizontal: 12 }}>
        {label}
      </Text>
      <View style={[styles.line, { backgroundColor: theme.colors.border.default }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
