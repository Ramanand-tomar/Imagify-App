import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Card, Icon, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface ImageTool {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  route: "/image/enhance" | "/image/convert" | "/image/compress" | "/image/resize";
}

const tools: ImageTool[] = [
  { key: "enhance", title: "Enhance", subtitle: "CLAHE, sharpen, edges…", icon: "auto-fix", route: "/image/enhance" },
  { key: "convert", title: "Convert", subtitle: "JPG ↔ PNG ↔ WebP", icon: "image-sync", route: "/image/convert" },
  { key: "compress", title: "Compress", subtitle: "Shrink file size", icon: "image-size-select-small", route: "/image/compress" },
  { key: "resize", title: "Resize", subtitle: "Change dimensions", icon: "resize", route: "/image/resize" },
  { key: "batch", title: "Batch Process", subtitle: "Process 5 images", icon: "layers-triple", route: "/image/batch" as any },
];

export default function ImageTabScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="headlineSmall" style={styles.title}>Image Tools</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>Enhance or convert images</Text>
        <View style={styles.grid}>
          {tools.map((t) => (
            <Card key={t.key} style={styles.tile} onPress={() => router.push(t.route)}>
              <Card.Content style={styles.tileContent}>
                <Icon source={t.icon} size={28} color="#4F46E5" />
                <Text variant="titleSmall" style={styles.tileTitle}>{t.title}</Text>
                <Text variant="bodySmall" style={styles.tileSub}>{t.subtitle}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  title: { fontWeight: "700" },
  subtitle: { color: "#6B7280", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  tile: { width: "48%" },
  tileContent: { alignItems: "center", gap: 6, paddingVertical: 14 },
  tileTitle: { fontWeight: "700", textAlign: "center" },
  tileSub: { color: "#6B7280", textAlign: "center" },
});
