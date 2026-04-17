import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, HelperText, Snackbar, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/stores/authStore";

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword && !currentPassword) {
      setError("Current password is required to change password");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await updateProfile({
        full_name: fullName || undefined,
        password: newPassword || undefined,
        current_password: currentPassword || undefined,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>Edit Profile</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Update your personal information and password</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            placeholder="John Doe"
            style={styles.input}
          />

          <View style={styles.spacer} />
          <Text variant="titleMedium" style={styles.sectionTitle}>Change Password</Text>
          <Text variant="bodySmall" style={styles.sectionSubtitle}>Leave blank to keep current password</Text>

          <TextInput
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <TextInput
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />

          <TextInput
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          {newPassword !== confirmPassword && confirmPassword !== "" && (
            <HelperText type="error">Passwords do not match</HelperText>
          )}
        </View>

        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={onSave}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Save Changes
          </Button>
          <Button
            mode="text"
            onPress={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>

      <Snackbar
        visible={success}
        onDismiss={() => setSuccess(false)}
        duration={3000}
        style={styles.successBar}
      >
        Profile updated successfully
      </Snackbar>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError(null)}
        duration={4000}
        style={styles.errorBar}
      >
        {error}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 24 },
  header: { marginBottom: 32 },
  title: { fontWeight: "bold", color: "#1F2937" },
  subtitle: { color: "#6B7280", marginTop: 4 },
  form: { gap: 12 },
  input: { backgroundColor: "#fff" },
  sectionTitle: { fontWeight: "bold", marginTop: 16 },
  sectionSubtitle: { color: "#6B7280", marginBottom: 8 },
  spacer: { height: 16 },
  footer: { marginTop: 40, gap: 12 },
  button: { paddingVertical: 6 },
  successBar: { backgroundColor: "#10B981" },
  errorBar: { backgroundColor: "#EF4444" },
});
