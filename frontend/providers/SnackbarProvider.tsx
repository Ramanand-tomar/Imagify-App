import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui";
import { useAppTheme } from "@/theme/useTheme";

type Variant = "info" | "success" | "error";

interface Options {
  variant?: Variant;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface SnackbarCtx {
  show: (message: string, options?: Options) => void;
  success: (message: string, options?: Omit<Options, "variant">) => void;
  error: (message: string, options?: Omit<Options, "variant">) => void;
  info: (message: string, options?: Omit<Options, "variant">) => void;
}

const Ctx = createContext<SnackbarCtx | null>(null);

const VARIANT_META: Record<Variant, { icon: string }> = {
  info: { icon: "information-outline" },
  success: { icon: "check-circle-outline" },
  error: { icon: "alert-circle-outline" },
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<Variant>("info");
  const [action, setAction] = useState<Options["action"]>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, options: Options = {}) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setVariant(options.variant ?? "info");
    setAction(options.action);
    setVisible(true);
    const duration = options.duration ?? 3200;
    timerRef.current = setTimeout(() => setVisible(false), duration);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const value = useMemo<SnackbarCtx>(
    () => ({
      show,
      success: (msg, opts) => show(msg, { ...opts, variant: "success" }),
      error: (msg, opts) => show(msg, { ...opts, variant: "error" }),
      info: (msg, opts) => show(msg, { ...opts, variant: "info" }),
    }),
    [show],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Toast
        visible={visible}
        message={message}
        variant={variant}
        action={action}
        onDismiss={() => setVisible(false)}
      />
    </Ctx.Provider>
  );
}

function Toast({
  visible,
  message,
  variant,
  action,
  onDismiss,
}: {
  visible: boolean;
  message: string;
  variant: Variant;
  action?: Options["action"];
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const translateY = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 40, { duration: 220 });
    opacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 220 : 160 });
  }, [visible, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const accent =
    variant === "success"
      ? theme.colors.status.success
      : variant === "error"
      ? theme.colors.status.error
      : theme.colors.brand.default;

  const accentSoft =
    variant === "success"
      ? theme.colors.status.successSoft
      : variant === "error"
      ? theme.colors.status.errorSoft
      : theme.colors.brand[50];

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe} pointerEvents="box-none">
      <Animated.View style={[styles.wrap, animStyle]} pointerEvents={visible ? "auto" : "none"}>
        <Pressable
          onPress={onDismiss}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface.card,
              borderColor: theme.colors.border.subtle,
              borderRadius: theme.radius.lg,
              ...theme.shadow.lg,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
            <Icon source={VARIANT_META[variant].icon} size={18} color={accent} />
          </View>
          <Text variant="body" numberOfLines={3} style={{ flex: 1, color: theme.colors.text.primary }}>
            {message}
          </Text>
          {action ? (
            <Pressable
              onPress={() => {
                action.onPress();
                onDismiss();
              }}
              hitSlop={8}
              style={styles.actionBtn}
            >
              <Text variant="titleSm" style={{ color: accent }}>
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

export function useSnackbar(): SnackbarCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
}

const styles = StyleSheet.create({
  safe: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
    paddingHorizontal: 14,
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
});
