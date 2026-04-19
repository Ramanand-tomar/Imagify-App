import { useCallback, useEffect, useRef, useState } from "react";

import { api, uploadMultipart } from "@/services/api";
import type { PickedFile } from "@/hooks/usePdfTool";
import { extractErrorMessage } from "@/utils/errors";

export type EnhanceOp = "clahe" | "contrast" | "sharpen" | "denoise" | "edges" | "denoise-ai" | "deblur" | "homomorphic";

interface SessionResponse {
  session_id: string;
  width: number;
  height: number;
  preview_base64: string;
}

interface PreviewResponse {
  preview_base64: string;
  mime_type: string;
}

export interface ImageResult {
  task_id: string;
  download_url: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
}

interface UseImageSessionState {
  sessionId: string | null;
  originalUri: string | null;
  previewUri: string | null;
  width: number;
  height: number;

  uploading: boolean;
  previewing: boolean;
  applying: boolean;
  error: string | null;
  result: ImageResult | null;

  upload: (file: PickedFile) => Promise<void>;
  requestPreview: (op: EnhanceOp, params: Record<string, unknown>) => void;
  apply: (op: EnhanceOp, params: Record<string, unknown>) => Promise<void>;
  /** Used by async (AI) flows to inject a completed result back into the session UI. */
  applyExternalResult: (r: {
    download_url: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
    width?: number;
    height?: number;
  }) => void;
  reset: () => void;
}

const DEBOUNCE_MS = 500;

export function useImageSession(): UseImageSessionState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageResult | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPreviewRef = useRef(0);
  const mountedRef = useRef(true);
  const previewAbortRef = useRef<AbortController | null>(null);
  const applyAbortRef = useRef<AbortController | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      previewAbortRef.current?.abort();
      applyAbortRef.current?.abort();
      uploadAbortRef.current?.abort();
    };
  }, []);

  const upload = useCallback<UseImageSessionState["upload"]>(async (file) => {
    if (!mountedRef.current) return;
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const data = await uploadMultipart<SessionResponse>("/image/session", file, {}, undefined, controller.signal);
      if (!mountedRef.current) return;
      if (!data?.session_id || !data.preview_base64) {
        throw new Error("Unexpected session response from server");
      }
      setSessionId(data.session_id);
      setWidth(data.width);
      setHeight(data.height);
      const uri = `data:image/jpeg;base64,${data.preview_base64}`;
      setOriginalUri(uri);
      setPreviewUri(uri);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(extractErrorMessage(err, "Upload failed"));
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, []);

  const requestPreview = useCallback<UseImageSessionState["requestPreview"]>(
    (op, params) => {
      if (!sessionId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const token = ++latestPreviewRef.current;

      debounceRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        previewAbortRef.current?.abort();
        const controller = new AbortController();
        previewAbortRef.current = controller;

        setPreviewing(true);
        try {
          const { data } = await api.post<PreviewResponse>(
            "/image/enhance/preview",
            { session_id: sessionId, operation: op, params },
            { signal: controller.signal, timeout: 60000 },
          );
          if (!mountedRef.current) return;
          if (token === latestPreviewRef.current && data?.preview_base64) {
            setPreviewUri(`data:${data.mime_type};base64,${data.preview_base64}`);
          }
        } catch (err: unknown) {
          if (!mountedRef.current) return;
          if (token === latestPreviewRef.current) {
            setError(extractErrorMessage(err, "Preview failed"));
          }
        } finally {
          if (mountedRef.current && token === latestPreviewRef.current) {
            setPreviewing(false);
          }
        }
      }, DEBOUNCE_MS);
    },
    [sessionId],
  );

  const apply = useCallback<UseImageSessionState["apply"]>(
    async (op, params) => {
      if (!sessionId || !mountedRef.current) return;
      applyAbortRef.current?.abort();
      const controller = new AbortController();
      applyAbortRef.current = controller;

      setError(null);
      setApplying(true);
      try {
        const { data } = await api.post<ImageResult>(
          "/image/enhance/apply",
          { session_id: sessionId, operation: op, params },
          { signal: controller.signal, timeout: 120000 },
        );
        if (!mountedRef.current) return;
        if (!data?.download_url) {
          throw new Error("Unexpected response from server");
        }
        setResult(data);
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        setError(extractErrorMessage(err, "Apply failed"));
      } finally {
        if (mountedRef.current) setApplying(false);
      }
    },
    [sessionId],
  );

  const applyExternalResult = useCallback<UseImageSessionState["applyExternalResult"]>((r) => {
    if (!mountedRef.current) return;
    setResult({
      task_id: "",
      download_url: r.download_url,
      original_filename: r.original_filename,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      width: r.width ?? 0,
      height: r.height ?? 0,
    });
    setPreviewUri(r.download_url);
  }, []);

  const reset = useCallback(() => {
    previewAbortRef.current?.abort();
    applyAbortRef.current?.abort();
    uploadAbortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!mountedRef.current) return;
    setSessionId(null);
    setOriginalUri(null);
    setPreviewUri(null);
    setWidth(0);
    setHeight(0);
    setError(null);
    setResult(null);
  }, []);

  return {
    sessionId,
    originalUri,
    previewUri,
    width,
    height,
    uploading,
    previewing,
    applying,
    error,
    result,
    upload,
    requestPreview,
    apply,
    applyExternalResult,
    reset,
  };
}
