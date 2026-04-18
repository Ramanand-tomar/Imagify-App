import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useAppTheme } from "@/theme/useTheme";

interface ProgressBarProps {
  progress: number;
  tone?: "brand" | "success" | "warning" | "error";
  height?: number;
  style?: ViewStyle;
  indeterminate?: boolean;
}

export function ProgressBar({ progress, tone = "brand", height = 6, style, indeterminate }: ProgressBarProps) {
  const theme = useAppTheme();
  const width = useSharedValue(0);
  const loop = useSharedValue(0);

  const colorMap = {
    brand: theme.colors.brand.default,
    success: theme.colors.status.success,
    warning: theme.colors.status.warning,
    error: theme.colors.status.error,
  } as const;

  useEffect(() => {
    if (indeterminate) {
      loop.value = withTiming(1, { duration: 1200 });
      return;
    }
    width.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 320 });
  }, [progress, indeterminate, width, loop]);

  const fillStyle = useAnimatedStyle(() =>
    indeterminate
      ? {
          transform: [{ translateX: loop.value * 300 }],
          width: "40%",
        }
      : { width: `${width.value * 100}%` },
  );

  return (
    <View
      style={[
        {
          height,
          borderRadius: height,
          backgroundColor: theme.colors.border.subtle,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: colorMap[tone], borderRadius: height },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { height: "100%" },
});
