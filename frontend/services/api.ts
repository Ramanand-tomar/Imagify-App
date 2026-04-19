import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/stores/authStore";
import { API_BASE_URL } from "@/utils/env";
import { createLogger } from "@/utils/logger";

const log = createLogger("api");

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * A shared, in-flight refresh promise ensures concurrent 401s only trigger
 * one refresh call — the rest wait on the same promise.
 */
let refreshingPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clearTokens } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 15000 },
    );
    const newAccess = response.data?.access_token;
    const rotatedRefresh = response.data?.refresh_token ?? refreshToken;
    if (typeof newAccess !== "string" || newAccess.length === 0) {
      await clearTokens();
      return null;
    }
    await setTokens({ accessToken: newAccess, refreshToken: rotatedRefresh });
    return newAccess;
  } catch (err) {
    log.warn("Token refresh failed", err);
    await clearTokens();
    return null;
  }
}

function getOrStartRefresh(): Promise<string | null> {
  if (!refreshingPromise) {
    refreshingPromise = refreshAccessToken().finally(() => {
      refreshingPromise = null;
    });
  }
  return refreshingPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    // Don't try to refresh on auth/refresh endpoints themselves
    const url = original?.url ?? "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh");

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const newToken = await getOrStartRefresh();
      if (newToken) {
        original.headers = { ...(original.headers ?? {}) };
        delete (original.headers as Record<string, unknown>).Authorization;
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);

export type UploadProgressFn = (percent: number) => void;

export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string;
}

export async function uploadMultipart<T = unknown>(
  path: string,
  file: UploadFile,
  extraFields: Record<string, string> = {},
  onProgress?: UploadProgressFn,
  signal?: AbortSignal,
): Promise<T> {
  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  for (const [k, v] of Object.entries(extraFields)) form.append(k, v);

  const response = await api.post<T>(path, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000, // uploads take longer than JSON calls
    signal,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(Math.min(100, Math.max(0, pct)));
      }
    },
  });
  if (response.data === undefined || response.data === null) {
    throw new Error("Empty response from server");
  }
  return response.data;
}

/**
 * Pings /health to warm up the backend (Render cold-start friendly).
 * Always resolves — callers should not await catch blocks.
 */
export async function pingServer(): Promise<boolean> {
  try {
    const start = Date.now();
    await axios.get(`${API_BASE_URL}/health`, { timeout: 10000 });
    return Date.now() - start < 3000;
  } catch {
    return false;
  }
}
