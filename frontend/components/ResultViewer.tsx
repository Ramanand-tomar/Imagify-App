import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, TextInput as PaperInput } from "react-native-paper";

import { Badge, Button, Card, Text } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { useAppTheme } from "@/theme/useTheme";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function resolveDownloadUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_BASE}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

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

function iconForMime(mime: string): string {
  if (mime.startsWith("image/")) return "image-outline";
  if (mime === "application/pdf") return "file-pdf-box";
  if (mime.startsWith("text/")) return "file-document-outline";
  if (mime.includes("zip")) return "folder-zip-outline";
  return "file-outline";
}

/** Strip invalid filename chars. Empty result falls back to "file". */
function sanitize(name: string): string {
  const cleaned = name.trim().replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, " ");
  return cleaned || "file";
}

function splitExt(name: string): { base: string; ext: string } {
  const m = name.match(/\.[^.]+$/);
  if (!m) return { base: name, ext: "" };
  return { base: name.slice(0, m.index), ext: m[0] };
}

export function ResultViewer({ filename: serverFilename, mimeType, sizeBytes, downloadUrl }: ResultViewerProps) {
  const theme = useAppTheme();
  const initial = useMemo(() => splitExt(serverFilename), [serverFilename]);

  const [baseName, setBaseName] = useState(initial.base);
  const ext = initial.ext;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveName = sanitize(baseName) + ext;

  const ensureLocalCopy = async (): Promise<string> => {
    const target = `${FileSystem.cacheDirectory}${effectiveName}`;
    // Overwrite any previous copy with the same name
    try {
      await FileSystem.deleteAsync(target, { idempotent: true });
    } catch {
      /* ignore */
    }
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const resolved = resolveDownloadUrl(downloadUrl);
    const result = await FileSystem.downloadAsync(resolved, target, { headers });
    if (result.status >= 400) {
      throw new Error(`Download failed (HTTP ${result.status})`);
    }
    return result.uri;
  };

  const openShareSheet = async (dialogTitle: string) => {
    const uri = await ensureLocalCopy();
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Sharing is not available on this device");
    }
    await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType });
    return uri;
  };

  const onSave = async () => {
    setError(null);
    setInfo(null);
    setBusy("save");
    try {
      await openShareSheet(`Save ${effectiveName}`);
      setInfo(`Saved as ${effectiveName}`);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    setError(null);
    setInfo(null);
    setBusy("share");
    try {
      await openShareSheet(`Share ${effectiveName}`);
    } catch (e: any) {
      setError(e?.message ?? "Share failed");
    } finally {
      setBusy(null);
    }
  };

  const commitRename = () => {
    const trimmed = baseName.trim();
    if (!trimmed) {
      setBaseName(initial.base);
    } else {
      setBaseName(sanitize(trimmed));
    }
    setEditing(false);
    setInfo(null);
  };

  return (
    <Card variant="elevated" radius="lg">
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.status.successSoft }]}>
          <Icon source={iconForMime(mimeType)} size={22} color={theme.colors.status.success} />
        </View>
        <View style={styles.headerText}>
          {editing ? (
            <View style={styles.editRow}>
              <PaperInput
                value={baseName}
                onChangeText={setBaseName}
                mode="outlined"
                autoFocus
                dense
                outlineStyle={{ borderRadius: theme.radius.sm, borderWidth: 1 }}
                style={[
                  styles.editInput,
                  { backgroundColor: theme.colors.surface.card, fontFamily: theme.fontFamily.medium },
                ]}
                theme={{
                  colors: {
                    primary: theme.colors.brand.default,
                    outline: theme.colors.border.default,
                    onSurface: theme.colors.text.primary,
                    background: theme.colors.surface.card,
                  },
                  roundness: theme.radius.sm,
                }}
                onSubmitEditing={commitRename}
                returnKeyType="done"
              />
              <Text variant="caption" tone="secondary">
                {ext}
              </Text>
              <Pressable
                onPress={commitRename}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: pressed ? theme.colors.brand[50] : "transparent" },
                ]}
              >
                <Icon source="check" size={18} color={theme.colors.brand.default} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditing(true)}
              style={styles.nameRow}
              hitSlop={4}
            >
              <Text variant="titleMd" numberOfLines={1} style={{ flex: 1 }}>
                {effectiveName}
              </Text>
              <Icon source="pencil-outline" size={14} color={theme.colors.text.muted} />
            </Pressable>
          )}
          <Text variant="caption" tone="secondary">
            {mimeType} · {formatBytes(sizeBytes)}
          </Text>
        </View>
        <Badge label="Ready" tone="success" icon="check" />
      </View>

      <View style={styles.actions}>
        <Button
          label="Save"
          icon="tray-arrow-down"
          variant="secondary"
          onPress={onSave}
          loading={busy === "save"}
          disabled={busy !== null}
          style={{ flex: 1 }}
          fullWidth
        />
        <Button
          label="Share"
          icon="share-variant"
          onPress={onShare}
          loading={busy === "share"}
          disabled={busy !== null}
          style={{ flex: 1 }}
          fullWidth
        />
      </View>

      {info ? (
        <Text variant="caption" tone="success" style={{ marginTop: 10 }}>
          {info}
        </Text>
      ) : null}

      {error ? (
        <Text variant="caption" tone="error" style={{ marginTop: 10 }}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  editInput: { flex: 1, height: 36, fontSize: 14 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
});
