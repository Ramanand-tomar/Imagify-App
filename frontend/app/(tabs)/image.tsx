import { useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import { IconTile, Screen, SectionHeader, Text, type IconTileTone } from "@/components/ui";

interface ImageTool {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: IconTileTone;
  badge?: string;
  route: Href;
}

const aiTools: ImageTool[] = [
  {
    key: "enhance",
    title: "AI Enhance",
    subtitle: "Upscale, denoise, restore",
    icon: "auto-fix",
    tone: "violet",
    badge: "AI",
    route: "/image/enhance",
  },
];

const basicTools: ImageTool[] = [
  { key: "convert", title: "Convert", subtitle: "JPG ↔ PNG ↔ WebP", icon: "image-sync", tone: "brand", route: "/image/convert" },
  { key: "compress", title: "Compress", subtitle: "Shrink file size", icon: "image-size-select-small", tone: "cyan", route: "/image/compress" },
  { key: "resize", title: "Resize", subtitle: "Change dimensions", icon: "resize", tone: "emerald", route: "/image/resize" },
  { key: "batch", title: "Batch Process", subtitle: "Process 5 images", icon: "layers-triple", tone: "amber", route: "/image/batch" },
];

export default function ImageTabScreen() {
  const router = useRouter();

  return (
    <Screen edges={["top"]}>
      <View>
        <Text variant="h1">Image Tools</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: 4 }}>
          Enhance, convert, and optimize your images
        </Text>
      </View>

      <SectionHeader overline="AI powered" title="Smart enhancement" />
      <View style={styles.grid}>
        {aiTools.map((t) => (
          <IconTile
            key={t.key}
            title={t.title}
            subtitle={t.subtitle}
            icon={t.icon}
            tone={t.tone}
            badge={t.badge}
            onPress={() => router.push(t.route)}
            style={styles.fullTile}
          />
        ))}
      </View>

      <SectionHeader overline="Essentials" title="Convert & optimize" />
      <View style={styles.grid}>
        {basicTools.map((t) => (
          <IconTile
            key={t.key}
            title={t.title}
            subtitle={t.subtitle}
            icon={t.icon}
            tone={t.tone}
            onPress={() => router.push(t.route)}
            style={styles.halfTile}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  halfTile: { width: "48%" },
  fullTile: { width: "100%" },
});
