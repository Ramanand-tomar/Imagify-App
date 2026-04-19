import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Switch } from "react-native-paper";

import { AppHeader, Button, Card, ChipGroup, SectionHeader, Text } from "@/components/ui";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAppTheme } from "@/theme/useTheme";
import { extractErrorMessage } from "@/utils/errors";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function measureCacheSize(): Promise<number> {
  const root = FileSystem.cacheDirectory;
  if (!root) return 0;
  try {
    const entries = await FileSystem.readDirectoryAsync(root);
    let total = 0;
    for (const name of entries) {
      const info = await FileSystem.getInfoAsync(`${root}${name}`);
      if (info.exists && info.size) total += info.size;
    }
    return total;
  } catch {
    return 0;
  }
}

async function clearCacheDir(): Promise<void> {
  const root = FileSystem.cacheDirectory;
  if (!root) return;
  const entries = await FileSystem.readDirectoryAsync(root);
  await Promise.all(
    entries.map((name) => FileSystem.deleteAsync(`${root}${name}`, { idempotent: true })),
  );
}

export default function SettingsScreen() {
  const theme = useAppTheme();
  const snackbar = useSnackbar();
  const { hapticsEnabled, themePreference, update, hydrate, hydrated } = useSettingsStore();

  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    measureCacheSize().then(setCacheSize);
  }, []);

  const onClearCache = () => {
    Alert.alert(
      "Clear cached files?",
      "This removes downloaded results from this device. Your tasks and storage on the server are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await clearCacheDir();
              setCacheSize(0);
              snackbar.success("Cache cleared");
            } catch (err) {
              snackbar.error(extractErrorMessage(err, "Couldn't clear cache"));
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <AppHeader title="Settings" subtitle="App preferences" />
      <View style={[styles.container, { backgroundColor: theme.colors.surface.background }]}>
        <View style={{ padding: 16, gap: 14 }}>
          <SectionHeader title="Appearance" />
          <Card>
            <Text variant="titleSm" style={{ marginBottom: 8 }}>
              Theme
            </Text>
            <ChipGroup
              value={themePreference}
              onChange={(v) => update({ themePreference: v as "system" | "light" | "dark" })}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
              Theme follows your device by default. Currently the dark/light
              palettes are applied automatically; an override applies on next
              app launch.
            </Text>
          </Card>

          <SectionHeader title="Interaction" />
          <Card>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMd">Haptic feedback</Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                  Vibrate on taps and confirmations
                </Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={(v) => update({ hapticsEnabled: v })}
                color={theme.colors.brand.default}
              />
            </View>
          </Card>

          <SectionHeader title="Storage" />
          <Card>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMd">Cache size</Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                  {cacheSize === null ? "Calculating…" : formatBytes(cacheSize)}
                </Text>
              </View>
              <Button
                label="Clear"
                icon="trash-can-outline"
                variant="soft"
                onPress={onClearCache}
                loading={clearing}
                disabled={clearing || cacheSize === 0}
              />
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
              Cached files are downloaded results stored on this device for
              quick re-opening. Removing them is safe.
            </Text>
          </Card>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
