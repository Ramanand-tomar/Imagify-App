import { useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface BeforeAfterSliderProps {
  beforeUri: string;
  afterUri: string;
  aspectRatio?: number;
}

/**
 * Tappable/draggable vertical divider. Left side shows "before", right side
 * shows "after" clipped to the divider x position.
 */
export function BeforeAfterSlider({ beforeUri, afterUri, aspectRatio = 4 / 3 }: BeforeAfterSliderProps) {
  const [width, setWidth] = useState(0);
  const dividerX = useSharedValue(0);
  const [ready, setReady] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    dividerX.value = w / 2;
    setReady(true);
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const x = Math.max(0, Math.min(width, e.x));
      dividerX.value = x;
    })
    .onEnd(() => {
    });

  const tap = Gesture.Tap().onEnd((e) => {
    dividerX.value = withTiming(Math.max(0, Math.min(width, e.x)), { duration: 150 });
  });

  const composed = Gesture.Race(pan, tap);

  const afterClipStyle = useAnimatedStyle(() => ({
    width: dividerX.value,
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    left: dividerX.value - 1,
  }));

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.container, { aspectRatio }]} onLayout={onLayout}>
        <Image source={{ uri: beforeUri }} style={styles.image} resizeMode="contain" />
        {ready && (
          <Animated.View style={[styles.afterWrap, afterClipStyle]}>
            <Image
              source={{ uri: afterUri }}
              style={[styles.image, { width }]}
              resizeMode="contain"
            />
          </Animated.View>
        )}
        {ready && (
          <Animated.View style={[styles.divider, dividerStyle]} pointerEvents="none">
            <View style={styles.handle} />
          </Animated.View>
        )}
        <View style={styles.labelLeft}>
          <LabelDot text="Before" />
        </View>
        <View style={styles.labelRight}>
          <LabelDot text="After" />
        </View>
      </View>
    </GestureDetector>
  );
}

function LabelDot({ text }: { text: string }) {
  return (
    <View style={styles.labelBg}>
      <Animated.Text style={styles.labelText}>{text}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  image: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  afterWrap: { position: "absolute", top: 0, left: 0, bottom: 0, overflow: "hidden" },
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 2,
    borderColor: "#4F46E5",
  },
  labelLeft: { position: "absolute", top: 8, left: 8 },
  labelRight: { position: "absolute", top: 8, right: 8 },
  labelBg: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
});
