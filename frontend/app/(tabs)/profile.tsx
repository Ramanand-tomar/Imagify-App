import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Avatar, Button, Divider, List, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const resetTasks = useTaskStore((s) => s.reset);

  const onLogout = async () => {
    await logout();
    resetTasks();
    router.replace("/auth/login");
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Avatar.Text size={72} label={initial} />
        <View style={styles.headerText}>
          <Text variant="titleLarge" style={styles.email}>{user?.full_name || user?.email || "Signed in"}</Text>
          {user?.full_name && <Text variant="bodySmall" style={styles.sub}>{user.email}</Text>}
          <Text variant="bodySmall" style={styles.sub}>Imagify AI account</Text>
        </View>
      </View>

      <Divider />

      <List.Section>
        <List.Subheader>Account</List.Subheader>
        <List.Item
          title="Edit profile"
          description="Name, password, and security"
          left={(props) => <List.Icon {...props} icon="account-edit" />}
          onPress={() => router.push("/profile/edit")}
        />
        <List.Item
          title="Task history"
          left={(props) => <List.Icon {...props} icon="history" />}
          onPress={() => router.push("/profile/history")}
        />
        <List.Item
          title="Storage"
          left={(props) => <List.Icon {...props} icon="database" />}
          onPress={() => {}}
        />
        <List.Item
          title="Settings"
          left={(props) => <List.Icon {...props} icon="cog" />}
          onPress={() => {}}
        />
      </List.Section>

      <View style={styles.footer}>
        <Button mode="outlined" icon="logout" onPress={onLogout}>
          Log out
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, padding: 24 },
  headerText: { flex: 1 },
  email: { fontWeight: "700" },
  sub: { color: "#6B7280" },
  footer: { padding: 24, marginTop: "auto" },
});
