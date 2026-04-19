import * as Clipboard from "expo-clipboard";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type KeyboardEvent,
} from "react-native";
import { Icon } from "react-native-paper";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { useAppTheme } from "@/theme/useTheme";
import { installGlobalErrorHandler, setGlobalErrorReporter } from "@/utils/globalErrorHandler";

type Variant = "info" | "success" | "error";

interface Options {
  variant?: Variant;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface ToastItem {
  id: number;
  message: string;
  variant: Variant;
  duration: number;
  action?: Options["action"];
}

interface SnackbarCtx {
  show: (message: string, options?: Options) => void;
  success: (message: string, options?: Omit<Options, "variant">) => void;
  error: (message: string, options?: Omit<Options, "variant">) => void;
  info: (message: string, options?: Omit<Options, "variant">) => void;
  dismiss: () => void;
}

const Ctx = createContext<SnackbarCtx | null>(null);

const VARIANT_META: Record<Variant, { icon: string; minDuration: number }> = {
  info: { icon: "information-outline", minDuration: 2800 },
  success: { icon: "check-circle-outline", minDuration: 2400 },
  error: { icon: "alert-circle-outline", minDuration: 4200 },
};

const ENTER_MS = 240;
const EXIT_MS = 180;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const queueRef = useRef<ToastItem[]>([]);
  const counterRef = useRef(0);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [visible, setVisible] = useState(false);

  const processNext = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    const next = queueRef.current.shift();
    if (!next) {
      setCurrent(null);
      return;
    }
    setCurrent(next);
    setVisible(true);
    showTimerRef.current = setTimeout(() => {
      setVisible(false);
      // give the exit animation time before popping the queue
      setTimeout(processNext, EXIT_MS + 20);
    }, next.duration);
  }, []);

  const show = useCallback(
    (msg: string, options: Options = {}) => {
      const variant = options.variant ?? "info";
      const id = ++counterRef.current;
      const duration = Math.max(options.duration ?? VARIANT_META[variant].minDuration, 1500);
      const item: ToastItem = {
        id,
        message: msg,
        variant,
        duration,
        action: options.action,
      };

      // If a toast is already showing, dismiss it immediately and enqueue the new one.
      if (current) {
        queueRef.current = [item, ...queueRef.current].slice(0, 5);
        if (showTimerRef.current) clearTimeout(showTimerRef.current);
        setVisible(false);
        setTimeout(processNext, EXIT_MS + 20);
      } else {
        queueRef.current.push(item);
        processNext();
      }
    },
    [current, processNext],
  );

  const dismiss = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    setVisible(false);
    setTimeout(processNext, EXIT_MS + 20);
  }, [processNext]);

  useEffect(
    () => () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    installGlobalErrorHandler();
    setGlobalErrorReporter((msg) => {
      // Surface uncaught non-fatal errors as a toast
      queueRef.current.push({
        id: ++counterRef.current,
        message: msg,
        variant: "error",
        duration: VARIANT_META.error.minDuration,
      });
      if (!showTimerRef.current && !current) processNext();
    });
    return () => setGlobalErrorReporter(null);
  }, [current, processNext]);

  const value = useMemo<SnackbarCtx>(
    () => ({
      show,
      dismiss,
      success: (msg, opts) => show(msg, { ...opts, variant: "success" }),
      error: (msg, opts) => show(msg, { ...opts, variant: "error" }),
      info: (msg, opts) => show(msg, { ...opts, variant: "info" }),
    }),
    [show, dismiss],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Toast
        key={current?.id ?? "none"}
        visible={visible && current !== null}
        item={current}
        onDismiss={dismiss}
        onActionPress={(action) => {
          try {
            action.onPress();
          } finally {
            dismiss();
          }
        }}
      />
    </Ctx.Provider>
  );
}

function Toast({
  visible,
  item,
  onDismiss,
  onActionPress,
}: {
  visible: boolean;
  item: ToastItem | null;
  onDismiss: () => void;
  onActionPress: (action: NonNullable<Options["action"]>) => void;
}) {
  const theme = useAppTheme();
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);
  const [keyboardBottom, setKeyboardBottom] = useState(0);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setKeyboardBottom(e.endCoordinates?.height ?? 0);
    };
    const onHide = () => setKeyboardBottom(0);

    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 40, {
      duration: visible ? ENTER_MS : EXIT_MS,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: visible ? ENTER_MS : EXIT_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!item) return null;

  const accent =
    item.variant === "success"
      ? theme.colors.status.success
      : item.variant === "error"
      ? theme.colors.status.error
      : theme.colors.brand.default;

  const accentSoft =
    item.variant === "success"
      ? theme.colors.status.successSoft
      : item.variant === "error"
      ? theme.colors.status.errorSoft
      : theme.colors.brand[50];

  const onLongPress = async () => {
    try {
      await Clipboard.setStringAsync(item.message);
    } catch {
      /* ignore */
    }
  };

  const bottomOffset = keyboardBottom > 0 ? keyboardBottom + 8 : 0;

  return (
    <View
      style={[styles.host, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      <SafeAreaView edges={keyboardBottom > 0 ? [] : ["bottom"]} pointerEvents="box-none">
        <Animated.View
          style={[styles.wrap, animStyle]}
          pointerEvents={visible ? "auto" : "none"}
        >
          <Pressable
            onPress={onDismiss}
            onLongPress={onLongPress}
            delayLongPress={420}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={item.message}
            accessibilityHint="Tap to dismiss. Long-press to copy."
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface.card,
                borderColor: theme.colors.border.default,
                borderLeftColor: accent,
                borderLeftWidth: 4,
                borderRadius: theme.radius.lg,
                ...theme.shadow.lg,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
              <Icon source={VARIANT_META[item.variant].icon} size={18} color={accent} />
            </View>
            <Text
              variant="body"
              numberOfLines={4}
              ellipsizeMode="tail"
              style={{ flex: 1, color: theme.colors.text.primary }}
            >
              {item.message}
            </Text>
            {item.action ? (
              <Pressable
                onPress={() => onActionPress(item.action!)}
                hitSlop={8}
                style={styles.actionBtn}
                accessibilityRole="button"
                accessibilityLabel={item.action.label}
              >
                <Text variant="titleSm" style={{ color: accent }}>
                  {item.action.label}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Icon source="close" size={16} color={theme.colors.text.muted} />
            </Pressable>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

export function useSnackbar(): SnackbarCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
