import { useCallback, useEffect, useRef, useState } from "react";

import { api, uploadMultipart } from "@/services/api";
import type { PickedFile } from "@/hooks/usePdfTool";
import { extractErrorMessage } from "@/utils/errors";

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
  sourceUri: string | null;
  sourceWidth: number;
  sourceHeight: number;
  corners: Point[];
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

function validCorners(corners: Point[], width: number, height: number): boolean {
  if (corners.length !== 4) return false;
  return corners.every(
    (c) => Number.isFinite(c.x) && Number.isFinite(c.y) && c.x >= 0 && c.y >= 0 && c.x <= width && c.y <= height,
  );
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

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const upload = useCallback<UseScannerState["upload"]>(async (file) => {
    if (!mountedRef.current) return;
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const data = await uploadMultipart<ScannerSession>("/scanner/session", file);
      if (!mountedRef.current) return;
      if (!data?.session_id || !data.preview_base64) {
        throw new Error("Unexpected session response from server");
      }
      setSessionId(data.session_id);
      setSourceWidth(data.width);
      setSourceHeight(data.height);
      setSourceUri(`data:image/jpeg;base64,${data.preview_base64}`);
      setPreviewUri(null);
      setCorners([]);
    } catch (e) {
      if (mountedRef.current) setError(extractErrorMessage(e, "Upload failed"));
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }, []);

  const detectEdges = useCallback<UseScannerState["detectEdges"]>(async () => {
    if (!sessionId || !mountedRef.current) return;
    setDetecting(true);
    try {
      const { data } = await api.post<{ corners: Point[] }>(
        "/scanner/detect-edges",
        { session_id: sessionId },
        { timeout: 60000 },
      );
      if (!mountedRef.current) return;
      if (Array.isArray(data?.corners) && data.corners.length === 4) {
        setCorners(data.corners);
      }
    } catch (e) {
      if (mountedRef.current) setError(extractErrorMessage(e, "Edge detection failed"));
    } finally {
      if (mountedRef.current) setDetecting(false);
    }
  }, [sessionId]);

  const previewPerspective = useCallback<UseScannerState["previewPerspective"]>(async () => {
    if (!sessionId || !mountedRef.current) return;
    if (!validCorners(corners, sourceWidth, sourceHeight)) {
      setError("Please place all four corners inside the image");
      return;
    }
    try {
      const { data } = await api.post<{ preview_base64: string; mime_type: string }>(
        "/scanner/correct-perspective",
        { session_id: sessionId, corners },
        { timeout: 60000 },
      );
      if (mountedRef.current && data?.preview_base64) {
        setPreviewUri(`data:${data.mime_type};base64,${data.preview_base64}`);
      }
    } catch (e) {
      if (mountedRef.current) setError(extractErrorMessage(e, "Preview failed"));
    }
  }, [sessionId, corners, sourceWidth, sourceHeight]);

  const process = useCallback<UseScannerState["process"]>(
    async (config) => {
      if (!sessionId || !mountedRef.current) return;
      if (!validCorners(corners, sourceWidth, sourceHeight)) {
        setError("Please place all four corners inside the image");
        return;
      }
      setError(null);
      setProcessing(true);
      try {
        const { data } = await api.post<ScannerResult>(
          "/scanner/process",
          {
            session_id: sessionId,
            corners,
            do_deskew: config.do_deskew,
            do_shadow_removal: config.do_shadow_removal,
            binarize: config.binarize,
            export_as: config.export_as,
          },
          { timeout: 120000 },
        );
        if (!mountedRef.current) return;
        if (!data?.download_url) {
          throw new Error("Unexpected response from server");
        }
        setResult(data);
      } catch (e) {
        if (mountedRef.current) setError(extractErrorMessage(e, "Processing failed"));
      } finally {
        if (mountedRef.current) setProcessing(false);
      }
    },
    [sessionId, corners, sourceWidth, sourceHeight],
  );

  const reset = useCallback(() => {
    if (!mountedRef.current) return;
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
