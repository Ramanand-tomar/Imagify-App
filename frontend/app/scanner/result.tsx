import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResultViewer } from "@/components/ResultViewer";

export default function ScannerResultScreen() {
  const router = useRouter();
  const { url, filename, mime, size } = useLocalSearchParams<{
    url: string; filename: string; mime: string; size: string;
  }>();

  const sizeBytes = parseInt(size ?? "0", 10) || 0;
  const isImage = (mime ?? "").startsWith("image/");

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Scan result" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {isImage && url && (
          <View style={styles.previewBox}>
            <Image source={{ uri: url }} style={styles.preview} resizeMode="contain" />
          </View>
        )}

        {url && filename && mime && (
          <ResultViewer
            filename={filename}
            mimeType={mime}
            sizeBytes={sizeBytes}
            downloadUrl={url}
          />
        )}

        <Text variant="bodySmall" style={styles.hint}>
          Result saved to your task history. Open from the Home screen or Profile tab.
        </Text>

        <View style={styles.actions}>
          <Button mode="contained-tonal" icon="arrow-left" onPress={() => router.replace("/(tabs)/scanner")}>
            Scan another
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 12 },
  previewBox: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  hint: { color: "#6B7280", marginTop: 8 },
  actions: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
});
