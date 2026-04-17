import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button, Card, HelperText, Text } from "react-native-paper";

export interface ResultViewerProps {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ResultViewer({ filename, mimeType, sizeBytes, downloadUrl }: ResultViewerProps) {
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const downloadLocal = async (): Promise<string> => {
    const target = `${FileSystem.cacheDirectory}${filename}`;
    const { uri } = await FileSystem.downloadAsync(downloadUrl, target);
    return uri;
  };

  const onShare = async () => {
    setError(null);
    setBusy("share");
    try {
      const uri = await downloadLocal();
      if (!(await Sharing.isAvailableAsync())) {
        setError("Sharing is not available on this device");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: `Share ${filename}` });
    } catch (e: any) {
      setError(e?.message ?? "Share failed");
    } finally {
      setBusy(null);
    }
  };

  const onDownload = async () => {
    setError(null);
    setBusy("download");
    try {
      const uri = await downloadLocal();
      setSavedPath(uri);
    } catch (e: any) {
      setError(e?.message ?? "Download failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={styles.card}>
      <Card.Title title={filename} subtitle={`${mimeType} · ${formatBytes(sizeBytes)}`} />
      <Card.Actions>
        <Button
          mode="contained-tonal"
          icon="download"
          onPress={onDownload}
          loading={busy === "download"}
          disabled={busy !== null}
        >
          Download
        </Button>
        <Button
          mode="contained"
          icon="share-variant"
          onPress={onShare}
          loading={busy === "share"}
          disabled={busy !== null}
        >
          Share
        </Button>
      </Card.Actions>
      {savedPath && (
        <View style={styles.savedRow}>
          <Text variant="bodySmall" style={styles.savedText}>Saved to {savedPath}</Text>
          <Button compact onPress={() => Linking.openURL(savedPath)}>Open</Button>
        </View>
      )}
      {error && <HelperText type="error" visible>{error}</HelperText>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: 8 },
  savedRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
  savedText: { flex: 1, color: "#6B7280" },
});
