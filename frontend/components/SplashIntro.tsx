import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { AppLogo, GradientSurface, Text } from "@/components/ui";
import { useAppTheme } from "@/theme/useTheme";

interface SplashIntroProps {
  /** Called once the fade-out finishes so the host can unmount us. */
  onFinished: () => void;
  /** Total time the splash stays on screen (incl. fade). Defaults to 1800ms. */
  duration?: number;
}

export function SplashIntro({ onFinished, duration = 1800 }: SplashIntroProps) {
  const theme = useAppTheme();

  const logoScale = useSharedValue(0.82);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const rootOpacity = useSharedValue(1);
  const creditOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    logoOpacity.value = withTiming(1, { duration: 360 });
    textOpacity.value = withDelay(180, withTiming(1, { duration: 420 }));
    creditOpacity.value = withDelay(420, withTiming(1, { duration: 360 }));

    const fadeStart = Math.max(0, duration - 320);
    const id = setTimeout(() => {
      rootOpacity.value = withTiming(
        0,
        { duration: 320, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            // Hop back to JS thread to unmount.
            // runOnJS is overkill here; we can just schedule via setTimeout
          }
        },
      );
    }, fadeStart);

    const unmountId = setTimeout(onFinished, duration);
    return () => {
      clearTimeout(id);
      clearTimeout(unmountId);
    };
  }, [duration, onFinished, logoScale, logoOpacity, textOpacity, rootOpacity, creditOpacity]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const creditStyle = useAnimatedStyle(() => ({ opacity: creditOpacity.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.root, rootStyle]}
      pointerEvents="none"
    >
      <GradientSurface
        radius="md"
        colors={theme.gradients.aiGlow}
        style={StyleSheet.absoluteFillObject}
        contentStyle={styles.content}
      >
        <View style={{ flex: 1 }} />
        <Animated.View style={[styles.logoRow, logoStyle]}>
          <View
            style={[
              styles.logoMark,
              {
                backgroundColor: theme.onGradient.surface,
                borderColor: theme.onGradient.surfaceStrong,
              },
            ]}
          >
            <AppLogo size={96} variant="gradient" />
          </View>
        </Animated.View>
        <Animated.View style={[styles.textWrap, textStyle]}>
          <Text
            style={{
              color: theme.onGradient.primary,
              fontFamily: theme.fontFamily.bold,
              fontSize: 36,
              lineHeight: 42,
              letterSpacing: -0.5,
              textAlign: "center",
            }}
          >
            Imagify AI
          </Text>
          <Text
            variant="body"
            align="center"
            style={{ color: theme.onGradient.secondary, marginTop: 8 }}
          >
            AI-powered PDF & image tools
          </Text>
        </Animated.View>
        <View style={{ flex: 1 }} />
        <Animated.View style={[styles.credit, creditStyle]}>
          <Text variant="caption" style={{ color: theme.onGradient.tertiary }}>
            Developed by
          </Text>
          <Text
            style={{
              color: theme.onGradient.primary,
              fontFamily: theme.fontFamily.semibold,
              fontSize: 14,
              lineHeight: 18,
              marginTop: 2,
            }}
          >
            Ramanand Tomar
          </Text>
        </Animated.View>
      </GradientSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 9999 },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 32, paddingVertical: 64 },
  logoRow: { alignItems: "center", marginBottom: 28 },
  logoMark: {
    width: 128,
    height: 128,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    padding: 16,
  },
  textWrap: { alignItems: "center" },
  credit: { alignItems: "center", paddingBottom: 24 },
});
