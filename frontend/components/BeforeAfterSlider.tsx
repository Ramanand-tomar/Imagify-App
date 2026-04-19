import { useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Text } from "@/components/ui";

interface BeforeAfterSliderProps {
  beforeUri: string;
  afterUri: string;
  aspectRatio?: number;
}

export function BeforeAfterSlider({ beforeUri, afterUri, aspectRatio = 4 / 3 }: BeforeAfterSliderProps) {
  // Defend against 0/NaN/Infinity which would collapse the container's
  // height to 0 and hide the image entirely. Caller passes width/height
  // from the upload response — if either is missing we land here.
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 4 / 3;
  const [width, setWidth] = useState(0);
  const dividerX = useSharedValue(0);
  const [ready, setReady] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    dividerX.value = w / 2;
    setReady(true);
  };

  const pan = Gesture.Pan().onUpdate((e) => {
    const x = Math.max(0, Math.min(width, e.x));
    dividerX.value = x;
  });

  const tap = Gesture.Tap().onEnd((e) => {
    dividerX.value = withTiming(Math.max(0, Math.min(width, e.x)), { duration: 160 });
  });

  const composed = Gesture.Race(pan, tap);

  const afterClipStyle = useAnimatedStyle(() => ({ width: dividerX.value }));
  const dividerStyle = useAnimatedStyle(() => ({ left: dividerX.value - 1.5 }));

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.container, { aspectRatio: safeAspect }]} onLayout={onLayout}>
        <Image source={{ uri: beforeUri }} style={styles.image} resizeMode="contain" />
        {ready ? (
          <Animated.View style={[styles.afterWrap, afterClipStyle]}>
            <Image source={{ uri: afterUri }} style={[styles.image, { width }]} resizeMode="contain" />
          </Animated.View>
        ) : null}
        {ready ? (
          <Animated.View style={[styles.divider, dividerStyle]} pointerEvents="none">
            <View style={styles.handle}>
              <View style={styles.handleDot} />
            </View>
          </Animated.View>
        ) : null}
        <View style={styles.labelLeft}>
          <LabelDot text="Before" />
        </View>
        <View style={styles.labelRight}>
          <LabelDot text="After" tone="brand" />
        </View>
      </View>
    </GestureDetector>
  );
}

function LabelDot({ text, tone = "dark" }: { text: string; tone?: "dark" | "brand" }) {
  return (
    <View style={[styles.labelBg, tone === "brand" ? { backgroundColor: "rgba(79,70,229,0.88)" } : null]}>
      <Text variant="caption" style={styles.labelText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  image: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  afterWrap: { position: "absolute", top: 0, left: 0, bottom: 0, overflow: "hidden" },
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  handleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4F46E5",
  },
  labelLeft: { position: "absolute", top: 10, left: 10 },
  labelRight: { position: "absolute", top: 10, right: 10 },
  labelBg: {
    backgroundColor: "rgba(15,23,42,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  labelText: { color: "#FFFFFF", fontWeight: "700" },
});
