import { useCallback, useMemo, useState } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";

import type { Point } from "@/hooks/useScanner";

const HANDLE = 28;

interface CornerAdjusterProps {
  imageUri: string;
  imageWidth: number;    // source pixel width
  imageHeight: number;   // source pixel height
  corners: Point[];      // TL, TR, BR, BL in source pixels
  onCornersChange: (c: Point[]) => void;
}

/**
 * Photo with 4 draggable corner handles connected by a polygon outline.
 *
 * The container's aspect-ratio matches the source image so that a single
 * mapping (source pixels → container pixels) is enough — no letterboxing
 * to compensate for. This was the bug being fixed: previously the container
 * was hard-coded to 3:4, so a landscape source image was letterboxed inside
 * with corners drifting onto the empty bands.
 */
export function CornerAdjuster({
  imageUri, imageWidth, imageHeight, corners, onCornersChange,
}: CornerAdjusterProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  const aspectRatio = useMemo(
    () => (imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 3 / 4),
    [imageWidth, imageHeight],
  );

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
    <View style={[styles.container, { aspectRatio }]} onLayout={onLayout}>
      <Image
        source={{ uri: imageUri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {layout.width > 0 && corners.length === 4 && (
        <>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Polygon points={polygonPoints} fill="rgba(99,102,241,0.18)" stroke="#6366F1" strokeWidth={2} />
          </Svg>
          {corners.map((c, i) => (
            <DraggableHandle
              key={i}
              srcX={c.x}
              srcY={c.y}
              maxX={layout.width}
              maxY={layout.height}
              toScreenX={toScreenX}
              toScreenY={toScreenY}
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
  srcX: number;
  srcY: number;
  maxX: number;
  maxY: number;
  toScreenX: (n: number) => number;
  toScreenY: (n: number) => number;
  onCommit: (x: number, y: number) => void;
}

function DraggableHandle({ srcX, srcY, maxX, maxY, toScreenX, toScreenY, onCommit }: HandleProps) {
  // We keep the position in screen pixels for the gesture but RE-SEED it
  // from props on every render via useMemo so that whenever the parent's
  // corners array changes (e.g. after detect-edges or on resize) the
  // handles snap to the new positions instead of drifting.
  const initialX = toScreenX(srcX);
  const initialY = toScreenY(srcY);

  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Re-seed if parent state moved this corner (e.g. layout change, detect run).
  // We only re-seed when not actively dragging (scale === 1).
  if (scale.value === 1 && Math.abs(x.value - initialX) > 0.5) {
    x.value = initialX;
  }
  if (scale.value === 1 && Math.abs(y.value - initialY) > 0.5) {
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
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  handleOuter: {
    position: "absolute",
    top: 0,
    left: 0,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: "rgba(99,102,241,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  handleInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#6366F1",
    borderWidth: 2,
    borderColor: "#FFF",
  },
});
