import { useCallback, useState } from "react";

import { api, uploadMultipart } from "@/services/api";
import type { PickedFile } from "@/hooks/usePdfTool";

export interface Point {
  x: number;
  y: number;
}

interface ScannerSession {
  session_id: string;
  width: number;
  height: number;
  preview_base64: string;
}

export interface ScannerResult {
  task_id: string;
  download_url: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
}

export interface ScanConfig {
  do_deskew: boolean;
  do_shadow_removal: boolean;
  binarize: "otsu" | "adaptive" | "none";
  export_as: "image" | "pdf";
}

interface UseScannerState {
  sessionId: string | null;
  sourceUri: string | null;          // data URI for "before" display
  sourceWidth: number;
  sourceHeight: number;
  corners: Point[];                  // TL, TR, BR, BL in SOURCE pixel coordinates
  previewUri: string | null;
  uploading: boolean;
  detecting: boolean;
  processing: boolean;
  error: string | null;
  result: ScannerResult | null;

  upload: (file: PickedFile) => Promise<void>;
  setCorners: (c: Point[]) => void;
  detectEdges: () => Promise<void>;
  previewPerspective: () => Promise<void>;
  process: (config: ScanConfig) => Promise<void>;
  reset: () => void;
}

export function useScanner(): UseScannerState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [corners, setCorners] = useState<Point[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScannerResult | null>(null);

  const extractDetail = (e: unknown) =>
    (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
    (e as Error)?.message ??
    "Request failed";

  const upload = useCallback<UseScannerState["upload"]>(async (file) => {
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const data = await uploadMultipart<ScannerSession>("/scanner/session", file);
      setSessionId(data.session_id);
      setSourceWidth(data.width);
      setSourceHeight(data.height);
      setSourceUri(`data:image/jpeg;base64,${data.preview_base64}`);
      setPreviewUri(null);
      setCorners([]);
    } catch (e) {
      setError(extractDetail(e));
    } finally {
      setUploading(false);
    }
  }, []);

  const detectEdges = useCallback<UseScannerState["detectEdges"]>(async () => {
    if (!sessionId) return;
    setDetecting(true);
    try {
      const { data } = await api.post<{ corners: Point[] }>("/scanner/detect-edges", { session_id: sessionId });
      setCorners(data.corners);
    } catch (e) {
      setError(extractDetail(e));
    } finally {
      setDetecting(false);
    }
  }, [sessionId]);

  const previewPerspective = useCallback<UseScannerState["previewPerspective"]>(async () => {
    if (!sessionId || corners.length !== 4) return;
    try {
      const { data } = await api.post<{ preview_base64: string; mime_type: string }>(
        "/scanner/correct-perspective",
        { session_id: sessionId, corners },
      );
      setPreviewUri(`data:${data.mime_type};base64,${data.preview_base64}`);
    } catch (e) {
      setError(extractDetail(e));
    }
  }, [sessionId, corners]);

  const process = useCallback<UseScannerState["process"]>(
    async (config) => {
      if (!sessionId || corners.length !== 4) return;
      setError(null);
      setProcessing(true);
      try {
        const { data } = await api.post<ScannerResult>("/scanner/process", {
          session_id: sessionId,
          corners,
          do_deskew: config.do_deskew,
          do_shadow_removal: config.do_shadow_removal,
          binarize: config.binarize,
          export_as: config.export_as,
        });
        setResult(data);
      } catch (e) {
        setError(extractDetail(e));
      } finally {
        setProcessing(false);
      }
    },
    [sessionId, corners],
  );

  const reset = useCallback(() => {
    setSessionId(null);
    setSourceUri(null);
    setSourceWidth(0);
    setSourceHeight(0);
    setCorners([]);
    setPreviewUri(null);
    setError(null);
    setResult(null);
  }, []);

  return {
    sessionId, sourceUri, sourceWidth, sourceHeight, corners, previewUri,
    uploading, detecting, processing, error, result,
    upload, setCorners, detectEdges, previewPerspective, process, reset,
  };
}
