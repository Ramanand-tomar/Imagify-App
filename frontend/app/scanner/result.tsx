import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, StyleSheet, View } from "react-native";

import { ResultViewer } from "@/components/ResultViewer";
import { AppHeader, Button, Card, Screen, Text } from "@/components/ui";

export default function ScannerResultScreen() {
  const router = useRouter();
  const { url, filename, mime, size } = useLocalSearchParams<{
    url: string;
    filename: string;
    mime: string;
    size: string;
  }>();

  const sizeBytes = parseInt(size ?? "0", 10) || 0;
  const isImage = (mime ?? "").startsWith("image/");

  return (
    <>
      <AppHeader title="Scan result" />
      <Screen>
        {isImage && url ? (
          <Card padded={false} radius="xl" style={styles.previewBox}>
            <Image source={{ uri: url }} style={styles.preview} resizeMode="contain" />
          </Card>
        ) : null}

        {url && filename && mime ? (
          <ResultViewer filename={filename} mimeType={mime} sizeBytes={sizeBytes} downloadUrl={url} />
        ) : null}

        <Text variant="caption" tone="muted" align="center">
          Result saved to your task history. Open from Home or Profile.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Scan another"
            icon="camera-plus-outline"
            variant="soft"
            onPress={() => router.replace("/(tabs)/scanner")}
            fullWidth
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  previewBox: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#0F172A",
    overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  actions: { marginTop: 4 },
});
