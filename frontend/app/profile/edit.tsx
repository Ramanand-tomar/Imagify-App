import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AppHeader, Button, Card, Divider, Input, Screen, SectionHeader } from "@/components/ui";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useAuthStore } from "@/stores/authStore";
import { extractErrorMessage } from "@/utils/errors";

export default function EditProfileScreen() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [loading, setLoading] = useState(false);

  const passwordMismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;

  const onSave = async () => {
    if (passwordMismatch) {
      snackbar.error("New passwords do not match");
      return;
    }
    if (newPassword && !currentPassword) {
      snackbar.error("Current password is required to change password");
      return;
    }
    setLoading(true);
    try {
      await updateProfile({
        full_name: fullName || undefined,
        password: newPassword || undefined,
        current_password: currentPassword || undefined,
      });
      snackbar.success("Profile updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      snackbar.error(extractErrorMessage(err, "Failed to update profile"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppHeader title="Edit profile" subtitle="Personal info and security" />
      <Screen>

        <SectionHeader title="Personal info" />
        <Card>
          <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="John Doe" leftIcon="account-outline" />
        </Card>

        <SectionHeader title="Change password" subtitle="Leave blank to keep current password" />
        <Card>
          <Input
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrent}
            leftIcon="lock-outline"
            rightIcon={showCurrent ? "eye-off-outline" : "eye-outline"}
            onRightIconPress={() => setShowCurrent((s) => !s)}
          />
          <Divider />
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            leftIcon="lock-plus-outline"
            rightIcon={showNew ? "eye-off-outline" : "eye-outline"}
            onRightIconPress={() => setShowNew((s) => !s)}
          />
          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showNew}
            leftIcon="lock-check-outline"
            errorText={passwordMismatch ? "Passwords do not match" : undefined}
          />
        </Card>

        <View style={{ gap: 10, marginTop: 8 }}>
          <Button
            label="Save changes"
            onPress={onSave}
            loading={loading}
            disabled={loading || passwordMismatch}
            fullWidth
            size="lg"
          />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} disabled={loading} fullWidth />
        </View>
      </Screen>
    </>
  );
}
