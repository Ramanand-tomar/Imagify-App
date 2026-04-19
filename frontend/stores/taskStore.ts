import { create } from "zustand";

import { api } from "@/services/api";
import { createLogger } from "@/utils/logger";

const log = createLogger("taskStore");

export type TaskStatus = "pending" | "in_progress" | "success" | "failed";
export type TaskType = "pdf" | "image" | "ai" | "ocr";

export interface Task {
  id: string;
  task_type: TaskType;
  status: TaskStatus;
  progress: number;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface BatchStatus {
  batch_id: string;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  results: Array<{
    task_id: string;
    download_url: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
  }>;
  tasks: Task[];
}

interface TaskState {
  active: Record<string, Task>;
  history: Task[];
  historyLoaded: boolean;

  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  pollTask: (id: string, intervalMs?: number) => () => void;
  pollBatch: (batchId: string, onUpdate: (status: BatchStatus) => void, intervalMs?: number) => () => void;
  loadHistory: (page?: number) => Promise<void>;
  reset: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  active: {},
  history: [],
  historyLoaded: false,

  addTask: (task) =>
    set((state) => ({ active: { ...state.active, [task.id]: task } })),

  updateTask: (id, patch) =>
    set((state) => {
      const existing = state.active[id];
      if (!existing) {
        // Batch tasks may arrive before being explicitly added; seed defaults
        const seeded: Task = {
          id,
          task_type: "pdf",
          status: "pending",
          progress: 0,
          created_at: new Date().toISOString(),
          ...patch,
        };
        return { active: { ...state.active, [id]: seeded } };
      }
      return { active: { ...state.active, [id]: { ...existing, ...patch } } };
    }),

  pollTask: (id, intervalMs = 1500) => {
    if (!id) {
      log.warn("pollTask called without task id");
      return () => {};
    }
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;
    const MAX_FAILURES = 8;

    const tick = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get<Task>(`/tasks/${id}/status`);
        consecutiveFailures = 0;
        get().updateTask(id, data);
        if (data.status === "success" || data.status === "failed") return;
      } catch (err) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_FAILURES) {
          log.warn(`Polling task ${id} failed ${MAX_FAILURES} times, giving up`, err);
          get().updateTask(id, { status: "failed", error_message: "Lost connection to server" });
          return;
        }
      }
      if (!cancelled) {
        // Exponential-ish backoff on failure; steady cadence on success
        const delay = consecutiveFailures > 0 ? Math.min(intervalMs * 2 ** consecutiveFailures, 15000) : intervalMs;
        timeout = setTimeout(tick, delay);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  },

  pollBatch: (batchId, onUpdate, intervalMs = 2000) => {
    if (!batchId) {
      log.warn("pollBatch called without batch id");
      return () => {};
    }
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let consecutiveFailures = 0;
    const MAX_FAILURES = 8;

    const tick = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get<BatchStatus>(`/tasks/batch/${batchId}/status`);
        consecutiveFailures = 0;
        onUpdate(data);
        data.tasks.forEach((task) => get().updateTask(task.id, task));
        if (data.completed + data.failed === data.total) return;
      } catch (err) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_FAILURES) {
          log.warn(`Batch poll ${batchId} giving up after ${MAX_FAILURES} failures`, err);
          return;
        }
      }
      if (!cancelled) {
        const delay = consecutiveFailures > 0 ? Math.min(intervalMs * 2 ** consecutiveFailures, 20000) : intervalMs;
        timeout = setTimeout(tick, delay);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  },

  loadHistory: async (page = 1) => {
    const { data } = await api.get<{ items: Task[] }>(`/tasks/history`, { params: { page } });
    const items = Array.isArray(data?.items) ? data.items : [];
    set({ history: items, historyLoaded: true });
  },

  reset: () => set({ active: {}, history: [], historyLoaded: false }),
}));
