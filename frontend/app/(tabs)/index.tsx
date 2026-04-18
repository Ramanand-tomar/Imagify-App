import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

import { ServerStatusBanner } from "@/components/ServerStatusBanner";
import { TaskProgressCard } from "@/components/TaskProgressCard";
import {
  Avatar,
  EmptyState,
  GradientSurface,
  IconTile,
  Screen,
  SectionHeader,
  Text,
} from "@/components/ui";
import { pingServer } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";

interface FeatureCard {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: "brand" | "violet" | "cyan" | "emerald" | "amber" | "rose";
  route: Href;
}

const features: FeatureCard[] = [
  { key: "pdf-merge", title: "Merge PDFs", subtitle: "Combine files into one", icon: "file-multiple", tone: "brand", route: "/pdf/merge" },
  { key: "pdf-split", title: "Split PDF", subtitle: "Extract pages", icon: "content-cut", tone: "violet", route: "/pdf/split" },
  { key: "img-compress", title: "Compress", subtitle: "Shrink image size", icon: "image-size-select-small", tone: "cyan", route: "/image/compress" },
  { key: "img-convert", title: "Convert", subtitle: "JPG ↔ PNG ↔ WebP", icon: "image-sync", tone: "emerald", route: "/image/convert" },
  { key: "scan", title: "Scan Doc", subtitle: "Camera → PDF", icon: "line-scan", tone: "amber", route: "/(tabs)/scanner" },
  { key: "ai", title: "AI Enhance", subtitle: "Upscale & restore", icon: "auto-fix", tone: "rose", route: "/image/enhance" },
];

function firstName(input?: string): string {
  if (!input) return "there";
  const name = input.trim().split(" ")[0];
  return name || "there";
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const history = useTaskStore((s) => s.history);
  const loadHistory = useTaskStore((s) => s.loadHistory);
  const user = useAuthStore((s) => s.user);
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
    return () => {
      active = false;
    };
  }, [loadHistory]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.background }}>
      <ServerStatusBanner visible={wakingUp} />
      <Screen edges={["top"]}>
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="secondary">
              Welcome back
            </Text>
            <Text variant="h1" style={{ marginTop: 2 }}>
              Hi, {firstName(user?.full_name || user?.email)} 👋
            </Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/profile")} hitSlop={8}>
            <Avatar name={user?.full_name} email={user?.email} size="md" />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/image/enhance")} style={{ marginTop: 4 }}>
          <GradientSurface radius="2xl" contentStyle={styles.bannerContent}>
            <View style={styles.bannerIconWrap}>
              <Icon source="star-four-points" size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: "rgba(255,255,255,0.85)" }}>
                NEW · AI
              </Text>
              <Text variant="h3" style={{ color: "#FFFFFF", marginTop: 2 }}>
                Try AI Enhancement
              </Text>
              <Text variant="bodySm" style={{ color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
                Upscale photos up to 4× and restore details
              </Text>
            </View>
            <Icon source="chevron-right" size={22} color="#FFFFFF" />
          </GradientSurface>
        </Pressable>

        <SectionHeader overline="Quick access" title="Tools" />
        <View style={styles.grid}>
          {features.map((f) => (
            <IconTile
              key={f.key}
              title={f.title}
              subtitle={f.subtitle}
              icon={f.icon}
              tone={f.tone}
              onPress={() => router.push(f.route)}
              style={styles.tile}
            />
          ))}
        </View>

        <SectionHeader
          title="Recent tasks"
          actionLabel={history.length > 0 ? "View all" : undefined}
          onAction={() => router.push("/profile/history")}
        />
        {history.length === 0 ? (
          <EmptyState
            icon="clock-time-four-outline"
            title="No tasks yet"
            description="Pick a tool above to process your first file."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {history.slice(0, 5).map((task) => (
              <TaskProgressCard key={task.id} task={task} />
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bannerContent: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  bannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  tile: { width: "48%" },
});
