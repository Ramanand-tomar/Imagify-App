import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { createLogger } from "@/utils/logger";

const log = createLogger("settings");

const STORAGE_KEY = "imagify.settings.v1";

export interface AppSettings {
  hapticsEnabled: boolean;
  /** "system" follows the device, otherwise pin to one. */
  themePreference: "system" | "light" | "dark";
}

const DEFAULTS: AppSettings = {
  hapticsEnabled: true,
  themePreference: "system",
};

interface SettingsState extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        set({
          hapticsEnabled: parsed.hapticsEnabled ?? DEFAULTS.hapticsEnabled,
          themePreference: parsed.themePreference ?? DEFAULTS.themePreference,
        });
      }
    } catch (err) {
      log.warn("hydrate failed", err);
    } finally {
      set({ hydrated: true });
    }
  },

  update: async (patch) => {
    const next: AppSettings = {
      hapticsEnabled: patch.hapticsEnabled ?? get().hapticsEnabled,
      themePreference: patch.themePreference ?? get().themePreference,
    };
    set(next);
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      log.warn("persist failed", err);
    }
  },

  reset: async () => {
    set(DEFAULTS);
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch (err) {
      log.warn("reset failed", err);
    }
  },
}));
