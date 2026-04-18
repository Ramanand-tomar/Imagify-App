import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import { Avatar, Button, Card, Screen, SectionHeader, Text } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";

interface ActionRow {
  key: string;
  icon: string;
  title: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const resetTasks = useTaskStore((s) => s.reset);

  const onLogout = async () => {
    await logout();
    resetTasks();
    router.replace("/auth/login");
  };

  const accountRows: ActionRow[] = [
    {
      key: "edit",
      icon: "account-edit-outline",
      title: "Edit profile",
      description: "Name, password, security",
      onPress: () => router.push("/profile/edit"),
    },
    {
      key: "history",
      icon: "history",
      title: "Task history",
      description: "See all completed tasks",
      onPress: () => router.push("/profile/history"),
    },
  ];

  const settingsRows: ActionRow[] = [
    { key: "storage", icon: "database-outline", title: "Storage", description: "Manage cached files", onPress: () => {}, disabled: true },
    { key: "settings", icon: "cog-outline", title: "Settings", description: "App preferences", onPress: () => {}, disabled: true },
  ];

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <Avatar name={user?.full_name} email={user?.email} size="xl" />
        <Text variant="h2" align="center" style={{ marginTop: 16 }}>
          {user?.full_name || user?.email || "Signed in"}
        </Text>
        {user?.full_name ? (
          <Text variant="body" tone="secondary" align="center" style={{ marginTop: 2 }}>
            {user.email}
          </Text>
        ) : null}
      </View>

      <SectionHeader title="Account" />
      <RowsCard rows={accountRows} theme={theme} />

      <SectionHeader title="Settings" />
      <RowsCard rows={settingsRows} theme={theme} />

      <View style={{ marginTop: 8 }}>
        <Button label="Log out" icon="logout" variant="destructive" onPress={onLogout} fullWidth size="lg" />
      </View>

      <View style={{ alignItems: "center", marginTop: 8, gap: 2 }}>
        <Text variant="caption" tone="muted">
          Imagify AI · v0.1.0
        </Text>
        <Text variant="caption" tone="secondary" weight="500">
          Developed by Ramanand Tomar
        </Text>
      </View>
    </Screen>
  );
}

function RowsCard({ rows, theme }: { rows: ActionRow[]; theme: ReturnType<typeof useAppTheme> }) {
  return (
    <Card padded={false}>
      {rows.map((row, idx) => (
        <Pressable
          key={row.key}
          onPress={row.onPress}
          disabled={row.disabled}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: pressed && !row.disabled ? theme.colors.surface.subtle : "transparent",
              borderBottomColor: theme.colors.border.subtle,
              borderBottomWidth: idx === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
              opacity: row.disabled ? 0.5 : 1,
            },
          ]}
        >
          <View style={[styles.rowIconWrap, { backgroundColor: theme.colors.brand[50] }]}>
            <Icon source={row.icon} size={20} color={theme.colors.brand.default} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMd">{row.title}</Text>
            {row.description ? (
              <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                {row.description}
              </Text>
            ) : null}
          </View>
          <Icon source="chevron-right" size={20} color={theme.colors.text.muted} />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 14 },
  rowIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
