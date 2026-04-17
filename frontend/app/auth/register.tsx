import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, HelperText, ProgressBar, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/stores/authStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const bucket = Math.min(4, score);
  const meta = [
    { label: "Very weak", color: "#EF4444" },
    { label: "Weak", color: "#F59E0B" },
    { label: "Fair", color: "#EAB308" },
    { label: "Good", color: "#10B981" },
    { label: "Strong", color: "#059669" },
  ][bucket];
  return { score: bucket / 4, ...meta };
}

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

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
    } catch (err: any) {
      setServerError(err?.response?.data?.detail ?? "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.inner}>
          <Text variant="headlineMedium" style={styles.title}>Create account</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Start processing files with Imagify AI</Text>

          <TextInput
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            style={styles.field}
            error={!!fullNameError}
          />
          <HelperText type="error" visible={!!fullNameError}>{fullNameError}</HelperText>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            style={styles.field}
            error={!!emailError}
          />
          <HelperText type="error" visible={!!emailError}>{emailError}</HelperText>

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.field}
            error={!!passwordError}
          />
          {password.length > 0 && (
            <View style={styles.strengthRow}>
              <ProgressBar progress={strength.score} color={strength.color} style={styles.strengthBar} />
              <Text variant="bodySmall" style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}
          <HelperText type="error" visible={!!passwordError}>{passwordError}</HelperText>

          {serverError && (
            <HelperText type="error" visible style={styles.serverError}>{serverError}</HelperText>
          )}

          <Button
            mode="contained"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submit}
          >
            Create account
          </Button>

          <View style={styles.footer}>
            <Text variant="bodyMedium">Already have an account? </Text>
            <Link href="/auth/login">
              <Text variant="bodyMedium" style={styles.link}>Sign in</Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  flex: { flex: 1 },
  inner: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#6B7280", marginBottom: 24 },
  field: { backgroundColor: "transparent" },
  submit: { marginTop: 8, paddingVertical: 6 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  link: { fontWeight: "600", color: "#4F46E5" },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  strengthBar: { flex: 1, height: 6, borderRadius: 3 },
  strengthLabel: { width: 72, textAlign: "right" },
  serverError: { textAlign: "center" },
});
