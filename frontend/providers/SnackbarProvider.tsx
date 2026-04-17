import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { Snackbar } from "react-native-paper";

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

const VARIANT_BG: Record<Variant, string> = {
  info: "#1F2937",
  success: "#065F46",
  error: "#991B1B",
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState<Variant>("info");
  const [duration, setDuration] = useState(3000);
  const actionRef = useRef<Options["action"]>(undefined);

  const show = useCallback((msg: string, options: Options = {}) => {
    setMessage(msg);
    setVariant(options.variant ?? "info");
    setDuration(options.duration ?? 3000);
    actionRef.current = options.action;
    setVisible(true);
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
      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={duration}
        style={[styles.bar, { backgroundColor: VARIANT_BG[variant] }]}
        action={
          actionRef.current
            ? { label: actionRef.current.label, onPress: actionRef.current.onPress }
            : undefined
        }
      >
        {message}
      </Snackbar>
    </Ctx.Provider>
  );
}

export function useSnackbar(): SnackbarCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
}

const styles = StyleSheet.create({
  bar: { marginBottom: 24 },
});
