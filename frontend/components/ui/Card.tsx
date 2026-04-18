import { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { useAppTheme } from "@/theme/useTheme";

export type CardVariant = "flat" | "elevated" | "outlined" | "tinted";

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  disabled?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  contentStyle?: ViewStyle;
  radius?: "md" | "lg" | "xl" | "2xl";
  tint?: string;
}

export function Card({
  children,
  variant = "elevated",
  onPress,
  disabled,
  padded = true,
  style,
  contentStyle,
  radius = "lg",
  tint,
}: CardProps) {
  const theme = useAppTheme();

  const base: ViewStyle = {
    borderRadius: theme.radius[radius],
    backgroundColor:
      variant === "tinted"
        ? tint ?? theme.colors.brand[50]
        : variant === "outlined"
        ? theme.colors.surface.card
        : theme.colors.surface.card,
    ...(variant === "outlined"
      ? { borderWidth: 1, borderColor: theme.colors.border.default }
      : variant === "elevated"
      ? theme.shadow.sm
      : {}),
  };

  const inner: ViewStyle = {
    padding: padded ? theme.spacing.lg : 0,
  };

  const content = <View style={[inner, contentStyle]}>{children}</View>;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          base,
          { opacity: disabled ? 0.55 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
          style as ViewStyle,
        ]}
        android_ripple={{ color: theme.colors.border.subtle, borderless: false }}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[base, style]}>{content}</View>;
}

// Silence unused import warning for StyleSheet on some tooling
void StyleSheet;
