import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useAppTheme } from "@/theme/useTheme";

export function HistorySkeleton({ rows = 6 }: { rows?: number }) {
  const theme = useAppTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.row,
            {
              backgroundColor: theme.colors.surface.card,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.lg,
            },
            pulse,
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: theme.colors.border.subtle }]} />
          <View style={styles.textCol}>
            <View style={[styles.bar, { width: "40%", backgroundColor: theme.colors.border.subtle }]} />
            <View
              style={[
                styles.bar,
                { width: "70%", backgroundColor: theme.colors.border.subtle, marginTop: 8 },
              ]}
            />
          </View>
          <View style={[styles.badge, { backgroundColor: theme.colors.border.subtle }]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 12 },
  textCol: { flex: 1 },
  bar: { height: 10, borderRadius: 5 },
  badge: { width: 64, height: 22, borderRadius: 11 },
});
