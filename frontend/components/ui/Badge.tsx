import { StyleSheet, View, type ViewStyle } from "react-native";
import { Icon } from "react-native-paper";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "error" | "info" | "violet";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

export function Badge({ label, tone = "neutral", icon, size = "sm", style }: BadgeProps) {
  const theme = useAppTheme();

  const palettes: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.surface.subtle, fg: theme.colors.text.secondary },
    brand: { bg: theme.colors.brand[50], fg: theme.colors.brand[700] },
    success: { bg: theme.colors.status.successSoft, fg: theme.colors.status.success },
    warning: { bg: theme.colors.status.warningSoft, fg: theme.colors.status.warning },
    error: { bg: theme.colors.status.errorSoft, fg: theme.colors.status.error },
    info: { bg: theme.colors.status.infoSoft, fg: theme.colors.status.info },
    violet: { bg: "#F3EEFF", fg: "#7C3AED" },
  };

  const palette = palettes[tone];
  const vPad = size === "md" ? 6 : 3;
  const hPad = size === "md" ? 10 : 8;
  const iconSize = size === "md" ? 14 : 12;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: palette.bg,
          borderRadius: theme.radius.pill,
          paddingVertical: vPad,
          paddingHorizontal: hPad,
        },
        style,
      ]}
    >
      {icon ? <Icon source={icon} size={iconSize} color={palette.fg} /> : null}
      <Text variant={size === "md" ? "titleSm" : "caption"} style={{ color: palette.fg, fontFamily: theme.fontFamily.semibold }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
});
