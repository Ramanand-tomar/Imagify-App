import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/stores/authStore";
import { pingServer } from "@/services/api";
import { ServerStatusBanner } from "@/components/ServerStatusBanner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setWakingUp(true);
    }, 3000);

    pingServer().then(() => {
      clearTimeout(timer);
      if (active) setWakingUp(false);
    });

    return () => { active = false; };
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
    <SafeAreaView style={styles.container}>
      <ServerStatusBanner visible={wakingUp} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.inner}>
          <Text variant="headlineMedium" style={styles.title}>Welcome back</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Sign in to Imagify AI</Text>

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
            Sign in
          </Button>

          <View style={styles.footer}>
            <Text variant="bodyMedium">Don&apos;t have an account? </Text>
            <Link href="/auth/register">
              <Text variant="bodyMedium" style={styles.link}>Register</Text>
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
  serverError: { textAlign: "center" },
});
