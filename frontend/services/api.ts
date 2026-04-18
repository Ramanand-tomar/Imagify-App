import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/authStore";

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export const api: AxiosInstance = axios.create({
  baseURL,
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

let refreshingPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clearTokens } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const response = await axios.post(`${baseURL}/auth/refresh`, { refresh_token: refreshToken });
    const newAccess: string = response.data.access_token;
    setTokens({ accessToken: newAccess, refreshToken });
    return newAccess;
  } catch {
    clearTokens();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshingPromise = refreshingPromise ?? refreshAccessToken();
      const newToken = await refreshingPromise;
      refreshingPromise = null;

      if (newToken) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
    }
    return Promise.reject(error);
  }
);

export type UploadProgressFn = (percent: number) => void;

export async function uploadMultipart<T = unknown>(
  path: string,
  file: { uri: string; name: string; mimeType: string },
  extraFields: Record<string, string> = {},
  onProgress?: UploadProgressFn
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
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(Math.min(100, Math.max(0, pct)));
      }
    },
  });
  return response.data;
}

/**
 * Pings the server /health endpoint to handle cold starts on Render.
 */
export async function pingServer(): Promise<boolean> {
  try {
    const start = Date.now();
    await axios.get(`${baseURL}/health`, { timeout: 10000 });
    const duration = Date.now() - start;
    // Return true if it responded reasonably fast, 
    // though we mostly care if it responds at all.
    return duration < 3000;
  } catch {
    return false;
  }
}
