import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Icon } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  style,
  children,
}: ButtonProps) {
  const theme = useAppTheme();
  const scale = useSharedValue(1);

  const heights: Record<ButtonSize, number> = { sm: 36, md: 46, lg: 54 };
  const horizontal: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 22 };
  const iconSize: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

  const palettes = {
    primary: {
      bg: theme.colors.brand.default,
      fg: theme.colors.brand.contrast,
      border: "transparent",
    },
    secondary: {
      bg: theme.colors.surface.card,
      fg: theme.colors.text.primary,
      border: theme.colors.border.default,
    },
    ghost: {
      bg: "transparent",
      fg: theme.colors.text.primary,
      border: "transparent",
    },
    destructive: {
      bg: theme.colors.status.error,
      fg: "#FFFFFF",
      border: "transparent",
    },
    soft: {
      bg: theme.colors.brand[50],
      fg: theme.colors.brand[700],
      border: "transparent",
    },
  } as const;

  const palette = palettes[variant];

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(scale.value, { duration: 120 }) }],
  }));

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[{ alignSelf: fullWidth ? "stretch" : "flex-start" }, animStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          if (!isDisabled) scale.value = 0.97;
        }}
        onPressOut={() => {
          scale.value = 1;
        }}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          {
            height: heights[size],
            paddingHorizontal: horizontal[size],
            backgroundColor: palette.bg,
            borderRadius: theme.radius.md,
            borderWidth: variant === "secondary" ? 1 : 0,
            borderColor: palette.border,
            opacity: isDisabled ? 0.55 : pressed ? 0.92 : 1,
            ...(variant === "primary" || variant === "destructive" ? theme.shadow.xs : {}),
          },
        ]}
        android_ripple={{ color: variant === "primary" || variant === "destructive" ? "rgba(255,255,255,0.18)" : theme.colors.border.subtle }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : (
          <View style={styles.inner}>
            {icon ? <Icon source={icon} size={iconSize[size]} color={palette.fg} /> : null}
            {children ? (
              children
            ) : (
              <Text
                variant={size === "sm" ? "titleSm" : "button"}
                style={{ color: palette.fg }}
              >
                {label}
              </Text>
            )}
            {iconRight ? <Icon source={iconRight} size={iconSize[size]} color={palette.fg} /> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  inner: { flexDirection: "row", alignItems: "center", gap: 8 },
});
