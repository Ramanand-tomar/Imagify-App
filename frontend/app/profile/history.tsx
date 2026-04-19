import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { HistorySkeleton } from "@/components/HistorySkeleton";
import { AppHeader, Badge, Card, EmptyState, Text } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { api } from "@/services/api";
import { downloadResultToCache, openInViewer, saveToDevice } from "@/services/fileService";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { useAppTheme } from "@/theme/useTheme";
import { extractErrorMessage, isAuthError } from "@/utils/errors";
import { createLogger } from "@/utils/logger";

const log = createLogger("history");

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
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const [items, setItems] = useState<Task[]>(history);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      } catch (err) {
        log.warn("Failed to load task history", err);
        if (isAuthError(err)) {
          snackbar.error("Your session expired. Please sign in again.");
        } else {
          snackbar.error(extractErrorMessage(err, "Failed to load task history"));
        }
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

  const fetchAndDownload = async (task: Task): Promise<{ uri: string; mime: string; name: string } | null> => {
    if (isExpired(task.created_at)) {
      snackbar.error("This download link has expired");
      return null;
    }
    try {
      const { data } = await api.get<{
        download_url: string;
        original_filename: string;
        mime_type: string;
      }>(`/tasks/${task.id}/result`);
      if (!data?.download_url) throw new Error("Download URL missing from server response");
      const uri = await downloadResultToCache(data.download_url, data.original_filename);
      return { uri, mime: data.mime_type, name: data.original_filename };
    } catch (err) {
      log.warn("Download failed", err);
      if (isAuthError(err)) {
        snackbar.error("Your session expired. Please sign in again.");
      } else {
        snackbar.error(extractErrorMessage(err, "Couldn't download result"));
      }
      return null;
    }
  };

  const onSave = async (task: Task) => {
    const got = await fetchAndDownload(task);
    if (!got) return;
    try {
      const where = await saveToDevice(got.uri, got.mime, got.name);
      snackbar.success(where);
    } catch (err) {
      snackbar.error(extractErrorMessage(err, "Save failed"));
    }
  };

  const onView = async (task: Task) => {
    const got = await fetchAndDownload(task);
    if (!got) return;
    try {
      const opened = await openInViewer(got.uri, got.mime);
      if (!opened) snackbar.info("This file type can't be previewed inline");
    } catch (err) {
      snackbar.error(extractErrorMessage(err, "Couldn't open file"));
    }
  };

  const onDelete = (task: Task) => {
    Alert.alert(
      "Delete this task?",
      "The processed file will be removed from storage and your history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(task.id);
            try {
              await deleteTask(task.id);
              setItems((prev) => prev.filter((t) => t.id !== task.id));
              setTotal((t) => (t === null ? t : Math.max(0, t - 1)));
              snackbar.success("Task deleted");
            } catch (err) {
              log.warn("Delete failed", err);
              snackbar.error(extractErrorMessage(err, "Couldn't delete task"));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
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
              <>
                <Pressable
                  onPress={() => onView(item)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: pressed ? theme.colors.brand[50] : "transparent" },
                  ]}
                  accessibilityLabel="View file"
                >
                  <Icon source="eye-outline" size={18} color={theme.colors.brand.default} />
                </Pressable>
                <Pressable
                  onPress={() => onSave(item)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    { backgroundColor: pressed ? theme.colors.brand[50] : "transparent" },
                  ]}
                  accessibilityLabel="Save file"
                >
                  <Icon source="content-save-outline" size={18} color={theme.colors.brand.default} />
                </Pressable>
              </>
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
            <Pressable
              onPress={() => onDelete(item)}
              hitSlop={8}
              disabled={deletingId === item.id}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: pressed ? theme.colors.status.errorSoft : "transparent",
                  opacity: deletingId === item.id ? 0.5 : 1,
                },
              ]}
              accessibilityLabel="Delete task"
            >
              <Icon source="trash-can-outline" size={18} color={theme.colors.status.error} />
            </Pressable>
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
