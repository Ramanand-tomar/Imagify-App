import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { create } from "zustand";

const ACCESS_KEY = "imagify.access_token";
const REFRESH_KEY = "imagify.refresh_token";
const USER_KEY = "imagify.user";

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
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
    const [access, refresh, userJson] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    set({
      accessToken: access,
      refreshToken: refresh,
      user: userJson ? (JSON.parse(userJson) as AuthUser) : null,
      hydrated: true,
    });
  },

  setTokens: async ({ accessToken, refreshToken }) => {
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
    const response = await axios.post(`${baseURL}/auth/login`, { email, password });
    const { access_token, refresh_token, user } = response.data as any;
    await get().setTokens({ accessToken: access_token, refreshToken: refresh_token });
    await get().setUser(user || { id: "", email });
  },

  register: async (email, password) => {
    const response = await axios.post(`${baseURL}/auth/register`, { email, password });
    const { access_token, refresh_token, user } = response.data as any;
    await get().setTokens({ accessToken: access_token, refreshToken: refresh_token });
    await get().setUser(user || { id: "", email });
  },

  logout: async () => {
    await get().clearTokens();
  },

  updateProfile: async (data) => {
    const token = get().accessToken;
    if (!token) throw new Error("Not authenticated");
    
    const response = await axios.patch(`${baseURL}/users/me`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    await get().setUser(response.data as AuthUser);
  },
}));
