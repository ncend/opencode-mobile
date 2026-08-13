import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { Appearance } from "react-native"
import { type Category, defaultPreferences } from "../lib/notifications"
import { clampPageSize, mergeStoredSettings } from "../lib/settings-merge"
import { setAppLocale } from "../lib/i18n/config"
import type { LocalePreference } from "../lib/i18n/locale-resolve"
import type { AccentName } from "../lib/accents"

const SETTINGS_KEY = "opencode_settings"

export type ThemePreference = "system" | "light" | "dark"

/** Message font size as a percentage of the base size (100 = 100%). Slider range. */
export const FONT_SCALE_MIN = 50
export const FONT_SCALE_MAX = 150

/** Force the app-wide color scheme, or follow the system when preference is "system". */
export function applyAppTheme(preference: ThemePreference): void {
  Appearance.setColorScheme(preference === "system" ? null : preference)
}

interface Settings {
  pageSize: number
  notifications: Record<Category, boolean>
  locale: LocalePreference
  theme: ThemePreference
  accent: AccentName
  /** Message font size as a percentage of the base size (e.g. 120 = 120%). */
  fontSize: number
}

const DEFAULTS: Settings = {
  pageSize: 25,
  notifications: { ...defaultPreferences },
  locale: "system",
  theme: "system",
  accent: "violet",
  fontSize: 100,
}

interface SettingsState extends Settings {
  loaded: boolean
  load: () => Promise<void>
  setPageSize: (size: number) => Promise<void>
  setNotification: (category: Category, enabled: boolean) => Promise<void>
  setLocale: (locale: LocalePreference) => Promise<void>
  setTheme: (theme: ThemePreference) => Promise<void>
  setAccent: (accent: AccentName) => Promise<void>
  setFontSize: (percent: number) => Promise<void>
}

function snapshot(get: () => SettingsState): Settings {
  return {
    pageSize: get().pageSize,
    notifications: get().notifications,
    locale: get().locale,
    theme: get().theme,
    accent: get().accent,
    fontSize: get().fontSize,
  }
}

async function persist(settings: Settings) {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings))
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      // Merge stored settings with defaults so new fields/categories get their default
      const merged = mergeStoredSettings(DEFAULTS, parsed)
      set({ ...merged, loaded: true })
      setAppLocale(merged.locale)
      applyAppTheme(merged.theme)
      return
    }
    set({ loaded: true })
  },

  setPageSize: async (size) => {
    const clamped = clampPageSize(size)
    set({ pageSize: clamped })
    await persist({ ...snapshot(get), pageSize: clamped })
  },

  setNotification: async (category, enabled) => {
    const notifications = { ...get().notifications, [category]: enabled }
    set({ notifications })
    await persist({ ...snapshot(get), notifications })
  },

  setLocale: async (locale) => {
    set({ locale })
    setAppLocale(locale) // applies immediately
    await persist({ ...snapshot(get), locale })
  },

  setTheme: async (theme) => {
    set({ theme })
    applyAppTheme(theme) // applies immediately, re-renders via useColorScheme
    await persist({ ...snapshot(get), theme })
  },

  setAccent: async (accent) => {
    set({ accent }) // re-renders via useAccent
    await persist({ ...snapshot(get), accent })
  },

  setFontSize: async (percent) => {
    const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(percent)))
    set({ fontSize: clamped }) // re-renders message/markdown fonts
    await persist({ ...snapshot(get), fontSize: clamped })
  },
}))
