import { useCallback, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  useColorScheme,
  Linking,
  Alert,
  Modal,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useAuth } from "../../src/stores/auth"
import { useSettings, type ThemePreference } from "../../src/stores/settings"
import { ACCENTS, useAccent, type AccentName } from "../../src/lib/accents"
import {
  categories,
  categoryMeta,
  setup as setupNotifications,
  granted as notificationsGranted,
} from "../../src/lib/notifications"
import type { Category } from "../../src/lib/notifications"
import { hasTelemetryConsent, setTelemetryConsent } from "../../src/lib/telemetry"
import { PRIVACY_POLICY_URL } from "../../src/lib/links"
import type { LocalePreference } from "../../src/lib/i18n/locale-resolve"

function SettingRow({
  icon,
  label,
  description,
  isDark,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  description?: string
  isDark: boolean
  right?: React.ReactNode
  onPress?: () => void
}) {
  const content = (
    <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
      <View style={[styles.settingIcon, isDark && styles.settingIconDark]}>
        <Ionicons name={icon} size={22} color={isDark ? "#ffffff" : "#0a0a0a"} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, isDark && styles.textDark]}>{label}</Text>
        {description && <Text style={[styles.settingDescription, isDark && styles.metaDark]}>{description}</Text>}
      </View>
      {right}
    </View>
  )

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>
  }

  return content
}

function SettingSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>{title}</Text>
      <View style={[styles.sectionContent, isDark && styles.sectionContentDark]}>{children}</View>
    </View>
  )
}

interface Option {
  value: string
  label: string
  /** Optional swatch color rendered next to the label (e.g. accent preview). */
  swatch?: string
}

