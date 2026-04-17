import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export function HistorySkeleton({ rows = 6 }: { rows?: number }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.wrap}>
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View key={i} style={[styles.row, pulse]}>
          <View style={styles.avatar} />
          <View style={styles.textCol}>
            <View style={[styles.bar, { width: "40%" }]} />
            <View style={[styles.bar, { width: "65%", marginTop: 8 }]} />
          </View>
          <View style={styles.badge} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E5E7EB" },
  textCol: { flex: 1 },
  bar: { height: 10, borderRadius: 5, backgroundColor: "#E5E7EB" },
  badge: { width: 60, height: 22, borderRadius: 11, backgroundColor: "#E5E7EB" },
});
