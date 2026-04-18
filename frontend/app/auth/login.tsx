import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ServerStatusBanner } from "@/components/ServerStatusBanner";
import { AppLogo, Button, GradientSurface, Input, Text } from "@/components/ui";
import { pingServer } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useAppTheme } from "@/theme/useTheme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const theme = useAppTheme();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setWakingUp(true);
    }, 3000);
    pingServer().then(() => {
      clearTimeout(timer);
      if (active) setWakingUp(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const emailError = touched && !EMAIL_RE.test(email) ? "Enter a valid email" : null;
  const passwordError = touched && password.length < 8 ? "Password must be at least 8 characters" : null;
  const canSubmit = !emailError && !passwordError && email.length > 0 && password.length > 0;

  const onSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setServerError(null);
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setServerError(err?.response?.data?.detail ?? "Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface.background }]} edges={["bottom"]}>
      <ServerStatusBanner visible={wakingUp} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <GradientSurface radius="3xl" contentStyle={styles.hero}>
            <View style={styles.brandRow}>
              <AppLogo size={40} variant="gradient" />
              <Text variant="titleLg" style={{ color: "#FFFFFF" }}>
                Imagify AI
              </Text>
            </View>
            <Text variant="h1" style={{ color: "#FFFFFF", marginTop: 20 }}>
              Welcome back
            </Text>
            <Text variant="body" style={{ color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
              Sign in to keep processing your files
            </Text>
          </GradientSurface>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              leftIcon="email-outline"
              errorText={emailError}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              leftIcon="lock-outline"
              rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
              onRightIconPress={() => setShowPassword((s) => !s)}
              errorText={passwordError}
            />

            {serverError ? (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: theme.colors.status.errorSoft, borderRadius: theme.radius.md },
                ]}
              >
                <Icon source="alert-circle-outline" size={18} color={theme.colors.status.error} />
                <Text variant="bodySm" tone="error" style={{ flex: 1 }}>
                  {serverError}
                </Text>
              </View>
            ) : null}

            <Button label="Sign in" onPress={onSubmit} loading={submitting} disabled={submitting} fullWidth size="lg" style={{ marginTop: 4 }} />

            <View style={styles.footer}>
              <Text variant="body" tone="secondary">
                Don&apos;t have an account?{" "}
              </Text>
              <Link href="/auth/register" asChild>
                <Pressable hitSlop={6}>
                  <Text variant="body" tone="brand" weight="600">
                    Register
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 20, flexGrow: 1, justifyContent: "center" },
  hero: { padding: 24, minHeight: 180 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  form: { gap: 12 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
});
