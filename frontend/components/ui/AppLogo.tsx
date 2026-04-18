import { View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { useAppTheme } from "@/theme/useTheme";

interface AppLogoProps {
  size?: number;
  variant?: "gradient" | "mono";
  /** mono-variant color override (defaults to brand.default) */
  color?: string;
  style?: ViewStyle;
}

/**
 * Imagify AI wordmark icon. A rounded square with a gradient "aurora" fill,
 * a stylized photo/stack mark, and an AI spark accent in the upper-right.
 *
 * Pure SVG → scales cleanly at any size, no asset file required.
 */
export function AppLogo({ size = 64, variant = "gradient", color, style }: AppLogoProps) {
  const theme = useAppTheme();
  const r = Math.round(size * 0.28); // rounded corner radius
  const fg = "#FFFFFF";
  const monoColor = color ?? theme.colors.brand.default;
  const gradientColors = theme.gradients.aiGlow;
  const gradId = "imagify-logo-grad";
  const sparkId = "imagify-logo-spark";

  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradientColors[0]} />
            <Stop offset="0.55" stopColor={gradientColors[1]} />
            <Stop offset="1" stopColor={gradientColors[2]} />
          </LinearGradient>
          <LinearGradient id={sparkId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#FEF3C7" />
          </LinearGradient>
        </Defs>

        {/* Rounded-square badge */}
        <Rect
          x={0}
          y={0}
          width={64}
          height={64}
          rx={r}
          ry={r}
          fill={variant === "gradient" ? `url(#${gradId})` : monoColor}
        />

        {/* Stacked "photo frames" — two overlapping rounded squares */}
        <Rect
          x={14}
          y={20}
          width={26}
          height={26}
          rx={5}
          ry={5}
          fill="none"
          stroke={fg}
          strokeOpacity={0.55}
          strokeWidth={2}
        />
        <Rect
          x={20}
          y={26}
          width={26}
          height={26}
          rx={5}
          ry={5}
          fill={fg}
          fillOpacity={0.95}
        />

        {/* Horizon/mountain inside the front frame */}
        <Path
          d="M 22 47 L 29 39 L 34 44 L 39 38 L 44 47 Z"
          fill={variant === "gradient" ? gradientColors[0] : monoColor}
          opacity={0.92}
        />
        {/* Sun/moon dot */}
        <Path
          d="M 40 32 a 2.2 2.2 0 1 1 0 -0.01 Z"
          fill={variant === "gradient" ? gradientColors[1] : monoColor}
          opacity={0.85}
        />

        {/* AI spark — 4-pointed star in the upper-right */}
        <Path
          d="M 50 12 L 52 17 L 57 19 L 52 21 L 50 26 L 48 21 L 43 19 L 48 17 Z"
          fill={`url(#${sparkId})`}
        />
      </Svg>
    </View>
  );
}
