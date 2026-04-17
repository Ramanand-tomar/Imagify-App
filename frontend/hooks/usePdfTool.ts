import { useCallback, useEffect, useRef, useState } from "react";

import { api, uploadMultipart } from "@/services/api";
import { useTaskStore, type Task } from "@/stores/taskStore";

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ToolResult {
  task_id: string;
  download_url: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
}

interface EnqueuedResponse {
  task_id: string;
  status: "pending";
}

interface UsePdfToolArgs {
  endpoint: string;
  /** true for compress / to-jpg which return a task_id and complete in a worker */
  asyncTask: boolean;
}

interface UsePdfToolState {
  phase: "idle" | "uploading" | "processing" | "success" | "error";
  progress: number;
  uploadPercent: number;
  error: string | null;
  result: ToolResult | null;
  activeTask: Task | null;

  submit: (files: PickedFile[], extra: Record<string, string>) => Promise<void>;
  reset: () => void;
}

function isEnqueued(data: unknown): data is EnqueuedResponse {
  return !!data && typeof data === "object" && "status" in data && (data as { status: string }).status === "pending";
}

export function usePdfTool({ endpoint, asyncTask }: UsePdfToolArgs): UsePdfToolState {
  const [phase, setPhase] = useState<UsePdfToolState["phase"]>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const cancelPollRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    cancelPollRef.current?.();
    cancelPollRef.current = null;
    setPhase("idle");
    setUploadPercent(0);
    setProgress(0);
    setError(null);
    setResult(null);
    setActiveTask(null);
  }, []);

  useEffect(() => () => cancelPollRef.current?.(), []);

  const submit = useCallback<UsePdfToolState["submit"]>(
    async (files, extra) => {
      if (files.length === 0) {
        setError("Select at least one file");
        return;
      }
      reset();
      setPhase("uploading");

      try {
        let data: ToolResult | EnqueuedResponse;

        if (files.length === 1) {
          data = await uploadMultipart<ToolResult | EnqueuedResponse>(
            endpoint,
            files[0],
            extra,
            (p) => setUploadPercent(p),
          );
        } else {
          const form = new FormData();
          files.forEach((f) =>
            form.append("files", { uri: f.uri, name: f.name, type: f.mimeType } as unknown as Blob),
          );
          for (const [k, v] of Object.entries(extra)) form.append(k, v);
          const response = await api.post(endpoint, form, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (e) => {
              if (e.total) setUploadPercent(Math.round((e.loaded / e.total) * 100));
            },
          });
          data = response.data;
        }

        if (isEnqueued(data) || asyncTask) {
          const taskId = (data as EnqueuedResponse).task_id;
          setPhase("processing");
          const pollCancel = useTaskStore.getState().pollTask(taskId, 1500);
          cancelPollRef.current = pollCancel;

          const unsub = useTaskStore.subscribe((state) => {
            const task = state.active[taskId];
            if (!task) return;
            setActiveTask(task);
            setProgress(task.progress);
            if (task.status === "success") {
              unsub();
              pollCancel();
              api.get<ToolResult>(`/tasks/${taskId}/result`).then(
                (r) => {
                  setResult(r.data);
                  setPhase("success");
                },
                (err) => {
                  setError(err?.response?.data?.detail ?? "Failed to fetch result");
                  setPhase("error");
                },
              );
            } else if (task.status === "failed") {
              unsub();
              pollCancel();
              setError(task.error_message ?? "Task failed");
              setPhase("error");
            }
          });
        } else {
          setResult(data as ToolResult);
          setPhase("success");
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (err as Error)?.message ??
          "Upload failed";
        setError(message);
        setPhase("error");
      }
    },
    [endpoint, asyncTask, reset],
  );

  return { phase, progress, uploadPercent, error, result, activeTask, submit, reset };
}
