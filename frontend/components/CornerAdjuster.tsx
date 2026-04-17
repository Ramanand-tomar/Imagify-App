import { useCallback, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";

import type { Point } from "@/hooks/useScanner";

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const HANDLE = 24;

interface CornerAdjusterProps {
  imageUri: string;
  imageWidth: number;    // source pixel width
  imageHeight: number;   // source pixel height
  corners: Point[];      // TL, TR, BR, BL in source pixels
  onCornersChange: (c: Point[]) => void;
}

/**
 * Photo with 4 draggable corner handles connected by a polygon outline.
 * Coordinates are stored in SOURCE image pixel space; we convert to/from the
 * on-screen display rect for layout + gestures.
 */
export function CornerAdjuster({
  imageUri, imageWidth, imageHeight, corners, onCornersChange,
}: CornerAdjusterProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  const toScreenX = useCallback(
    (srcX: number) => (layout.width ? (srcX / imageWidth) * layout.width : 0),
    [imageWidth, layout.width],
  );
  const toScreenY = useCallback(
    (srcY: number) => (layout.height ? (srcY / imageHeight) * layout.height : 0),
    [imageHeight, layout.height],
  );
  const toSrcX = useCallback(
    (scrX: number) => (layout.width ? (scrX / layout.width) * imageWidth : 0),
    [imageWidth, layout.width],
  );
  const toSrcY = useCallback(
    (scrY: number) => (layout.height ? (scrY / layout.height) * imageHeight : 0),
    [imageHeight, layout.height],
  );

  const polygonPoints =
    corners.length === 4
      ? corners.map((c) => `${toScreenX(c.x)},${toScreenY(c.y)}`).join(" ")
      : "";

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      {layout.width > 0 && corners.length === 4 && (
        <>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Polygon points={polygonPoints} fill="rgba(16,185,129,0.18)" stroke="#10B981" strokeWidth={2} />
          </Svg>
          {corners.map((c, i) => (
            <DraggableHandle
              key={i}
              initialX={toScreenX(c.x)}
              initialY={toScreenY(c.y)}
              maxX={layout.width}
              maxY={layout.height}
              onCommit={(sx, sy) => {
                const next = [...corners];
                next[i] = { x: toSrcX(sx), y: toSrcY(sy) };
                onCornersChange(next);
              }}
            />
          ))}
        </>
      )}
    </View>
  );
}

interface HandleProps {
  initialX: number;
  initialY: number;
  maxX: number;
  maxY: number;
  onCommit: (x: number, y: number) => void;
}

function DraggableHandle({ initialX, initialY, maxX, maxY, onCommit }: HandleProps) {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Sync if controlled corner changes externally
  if (Math.abs(x.value - initialX) > 1 && scale.value === 1) {
    x.value = initialX;
  }
  if (Math.abs(y.value - initialY) > 1 && scale.value === 1) {
    y.value = initialY;
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
      scale.value = withTiming(1.4, { duration: 100 });
    })
    .onUpdate((e) => {
      x.value = Math.max(0, Math.min(maxX, startX.value + e.translationX));
      y.value = Math.max(0, Math.min(maxY, startY.value + e.translationY));
    })
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 100 });
    })
    .onFinalize(() => {
      onCommit(x.value, y.value);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - HANDLE / 2 },
      { translateY: y.value - HANDLE / 2 },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.handleOuter, style]}>
        <View style={styles.handleInner} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  handleOuter: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: "rgba(16,185,129,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  handleInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFF",
  },
});
