import { useCallback, useEffect, useRef, useState } from "react";

import { api, uploadMultipart } from "@/services/api";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { extractErrorMessage } from "@/utils/errors";

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
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.task_id === "string" && d.task_id.length > 0 && d.status === "pending";
}

export function usePdfTool({ endpoint, asyncTask }: UsePdfToolArgs): UsePdfToolState {
  const [phase, setPhase] = useState<UsePdfToolState["phase"]>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const cancelPollRef = useRef<(() => void) | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelPollRef.current?.();
      cancelPollRef.current = null;
      unsubRef.current?.();
      unsubRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    cancelPollRef.current?.();
    cancelPollRef.current = null;
    unsubRef.current?.();
    unsubRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (!mountedRef.current) return;
    setPhase("idle");
    setUploadPercent(0);
    setProgress(0);
    setError(null);
    setResult(null);
    setActiveTask(null);
  }, []);

  const submit = useCallback<UsePdfToolState["submit"]>(
    async (files, extra) => {
      if (files.length === 0) {
        setError("Select at least one file");
        return;
      }
      reset();
      if (!mountedRef.current) return;
      setPhase("uploading");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let data: ToolResult | EnqueuedResponse;

        if (files.length === 1) {
          data = await uploadMultipart<ToolResult | EnqueuedResponse>(
            endpoint,
            files[0],
            extra,
            (p) => {
              if (mountedRef.current) setUploadPercent(p);
            },
            controller.signal,
          );
        } else {
          const form = new FormData();
          files.forEach((f) =>
            form.append("files", { uri: f.uri, name: f.name, type: f.mimeType } as unknown as Blob),
          );
          for (const [k, v] of Object.entries(extra)) form.append(k, v);
          const response = await api.post(endpoint, form, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120000,
            signal: controller.signal,
            onUploadProgress: (e) => {
              if (!mountedRef.current) return;
              if (e.total) {
                const pct = Math.round((e.loaded / e.total) * 100);
                setUploadPercent(Math.min(100, Math.max(0, pct)));
              }
            },
          });
          if (response.data === undefined || response.data === null) {
            throw new Error("Empty response from server");
          }
          data = response.data;
        }

        if (!mountedRef.current) return;

        if (isEnqueued(data) || asyncTask) {
          const taskId = (data as EnqueuedResponse).task_id;
          if (!taskId) {
            setError("Server did not return a task id");
            setPhase("error");
            return;
          }
          setPhase("processing");
          const pollCancel = useTaskStore.getState().pollTask(taskId, 1500);
          cancelPollRef.current = pollCancel;

          const unsub = useTaskStore.subscribe((state) => {
            if (!mountedRef.current) return;
            const task = state.active[taskId];
            if (!task) return;
            setActiveTask(task);
            setProgress(task.progress ?? 0);
            if (task.status === "success") {
              unsubRef.current?.();
              unsubRef.current = null;
              pollCancel();
              cancelPollRef.current = null;
              api.get<ToolResult>(`/tasks/${taskId}/result`).then(
                (r) => {
                  if (!mountedRef.current) return;
                  setResult(r.data);
                  setPhase("success");
                },
                (err) => {
                  if (!mountedRef.current) return;
                  setError(extractErrorMessage(err, "Failed to fetch result"));
                  setPhase("error");
                },
              );
            } else if (task.status === "failed") {
              unsubRef.current?.();
              unsubRef.current = null;
              pollCancel();
              cancelPollRef.current = null;
              setError(task.error_message ?? "Task failed");
              setPhase("error");
            }
          });
          unsubRef.current = unsub;
        } else {
          setResult(data as ToolResult);
          setPhase("success");
        }
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        setError(extractErrorMessage(err, "Upload failed"));
        setPhase("error");
      }
    },
    [endpoint, asyncTask, reset],
  );

  return { phase, progress, uploadPercent, error, result, activeTask, submit, reset };
}
