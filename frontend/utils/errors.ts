import axios from "axios";

interface ApiErrorShape {
  code?: string;
  response?: {
    status?: number;
    data?: {
      detail?: string | { msg?: string }[];
      message?: string;
    };
  };
  request?: unknown;
  message?: string;
}

/**
 * Turn any thrown value (axios error, fetch error, native Error, string) into
 * a short human-readable message. Always returns a non-empty string.
 */
export function extractErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;

  const e = err as ApiErrorShape;

  // Network / timeout / aborted (no response)
  if (e.code === "ECONNABORTED") return "Request timed out. Please try again.";
  if (e.code === "ERR_CANCELED") return "Request was cancelled.";
  if (e.code === "ERR_NETWORK" || (!e.response && e.request)) {
    return "Can't reach the server. Check your internet connection.";
  }

  // Structured server error bodies
  const detail = e.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  const message = e.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;

  // Status-code specific defaults
  const status = e.response?.status;
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find that. It may have been removed.";
  if (status === 409) return "That conflicts with existing data.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 415) return "That file type isn't supported.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status === 503) return "Server is waking up — please try again in a few seconds.";
  if (typeof status === "number" && status >= 500) return "Server error. Please try again shortly.";

  // Native Error
  if (typeof e.message === "string" && e.message.trim()) return e.message;
  return fallback;
}

export function isAuthError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return err.response?.status === 401 || err.response?.status === 403;
  }
  const e = err as ApiErrorShape;
  return e.response?.status === 401 || e.response?.status === 403;
}

export function isNetworkError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    if (err.code === "ERR_CANCELED") return false;
    return !err.response;
  }
  const e = err as ApiErrorShape;
  return !e.response && !!e.request;
}

/** 503 from render.com / Cloud Run cold starts, or 504 gateway timeout. */
export function isColdStartError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    return status === 503 || status === 504 || err.code === "ECONNABORTED";
  }
  return false;
}
