import { create } from "zustand";
import { api } from "@/services/api";

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
      if (!existing) return { active: { ...state.active, [id]: { ...patch } as any } }; // fallback for batch tasks not explicitly added
      return { active: { ...state.active, [id]: { ...existing, ...patch } } };
    }),

  pollTask: (id, intervalMs = 1500) => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get<Task>(`/tasks/${id}/status`);
        get().updateTask(id, data);
        if (data.status === "success" || data.status === "failed") return;
      } catch {
        // keep retrying
      }
      if (!cancelled) setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      cancelled = true;
    };
  },

  pollBatch: (batchId, onUpdate, intervalMs = 2000) => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get<BatchStatus>(`/tasks/batch/${batchId}/status`);
        onUpdate(data);
        
        // Update individual tasks in active state for history/consistency
        data.tasks.forEach(task => get().updateTask(task.id, task));
        
        if (data.completed + data.failed === data.total) return;
      } catch (err) {
        console.error("Batch poll failed:", err);
      }
      if (!cancelled) setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      cancelled = true;
    };
  },

  loadHistory: async (page = 1) => {
    const { data } = await api.get<{ items: Task[] }>(`/tasks/history`, { params: { page } });
    set({ history: data.items, historyLoaded: true });
  },

  reset: () => set({ active: {}, history: [], historyLoaded: false }),
}));
