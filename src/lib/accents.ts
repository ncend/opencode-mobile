import { useColorScheme } from "react-native"
import { useSettings } from "../stores/settings"

export type AccentName = "violet" | "blue" | "green" | "orange"

export interface AccentTokens {
  /** Brand accent used for icons, checkmarks, badges, spinners (was `#8b5cf6`). */
  accent: string
  /** Strong accent for links/buttons/active labels (was `#6d28d9` light / `#8b5cf6` dark). */
  primary: string
  /** Soft accent for secondary text (was `#6d28d9` light / `#a78bfa` dark). */
  soft: string
  /** Softer accent for tertiary text (was `#8b5cf6` light / `#c4b5fd` dark). */
  softer: string
  /** Accent-tinted background for selected rows/chips (was `#f5f3ff` / `#2a2040`). */
  tintBg: string
  /** Accent-tinted surface for cards/code/variant chips (was `#e8e5f0` / `#1a1a2e`). */
  tintSurface: string
}

export interface AccentPalette {
  light: AccentTokens
  dark: AccentTokens
}

/** Full accent state returned by useAccent(): both mode palettes + the mode-resolved `cur`. */
export interface AccentState {
  isDark: boolean
  light: AccentTokens
  dark: AccentTokens
  cur: AccentTokens
}

export const ACCENTS: Record<AccentName, AccentPalette> = {
  violet: {
    light: {
      accent: "#8b5cf6",
      primary: "#6d28d9",
      soft: "#6d28d9",
      softer: "#8b5cf6",
      tintBg: "#f5f3ff",
      tintSurface: "#e8e5f0",
    },
    dark: {
      accent: "#8b5cf6",
      primary: "#8b5cf6",
      soft: "#a78bfa",
      softer: "#c4b5fd",
      tintBg: "#2a2040",
      tintSurface: "#1a1a2e",
    },
  },
  blue: {
    light: {
      accent: "#3b82f6",
      primary: "#1d4ed8",
      soft: "#1d4ed8",
      softer: "#3b82f6",
      tintBg: "#eff6ff",
      tintSurface: "#dbeafe",
    },
    dark: {
      accent: "#60a5fa",
      primary: "#60a5fa",
      soft: "#93c5fd",
      softer: "#bfdbfe",
      tintBg: "#1e293b",
      tintSurface: "#16202f",
    },
  },
  green: {
    light: {
      accent: "#10b981",
      primary: "#047857",
      soft: "#047857",
      softer: "#10b981",
      tintBg: "#ecfdf5",
      tintSurface: "#d1fae5",
    },
    dark: {
      accent: "#34d399",
      primary: "#34d399",
      soft: "#6ee7b7",
      softer: "#a7f3d0",
      tintBg: "#14433a",
      tintSurface: "#0e3028",
    },
  },
  orange: {
    light: {
      accent: "#f97316",
      primary: "#c2410c",
      soft: "#c2410c",
      softer: "#f97316",
      tintBg: "#fff7ed",
      tintSurface: "#ffedd5",
    },
    dark: {
      accent: "#fb923c",
      primary: "#fb923c",
      soft: "#fdba74",
      softer: "#fed7aa",
      tintBg: "#4a2e1a",
      tintSurface: "#33200f",
    },
  },
}

/** Resolved accent palette + current-mode tokens, re-renders when the accent or scheme changes. */
export function useAccent(): AccentState {
  const isDark = useColorScheme() === "dark"
  const accentName = useSettings((s) => s.accent)
  const palette = ACCENTS[accentName] ?? ACCENTS.violet
  return { isDark, light: palette.light, dark: palette.dark, cur: isDark ? palette.dark : palette.light }
}