import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useAppTheme } from "@/theme/useTheme";
import { Text } from "./Text";

interface ServerStatusPillProps {
  visible: boolean;
  message?: string;
}

export function ServerStatusPill({ visible, message = "Waking server... (first request can take up to 30s)" }: ServerStatusPillProps) {
  const theme = useAppTheme();
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 220 });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withTiming(-80, { duration: 220 });
      opacity.value = withTiming(0, { duration: 160 });
    }
  }, [visible, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible && opacity.value === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        animStyle,
        {
          backgroundColor: theme.colors.status.infoSoft,
          borderColor: theme.colors.brand[200],
        },
      ]}
    >
      <ActivityIndicator size="small" color={theme.colors.brand[700]} />
      <Text variant="caption" style={{ color: theme.colors.brand[800], flex: 1 }}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    zIndex: 100,
  },
});
