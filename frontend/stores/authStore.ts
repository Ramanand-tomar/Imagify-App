import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { create } from "zustand";

import { API_BASE_URL } from "@/utils/env";
import { createLogger } from "@/utils/logger";

const log = createLogger("auth");

const ACCESS_KEY = "imagify.access_token";
const REFRESH_KEY = "imagify.refresh_token";
const USER_KEY = "imagify.user";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user?: AuthUser;
}

function isAuthResponse(data: unknown): data is AuthResponse {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return typeof d.access_token === "string"
    && d.access_token.length > 0
    && typeof d.refresh_token === "string"
    && d.refresh_token.length > 0;
}

function parseStoredUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && typeof parsed.email === "string") return parsed;
    return null;
  } catch (err) {
    log.warn("Failed to parse stored user", err);
    return null;
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  isAuthenticated: () => boolean;

  hydrate: () => Promise<void>;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
  setUser: (user: AuthUser | null) => Promise<void>;
  clearTokens: () => Promise<void>;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { full_name?: string; password?: string; current_password?: string }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  isAuthenticated: () => Boolean(get().accessToken),

  hydrate: async () => {
    try {
      const [access, refresh, userJson] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      set({
        accessToken: access,
        refreshToken: refresh,
        user: parseStoredUser(userJson),
        hydrated: true,
      });
    } catch (err) {
      log.warn("SecureStore hydrate failed", err);
      set({ hydrated: true });
    }
  },

  setTokens: async ({ accessToken, refreshToken }) => {
    if (!accessToken || !refreshToken) {
      throw new Error("Cannot persist empty tokens");
    }
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
    ]);
    set({ accessToken, refreshToken });
  },

  setUser: async (user) => {
    if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    else await SecureStore.deleteItemAsync(USER_KEY);
    set({ user });
  },

  clearTokens: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, user: null });
  },

  login: async (email, password) => {
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { email, password },
      { timeout: 20000 },
    );
    if (!isAuthResponse(response.data)) {
      throw new Error("Unexpected login response from server");
    }
    const { access_token, refresh_token, user } = response.data;
    await get().setTokens({ accessToken: access_token, refreshToken: refresh_token });
    await get().setUser(user ?? { id: "", email });
  },

  register: async (email, password) => {
    const response = await axios.post(
      `${API_BASE_URL}/auth/register`,
      { email, password },
      { timeout: 20000 },
    );
    if (!isAuthResponse(response.data)) {
      throw new Error("Unexpected register response from server");
    }
    const { access_token, refresh_token, user } = response.data;
    await get().setTokens({ accessToken: access_token, refreshToken: refresh_token });
    await get().setUser(user ?? { id: "", email });
  },

  logout: async () => {
    await get().clearTokens();
  },

  updateProfile: async (data) => {
    const token = get().accessToken;
    if (!token) throw new Error("Not authenticated");

    const response = await axios.patch(`${API_BASE_URL}/users/me`, data, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });

    const updated = response.data as AuthUser | undefined;
    if (!updated || typeof updated.email !== "string") {
      throw new Error("Unexpected profile response from server");
    }
    await get().setUser(updated);
  },
}));
