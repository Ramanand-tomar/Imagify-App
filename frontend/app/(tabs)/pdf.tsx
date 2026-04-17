import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { Card, Icon, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface PdfTool {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  route:
    | "/pdf/merge"
    | "/pdf/split"
    | "/pdf/compress"
    | "/pdf/rotate"
    | "/pdf/page-numbers"
    | "/pdf/watermark"
    | "/pdf/to-jpg"
    | "/pdf/from-images"
    | "/pdf/protect"
    | "/pdf/unlock"
    | "/pdf/repair";
}

const tools: PdfTool[] = [
  { key: "merge", title: "Merge PDFs", subtitle: "Combine into one", icon: "file-multiple", route: "/pdf/merge" },
  { key: "split", title: "Split PDF", subtitle: "Extract page ranges", icon: "content-cut", route: "/pdf/split" },
  { key: "compress", title: "Compress", subtitle: "Shrink file size", icon: "zip-box", route: "/pdf/compress" },
  { key: "rotate", title: "Rotate", subtitle: "Turn pages", icon: "rotate-right", route: "/pdf/rotate" },
  { key: "page-numbers", title: "Page Numbers", subtitle: "Add numbering", icon: "format-list-numbered", route: "/pdf/page-numbers" },
  { key: "watermark", title: "Watermark", subtitle: "Add text overlay", icon: "watermark", route: "/pdf/watermark" },
  { key: "to-jpg", title: "PDF → JPG", subtitle: "Export pages", icon: "image-multiple", route: "/pdf/to-jpg" },
  { key: "from-images", title: "Images → PDF", subtitle: "Build a PDF", icon: "image-plus", route: "/pdf/from-images" },
  { key: "protect", title: "Protect", subtitle: "Password lock", icon: "lock", route: "/pdf/protect" },
  { key: "unlock", title: "Unlock", subtitle: "Remove password", icon: "lock-open", route: "/pdf/unlock" },
  { key: "repair", title: "Repair", subtitle: "Fix corrupt PDFs", icon: "wrench", route: "/pdf/repair" },
];

export default function PdfTabScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="headlineSmall" style={styles.title}>PDF Tools</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>Pick a tool to process your PDF</Text>
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