// Dropdown-style picker sheet. Replaces the Android Alert (which truncates
// when there are 3+ choices + cancel) with a scrollable list that shows every
// option, the current selection checkmarked, plus preview swatches for accents.
function OptionSheet({
  visible,
  title,
  options,
  selected,
  isDark,
  onSelect,
  onClose,
}: {
  visible: boolean
  title: string
  options: Option[]
  selected: string
  isDark: boolean
  onSelect: (value: string) => void
  onClose: () => void
}) {
  const { cur } = useAccent()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.sheet, isDark && styles.sheetDark]}>
          <Text style={[styles.sheetTitle, isDark && styles.textDark]}>{title}</Text>
          <View style={[styles.sheetBody, isDark && styles.sheetBodyDark]}>
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === selected
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.sheetOption, isDark && styles.sheetOptionDark]}
                    onPress={() => {
                      onSelect(option.value)
                      onClose()
                    }}
                    testID={`option-${option.value}`}
                  >
                    {option.swatch && <View style={[styles.optionSwatch, { backgroundColor: option.swatch }]} />}
                    <Text
                      style={[
                        styles.sheetOptionText,
                        isDark && styles.textDark,
                        isSelected && { color: cur.accent },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={cur.accent} />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { settings, hasBiometrics, updateSettings, lock } = useAuth()
  const { notifications, setNotification, locale, setLocale, theme, setTheme, accent, setAccent } = useSettings()
  const [osGranted, setOsGranted] = useState<boolean | null>(null)
  const [telemetryUpdating, setTelemetryUpdating] = useState(false)
  // Which picker sheet is open: theme | accent | null
  const [picker, setPicker] = useState<"theme" | "accent" | "language" | null>(null)

  // Telemetry consent: hasTelemetryConsent() returns null (unknown), true, or false.
  // We initialise local state from in-memory value; updates call setTelemetryConsent().
  const [crashReporting, setCrashReporting] = useState<boolean>(hasTelemetryConsent() ?? false)

  const handleCrashReportingToggle = useCallback(
    async (value: boolean) => {
      setTelemetryUpdating(true)
      try {
        await setTelemetryConsent(value)
        setCrashReporting(value)
      } catch {
        setCrashReporting(hasTelemetryConsent() ?? false)
        Alert.alert(t("settings.alerts.privacyNotSavedTitle"), t("settings.alerts.privacyNotSavedMessage"))
      } finally {
        setTelemetryUpdating(false)
      }
    },
    [t],
  )

  // Check OS permission state on first toggle attempt
  const handleToggle = useCallback(
    async (category: Category, enabled: boolean) => {
      if (enabled) {
        const ok = await setupNotifications()
        setOsGranted(ok)
        if (!ok) {
          Alert.alert(t("settings.alerts.notificationsDisabledTitle"), t("settings.alerts.notificationsDisabledMessage"))
          return
        }
      }
      setNotification(category, enabled)
    },
    [setNotification, t],
  )

  // Lazy-check OS permission for status display
  if (osGranted === null) {
    notificationsGranted()
      .then(setOsGranted)
      .catch(() => setOsGranted(false))
  }

  const localeLabels: Record<LocalePreference, string> = {
    system: t("settings.language.system"),
    en: t("settings.language.en"),
    "zh-Hans": t("settings.language.zhHans"),
  }

  const localeOptions: Option[] = (["system", "en", "zh-Hans"] as LocalePreference[]).map((value) => ({
    value,
    label: localeLabels[value],
  }))

  const themeLabels: Record<ThemePreference, string> = {
    system: t("settings.theme.system"),
    light: t("settings.theme.light"),
    dark: t("settings.theme.dark"),
  }

  const themeOptions: Option[] = (["system", "light", "dark"] as ThemePreference[]).map((value) => ({
    value,
    label: themeLabels[value],
  }))

  const accentLabels: Record<AccentName, string> = {
    violet: t("settings.accent.violet"),
    blue: t("settings.accent.blue"),
    green: t("settings.accent.green"),
    orange: t("settings.accent.orange"),
  }

  const accentOptions: Option[] = (Object.keys(ACCENTS) as AccentName[]).map((value) => ({
    value,
    label: accentLabels[value],
    swatch: ACCENTS[value].dark.accent,
  }))

  const handleLanguagePress = useCallback(() => {
    setPicker("language")
  }, [])

  const handleThemePress = useCallback(() => {
    setPicker("theme")
  }, [])

  const handleAccentPress = useCallback(() => {
    setPicker("accent")
  }, [])

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} contentContainerStyle={styles.content}>
      <SettingSection title={t("settings.sections.security")} isDark={isDark}>
        <SettingRow
          icon="finger-print"
          label={t("settings.security.biometricOpen.label")}
          description={
            hasBiometrics
              ? t("settings.security.biometricOpen.descriptionEnabled")
              : t("settings.security.biometricOpen.descriptionUnavailable")
          }
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometric}
              onValueChange={(value) => updateSettings({ requireBiometric: value })}
              disabled={!hasBiometrics}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          }
        />
        <SettingRow
          icon="lock-closed"
          label={t("settings.security.biometricSend.label")}
          description={t("settings.security.biometricSend.description")}
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometricForMessages}
              onValueChange={(value) => updateSettings({ requireBiometricForMessages: value })}
              disabled={!hasBiometrics || !settings.requireBiometric}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          }
        />
        {settings.requireBiometric && (
          <SettingRow
            icon="exit"
            label={t("settings.security.lockNow.label")}
            description={t("settings.security.lockNow.description")}
            isDark={isDark}
            onPress={lock}
            right={<Ionicons name="chevron-forward" size={20} color={isDark ? "#666666" : "#999999"} />}
          />
        )}
      </SettingSection>

      <SettingSection title={t("settings.sections.notifications")} isDark={isDark}>
        {categories.map((category) => {
          const meta = categoryMeta[category]
          return (
            <SettingRow
              key={category}
              icon={meta.icon as keyof typeof Ionicons.glyphMap}
              label={t(meta.labelKey)}
              description={t(meta.descriptionKey)}
              isDark={isDark}
              right={
                <Switch
                  value={notifications[category]}
                  onValueChange={(value) => handleToggle(category, value)}
                  trackColor={{ false: "#767577", true: "#22c55e" }}
                />
              }
            />
          )
        })}
        {osGranted === false && (
          <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
            <Text style={[styles.settingDescription, { color: "#ef4444", paddingLeft: 48 }]}>
              {t("settings.notifications.disabledNotice")}
            </Text>
          </View>
        )}
      </SettingSection>

      <SettingSection title={t("settings.sections.privacy")} isDark={isDark}>
        <SettingRow
          icon="shield-checkmark"
          label={t("settings.privacy.crashReporting.label")}
          description={t("settings.privacy.crashReporting.description")}
          isDark={isDark}
          right={
            <Switch
              value={crashReporting}
              onValueChange={handleCrashReportingToggle}
              disabled={telemetryUpdating}
              trackColor={{ false: "#767577", true: "#22c55e" }}
            />
          }
        />
        <SettingRow
          icon="document-text"
          label={t("settings.privacy.privacyPolicy.label")}
          description={t("settings.privacy.privacyPolicy.description")}
          isDark={isDark}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          right={<Ionicons name="open-outline" size={20} color={isDark ? "#666666" : "#999999"} />}
        />
      </SettingSection>

      <SettingSection title={t("settings.sections.about")} isDark={isDark}>
        <SettingRow
          icon="contrast"
          label={t("settings.theme.label")}
          description={themeLabels[theme]}
          isDark={isDark}
          onPress={handleThemePress}
          right={<Ionicons name="chevron-forward" size={20} color={isDark ? "#666666" : "#999999"} />}
        />
        <SettingRow
          icon="color-palette"
          label={t("settings.accent.label")}
          description={accentLabels[accent]}
          isDark={isDark}
          onPress={handleAccentPress}
          right={<Ionicons name="chevron-forward" size={20} color={isDark ? "#666666" : "#999999"} />}
        />
        <SettingRow
          icon="language"
          label={t("settings.language.label")}
          description={localeLabels[locale]}
          isDark={isDark}
          onPress={handleLanguagePress}
          right={<Ionicons name="chevron-forward" size={20} color={isDark ? "#666666" : "#999999"} />}
        />
        <SettingRow icon="information-circle" label={t("settings.about.version")} description="1.0.0" isDark={isDark} />
        <SettingRow
          icon="logo-github"
          label={t("settings.about.github.label")}
          description={t("settings.about.github.description")}
          isDark={isDark}
          onPress={() => Linking.openURL("https://github.com/anomalyco/opencode")}
          right={<Ionicons name="open-outline" size={20} color={isDark ? "#666666" : "#999999"} />}
        />
        <SettingRow
          icon="document-text"
          label={t("settings.about.docs.label")}
          description={t("settings.about.docs.description")}
          isDark={isDark}
          onPress={() => Linking.openURL("https://opencode.ai/docs")}
          right={<Ionicons name="open-outline" size={20} color={isDark ? "#666666" : "#999999"} />}
        />
      </SettingSection>

      <View style={styles.footer}>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>{t("settings.footer.appName")}</Text>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>{t("settings.footer.tagline")}</Text>
      </View>

      <OptionSheet
        visible={picker === "theme"}
        title={t("settings.theme.title")}
        options={themeOptions}
        selected={theme}
        isDark={isDark}
        onSelect={(value) => setTheme(value as ThemePreference)}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        visible={picker === "accent"}
        title={t("settings.accent.title")}
        options={accentOptions}
        selected={accent}
        isDark={isDark}
        onSelect={(value) => setAccent(value as AccentName)}
        onClose={() => setPicker(null)}
      />
      <OptionSheet
        visible={picker === "language"}
        title={t("settings.language.title")}
        options={localeOptions}
        selected={locale}
        isDark={isDark}
        onSelect={(value) => setLocale(value as LocalePreference)}
        onClose={() => setPicker(null)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  containerDark: {
    backgroundColor: "#0a0a0a",
  },
  content: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
    marginLeft: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionTitleDark: {
    color: "#888888",
  },
  sectionContent: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e5e5",
  },
  sectionContentDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  settingRowDark: {
    borderBottomColor: "#2a2a2a",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingIconDark: {
    backgroundColor: "#2a2a2a",
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: "#0a0a0a",
  },
  textDark: {
    color: "#ffffff",
  },
  settingDescription: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  metaDark: {
    color: "#888888",
  },
  footer: {
    alignItems: "center",
    padding: 32,
  },
  footerText: {
    fontSize: 13,
    color: "#999999",
    textAlign: "center",
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingBottom: 12,
    paddingTop: 12,
    width: "100%",
    maxWidth: 420,
    maxHeight: "70%",
  },
  sheetDark: {
    backgroundColor: "#1a1a1a",
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0a0a0a",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sheetBody: {
    paddingHorizontal: 16,
  },
  sheetBodyDark: {},
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sheetOptionDark: {
    borderBottomColor: "#2a2a2a",
  },
  sheetOptionText: {
    flex: 1,
    fontSize: 16,
    color: "#0a0a0a",
  },
  optionSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 12,
  },
})
