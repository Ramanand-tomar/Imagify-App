import { useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import { IconTile, Screen, SectionHeader, Text, type IconTileTone } from "@/components/ui";

type Tone = IconTileTone;

interface PdfTool {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: Tone;
  route: Href;
}

const organizeTools: PdfTool[] = [
  { key: "merge", title: "Merge", subtitle: "Combine into one", icon: "file-multiple", tone: "brand", route: "/pdf/merge" },
  { key: "split", title: "Split", subtitle: "Extract ranges", icon: "content-cut", tone: "violet", route: "/pdf/split" },
  { key: "rotate", title: "Rotate", subtitle: "Turn pages", icon: "rotate-right", tone: "cyan", route: "/pdf/rotate" },
  { key: "page-numbers", title: "Page Numbers", subtitle: "Add numbering", icon: "format-list-numbered", tone: "emerald", route: "/pdf/page-numbers" },
];

const convertTools: PdfTool[] = [
  { key: "compress", title: "Compress", subtitle: "Shrink file size", icon: "zip-box", tone: "brand", route: "/pdf/compress" },
  { key: "watermark", title: "Watermark", subtitle: "Add text overlay", icon: "watermark", tone: "amber", route: "/pdf/watermark" },
  { key: "to-jpg", title: "PDF → JPG", subtitle: "Export pages", icon: "image-multiple", tone: "violet", route: "/pdf/to-jpg" },
  { key: "from-images", title: "Images → PDF", subtitle: "Build a PDF", icon: "image-plus", tone: "cyan", route: "/pdf/from-images" },
];

const secureTools: PdfTool[] = [
  { key: "protect", title: "Protect", subtitle: "Password lock", icon: "lock", tone: "rose", route: "/pdf/protect" },
  { key: "unlock", title: "Unlock", subtitle: "Remove password", icon: "lock-open", tone: "emerald", route: "/pdf/unlock" },
  { key: "repair", title: "Repair", subtitle: "Fix corrupt PDFs", icon: "wrench", tone: "amber", route: "/pdf/repair" },
];

function Grid({ tools, router }: { tools: PdfTool[]; router: ReturnType<typeof useRouter> }) {
  return (
    <View style={styles.grid}>
      {tools.map((t) => (
        <IconTile
          key={t.key}
          title={t.title}
          subtitle={t.subtitle}
          icon={t.icon}
          tone={t.tone}
          onPress={() => router.push(t.route)}
          style={styles.tile}
        />
      ))}
    </View>
  );
}

export default function PdfTabScreen() {
  const router = useRouter();
  return (
    <Screen edges={["top"]}>
      <View>
        <Text variant="h1">PDF Tools</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: 4 }}>
          Organize, convert, and secure your PDFs
        </Text>
      </View>

      <SectionHeader overline="Organize" title="Reorder & edit" />
      <Grid tools={organizeTools} router={router} />

      <SectionHeader overline="Convert" title="Transform & export" />
      <Grid tools={convertTools} router={router} />

      <SectionHeader overline="Secure" title="Protect & repair" />
      <Grid tools={secureTools} router={router} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  tile: { width: "48%" },
});
