import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Linking, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar, Badge, Button, Card, IconButton, List, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { HistorySkeleton } from "@/components/HistorySkeleton";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { api } from "@/services/api";
import { useTaskStore, type Task } from "@/stores/taskStore";

const EXPIRY_DAYS = 7;
const PAGE_SIZE = 20;

interface HistoryPage {
  items: Task[];
  page: number;
  page_size: number;
  total: number;
}

export default function TaskHistoryScreen() {
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
      const { data } = await api.get<{ download_url: string }>(`/tasks/${task.id}/result`);
      await Linking.openURL(data.download_url);
    } catch {
      snackbar.error("Result not available");
    }
  };

  const renderItem = ({ item }: { item: Task }) => {
    const success = item.status === "success";
    const failed = item.status === "failed";
    const expired = success && isExpired(item.created_at);
    const date = new Date(item.created_at);
    const dateStr =
      date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      " • " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

    const badgeColor = expired
      ? "#9CA3AF"
      : success
      ? "#10B981"
      : failed
      ? "#EF4444"
      : item.status === "in_progress"
      ? "#3B82F6"
      : "#F59E0B";

    const badgeLabel = expired ? "expired" : item.status.replace("_", " ");

    return (
      <Card style={styles.card}>
        <List.Item
          title={item.task_type.toUpperCase()}
          description={dateStr}
          left={(props) => (
            <Avatar.Icon
              {...props}
              icon={getIcon(item.task_type)}
              size={40}
              style={{ backgroundColor: "#EEF2FF" }}
              color="#4F46E5"
            />
          )}
          right={() => (
            <View style={styles.right}>
              <Badge style={[styles.badge, { backgroundColor: badgeColor }]}>{badgeLabel}</Badge>
              {success && !expired && (
                <IconButton icon="download" size={20} onPress={() => onDownload(item)} />
              )}
              {failed && (
                <IconButton
                  icon="restart"
                  size={20}
                  onPress={() =>
                    snackbar.info("Retrying a task isn't supported yet — re-submit from the tool.")
                  }
                />
              )}
            </View>
          )}
        />
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Text variant="headlineSmall" style={styles.title}>Task History</Text>
      </View>

      {initialLoading ? (
        <HistorySkeleton rows={6} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Avatar.Icon
                size={64}
                icon="inbox-outline"
                color="#9CA3AF"
                style={{ backgroundColor: "#F3F4F6" }}
              />
              <Text variant="bodyLarge" style={styles.emptyTitle}>No tasks yet</Text>
              <Text variant="bodySmall" style={styles.emptySub}>
                Process an image, PDF, or document scan to see it here.
              </Text>
              <Button mode="contained-tonal" onPress={() => router.replace("/(tabs)")} style={styles.emptyBtn}>
                Browse tools
              </Button>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function getIcon(type: string): string {
  switch (type) {
    case "pdf":
      return "file-pdf-box";
    case "image":
      return "image";
    case "ai":
      return "auto-fix";
    case "ocr":
      return "text-recognition";
    default:
      return "file-question";
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 12, elevation: 1, backgroundColor: "#fff" },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  badge: { color: "#fff", alignSelf: "center" },
  empty: { padding: 64, alignItems: "center", gap: 8 },
  emptyTitle: { fontWeight: "700", color: "#374151", marginTop: 8 },
  emptySub: { color: "#9CA3AF", textAlign: "center" },
  emptyBtn: { marginTop: 12 },
});
