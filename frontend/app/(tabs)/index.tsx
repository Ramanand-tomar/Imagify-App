import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Card, Icon, Text } from "react-native-paper";

import { TaskProgressCard } from "@/components/TaskProgressCard";
import { useTaskStore } from "@/stores/taskStore";
import { pingServer } from "@/services/api";
import { ServerStatusBanner } from "@/components/ServerStatusBanner";
import { useState } from "react";

interface FeatureCard {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  route: "/(tabs)/pdf" | "/(tabs)/image" | "/(tabs)/scanner";
}

const features: FeatureCard[] = [
  { key: "pdf-merge", title: "Merge PDFs", subtitle: "Combine into one", icon: "file-multiple", route: "/(tabs)/pdf" },
  { key: "pdf-split", title: "Split PDF", subtitle: "Extract pages", icon: "content-cut", route: "/(tabs)/pdf" },
  { key: "img-compress", title: "Compress", subtitle: "Shrink image size", icon: "image-size-select-small", route: "/(tabs)/image" },
  { key: "img-convert", title: "Convert", subtitle: "JPG ↔ PNG ↔ WebP", icon: "image-sync", route: "/(tabs)/image" },
  { key: "scan", title: "Scan Doc", subtitle: "Camera → PDF", icon: "scanner", route: "/(tabs)/scanner" },
  { key: "ai", title: "AI Enhance", subtitle: "Upscale & restore", icon: "auto-fix", route: "/(tabs)/image" },
];

export default function HomeScreen() {
  const router = useRouter();
  const history = useTaskStore((s) => s.history);
  const loadHistory = useTaskStore((s) => s.loadHistory);
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

    loadHistory().catch(() => {});
    return () => { active = false; };
  }, [loadHistory]);

  return (
    <View style={styles.flex}>
      <ServerStatusBanner visible={wakingUp} />
      <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.banner} onPress={() => router.push("/(tabs)/image")}>
        <Card.Content style={styles.bannerContent}>
          <Icon source="star-four-points" size={32} color="#FFF" />
          <View style={styles.bannerText}>
            <Text variant="titleMedium" style={styles.bannerTitle}>Try AI Enhancement</Text>
            <Text variant="bodySmall" style={styles.bannerSub}>Upscale photos up to 4×</Text>
          </View>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.section}>Tools</Text>
      <View style={styles.grid}>
        {features.map((f) => (
          <Card key={f.key} style={styles.tile} onPress={() => router.push(f.route)}>
            <Card.Content style={styles.tileContent}>
              <Icon source={f.icon} size={32} color="#4F46E5" />
              <Text variant="titleSmall" style={styles.tileTitle}>{f.title}</Text>
              <Text variant="bodySmall" style={styles.tileSub}>{f.subtitle}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      <Text variant="titleMedium" style={styles.section}>Recent tasks</Text>
      {history.length === 0 ? (
        <Text variant="bodyMedium" style={styles.empty}>No tasks yet. Pick a tool above to get started.</Text>
      ) : (
        history.slice(0, 5).map((task) => <TaskProgressCard key={task.id} task={task} />)
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 12 },
  banner: { backgroundColor: "#4F46E5" },
  bannerContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  bannerText: { flex: 1 },
  bannerTitle: { color: "#FFF", fontWeight: "700" },
  bannerSub: { color: "#E0E7FF" },
  section: { marginTop: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  tile: { width: "48%" },
  tileContent: { alignItems: "center", gap: 6, paddingVertical: 16 },
  tileTitle: { fontWeight: "700" },
  tileSub: { color: "#6B7280", textAlign: "center" },
  empty: { color: "#6B7280", paddingVertical: 8 },
});
