import { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useAppTheme } from "@/theme/useTheme";

interface GradientSurfaceProps {
  children?: ReactNode;
  colors?: readonly string[];
  radius?: "md" | "lg" | "xl" | "2xl" | "3xl";
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/**
 * Plain gradient surface backed by react-native-svg (no expo-linear-gradient dep).
 * Fills itself via absolute SVG; content renders above.
 */
export function GradientSurface({
  children,
  colors,
  radius = "2xl",
  style,
  contentStyle,
}: GradientSurfaceProps) {
  const theme = useAppTheme();
  const palette = colors ?? theme.gradients.aiGlow;
  const r = theme.radius[radius];

  return (
    <View style={[{ borderRadius: r, overflow: "hidden" }, style]}>
      <Svg style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="surfaceGrad" x1="0" y1="0" x2="1" y2="1">
            {palette.map((c, i) => (
              <Stop key={`${c}-${i}`} offset={`${(i / (palette.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#surfaceGrad)" />
      </Svg>
      <View style={[{ padding: theme.spacing.lg }, contentStyle]}>{children}</View>
    </View>
  );
}
