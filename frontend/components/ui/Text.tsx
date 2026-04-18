import { Text as RNText, type TextProps as RNTextProps, type TextStyle, StyleSheet } from "react-native";

import { useAppTheme } from "@/theme/useTheme";
import type { TypographyVariant } from "@/theme/tokens";

type Tone = "primary" | "secondary" | "muted" | "inverse" | "brand" | "link" | "success" | "warning" | "error";

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: TextStyle["textAlign"];
  weight?: "400" | "500" | "600" | "700";
  style?: TextStyle | TextStyle[];
}

export function Text({ variant = "body", tone = "primary", align, weight, style, children, ...rest }: TextProps) {
  const theme = useAppTheme();
  const typo = theme.typography[variant];
  const colorMap: Record<Tone, string> = {
    primary: theme.colors.text.primary,
    secondary: theme.colors.text.secondary,
    muted: theme.colors.text.muted,
    inverse: theme.colors.text.inverse,
    brand: theme.colors.text.brand,
    link: theme.colors.text.link,
    success: theme.colors.status.success,
    warning: theme.colors.status.warning,
    error: theme.colors.status.error,
  };

  const fontFamilyFromWeight = weight
    ? weight === "700"
      ? theme.fontFamily.bold
      : weight === "600"
      ? theme.fontFamily.semibold
      : weight === "500"
      ? theme.fontFamily.medium
      : theme.fontFamily.regular
    : undefined;

  const composed: TextStyle = {
    ...typo,
    color: colorMap[tone],
    textAlign: align,
    ...(fontFamilyFromWeight ? { fontFamily: fontFamilyFromWeight, fontWeight: weight } : {}),
  };

  return (
    <RNText {...rest} style={StyleSheet.flatten([composed, style])}>
      {children}
    </RNText>
  );
}
