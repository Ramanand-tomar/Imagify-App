import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { HistorySkeleton } from "@/components/HistorySkeleton";
import { AppHeader, Badge, Card, EmptyState, Text } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function resolveUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_BASE}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

const EXPIRY_DAYS = 7;
const PAGE_SIZE = 20;

interface HistoryPage {
  items: Task[];
  page: number;
  page_size: number;
  total: number;
}

function iconFor(type: Task["task_type"]): string {
  switch (type) {
    case "pdf":
      return "file-pdf-box";
    case "image":
      return "image-outline";
    case "ai":
      return "auto-fix";
    case "ocr":
      return "text-recognition";
    default:
      return "file-question-outline";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

export default function TaskHistoryScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const snackbar = useSnackbar();
  const history = useTaskStore((s) => s.history);

  const [items, setItems] = useState<Task[]>(history);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(
    async (targetPage: number, mode: "initial" | "refresh" | "more") => {
      if (mode === "initial") setInitialLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "more") setLoadingMore(true);
      try {
        const { data } = await api.get<HistoryPage>("/tasks/history", {
          params: { page: targetPage, page_size: PAGE_SIZE },
        });
        setTotal(data.total);
        setItems((prev) => (mode === "more" ? [...prev, ...data.items] : data.items));
        setPage(data.page);
      } catch {
        snackbar.error("Failed to load task history");
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [snackbar],
  );

  useEffect(() => {
    fetchPage(1, "initial");
  }, [fetchPage]);

  const onRefresh = () => fetchPage(1, "refresh");

  const onEndReached = () => {
    if (loadingMore || total === null) return;
    if (items.length >= total) return;
    fetchPage(page + 1, "more");
  };

  const isExpired = (createdAt: string): boolean => {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    return ageMs > EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  };

  const onDownload = async (task: Task) => {
    if (isExpired(task.created_at)) {
      snackbar.error("This download link has expired");
      return;
    }
    try {
      const { data } = await api.get<{
        download_url: string;
        original_filename: string;
        mime_type: string;
      }>(`/tasks/${task.id}/result`);

      const target = `${FileSystem.cacheDirectory}${data.original_filename}`;
      try {
        await FileSystem.deleteAsync(target, { idempotent: true });
      } catch {
        /* ignore */
      }
      const token = useAuthStore.getState().accessToken;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const result = await FileSystem.downloadAsync(resolveUrl(data.download_url), target, { headers });
      if (result.status >= 400) {
        throw new Error(`HTTP ${result.status}`);
      }
      if (!(await Sharing.isAvailableAsync())) {
        snackbar.info(`Saved to cache: ${data.original_filename}`);
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: data.mime_type,
        dialogTitle: `Save ${data.original_filename}`,
        UTI: data.mime_type,
      });
    } catch {
      snackbar.error("Result not available");
    }
  };

  const renderItem = ({ item }: { item: Task }) => {
    const success = item.status === "success";
    const failed = item.status === "failed";
    const expired = success && isExpired(item.created_at);

    let tone: BadgeTone = "neutral";
    let label = item.status.replace("_", " ");
    if (expired) {
      tone = "neutral";
      label = "expired";
    } else if (success) {
      tone = "success";
      label = "done";
    } else if (failed) {
      tone = "error";
      label = "failed";
    } else if (item.status === "in_progress") {
      tone = "brand";
      label = "processing";
    } else {
      tone = "warning";
      label = "queued";
    }

    return (
      <Card padded={false}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.brand[50] }]}>
            <Icon source={iconFor(item.task_type)} size={22} color={theme.colors.brand.default} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMd" numberOfLines={1}>
              {item.task_type.toUpperCase()}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatDate(item.created_at)}
            </Text>
          </View>
          <View style={styles.right}>
            <Badge label={label} tone={tone} />
            {success && !expired ? (
              <Pressable
                onPress={() => onDownload(item)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: pressed ? theme.colors.brand[50] : "transparent" },
                ]}
              >
                <Icon source="download" size={18} color={theme.colors.brand.default} />
              </Pressable>
            ) : null}
            {failed ? (
              <Pressable
                onPress={() => snackbar.info("Retrying a task isn't supported yet — re-submit from the tool.")}
                hitSlop={8}
                style={styles.iconBtn}
              >
                <Icon source="restart" size={18} color={theme.colors.text.secondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <>
      <AppHeader title="Task history" subtitle={total !== null ? `${total} total` : undefined} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface.background }]} edges={["bottom"]}>
        {initialLoading ? (
          <View style={{ padding: 16 }}>
            <HistorySkeleton rows={6} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.brand.default}
                colors={[theme.colors.brand.default]}
              />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <EmptyState
                  icon="inbox-outline"
                  title="No tasks yet"
                  description="Process an image, PDF, or document scan to see it here."
                  actionLabel="Browse tools"
                  onAction={() => router.replace("/(tabs)")}
                />
              </View>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={theme.colors.brand.default} /> : null
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
