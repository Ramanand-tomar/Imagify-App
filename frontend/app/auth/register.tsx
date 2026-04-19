import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLogo, Button, GradientSurface, Input, ProgressBar, Text } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useAppTheme } from "@/theme/useTheme";
import { extractErrorMessage } from "@/utils/errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordStrength(pw: string): {
  score: number;
  label: string;
  tone: "error" | "warning" | "success" | "brand";
} {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const bucket = Math.min(4, score);
  const meta = [
    { label: "Very weak", tone: "error" as const },
    { label: "Weak", tone: "error" as const },
    { label: "Fair", tone: "warning" as const },
    { label: "Good", tone: "success" as const },
    { label: "Strong", tone: "success" as const },
  ][bucket];
  return { score: bucket / 4, ...meta };
}

export default function RegisterScreen() {
  const theme = useAppTheme();
  const register = useAuthStore((s) => s.register);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const fullNameError = touched && fullName.trim().length < 2 ? "Enter your full name" : null;
  const emailError = touched && !EMAIL_RE.test(email) ? "Enter a valid email" : null;
  const passwordError = touched && password.length < 8 ? "Password must be at least 8 characters" : null;
  const canSubmit = !fullNameError && !emailError && !passwordError && fullName && email && password;

  const onSubmit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setServerError(null);
    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password);
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err, "Registration failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const strengthProgressTone: "error" | "warning" | "success" | "brand" =
    strength.tone === "error" ? "error" : strength.tone === "warning" ? "warning" : "success";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface.background }]} edges={["bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <GradientSurface radius="3xl" contentStyle={styles.hero}>
            <View style={styles.brandRow}>
              <AppLogo size={40} variant="gradient" />
              <Text variant="titleLg" style={{ color: theme.onGradient.primary }}>
                Imagify AI
              </Text>
            </View>
            <Text variant="h1" style={{ color: theme.onGradient.primary, marginTop: 20 }}>
              Create account
            </Text>
            <Text variant="body" style={{ color: theme.onGradient.secondary, marginTop: 4 }}>
              Start processing files with AI tools
            </Text>
          </GradientSurface>

          <View style={styles.form}>
            <Input label="Full name" value={fullName} onChangeText={setFullName} leftIcon="account-outline" errorText={fullNameError} />
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

            {password.length > 0 ? (
              <View style={styles.strengthRow}>
                <View style={{ flex: 1 }}>
                  <ProgressBar progress={strength.score} tone={strengthProgressTone} />
                </View>
                <Text variant="caption" tone={strength.tone === "error" ? "error" : strength.tone === "warning" ? "warning" : "success"} weight="600">
                  {strength.label}
                </Text>
              </View>
            ) : null}

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

            <Button label="Create account" onPress={onSubmit} loading={submitting} disabled={submitting} fullWidth size="lg" style={{ marginTop: 4 }} />

            <View style={styles.footer}>
              <Text variant="body" tone="secondary">
                Already have an account?{" "}
              </Text>
              <Link href="/auth/login" asChild>
                <Pressable hitSlop={6}>
                  <Text variant="body" tone="brand" weight="600">
                    Sign in
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
  form: { gap: 12 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -4 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
});
