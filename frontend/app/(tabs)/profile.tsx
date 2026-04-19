import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import { Avatar, Button, Card, ProgressBar, Screen, SectionHeader, Text } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";
import { createLogger } from "@/utils/logger";

const log = createLogger("profile");

const STORAGE_QUOTA_BYTES = 100 * 1024 * 1024; // soft 100 MB display ceiling

interface ActionRow {
  key: string;
  icon: string;
  title: string;
  description?: string;
  onPress: () => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const resetTasks = useTaskStore((s) => s.reset);
  const getStorageUsage = useTaskStore((s) => s.getStorageUsage);

  const [usage, setUsage] = useState<{ total_bytes: number; file_count: number } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Refresh on focus so deleting a task elsewhere is reflected immediately.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setUsageLoading(true);
      getStorageUsage()
        .then((u) => {
          if (active) setUsage(u);
        })
        .catch((err) => log.warn("storage usage failed", err))
        .finally(() => {
          if (active) setUsageLoading(false);
        });
      return () => {
        active = false;
      };
    }, [getStorageUsage]),
  );

  const onLogout = () => {
    Alert.alert("Log out?", "You'll need to sign in again to access your tasks.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          resetTasks();
          router.replace("/auth/login");
        },
      },
    ]);
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
      description: "See and manage all completed tasks",
      onPress: () => router.push("/profile/history"),
    },
  ];

  const settingsRows: ActionRow[] = [
    {
      key: "settings",
      icon: "cog-outline",
      title: "Settings",
      description: "Notifications, theme, cache",
      onPress: () => router.push("/profile/settings"),
    },
  ];

  const usagePct =
    usage && STORAGE_QUOTA_BYTES > 0
      ? Math.max(0, Math.min(1, usage.total_bytes / STORAGE_QUOTA_BYTES))
      : 0;
  const usageTone: "brand" | "warning" | "error" =
    usagePct > 0.9 ? "error" : usagePct > 0.7 ? "warning" : "brand";

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

      <SectionHeader title="Storage" />
      <Card>
        <View style={styles.storageHeader}>
          <View style={[styles.storageIconWrap, { backgroundColor: theme.colors.brand[50] }]}>
            <Icon source="database-outline" size={20} color={theme.colors.brand.default} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMd">
              {usage ? formatBytes(usage.total_bytes) : usageLoading ? "Calculating…" : "—"}
              <Text variant="bodySm" tone="secondary">
                {"  / "}{formatBytes(STORAGE_QUOTA_BYTES)}
              </Text>
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              {usage ? `${usage.file_count} processed file${usage.file_count === 1 ? "" : "s"}` : " "}
            </Text>
          </View>
        </View>
        <ProgressBar progress={usagePct} tone={usageTone} style={{ marginTop: 12 }} />
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
          Files older than 7 days are removed automatically. Delete tasks from
          your history to free space sooner.
        </Text>
        <Button
          label="Manage tasks"
          icon="folder-outline"
          variant="soft"
          onPress={() => router.push("/profile/history")}
          fullWidth
          style={{ marginTop: 12 }}
        />
      </Card>

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
  storageHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  storageIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
