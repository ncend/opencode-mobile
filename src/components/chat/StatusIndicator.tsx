import { View, Text, StyleSheet, ActivityIndicator } from "react-native"
import { useTranslation } from "react-i18next"
import { useEvents } from "../../stores/events"
import { useSessions } from "../../stores/sessions"
import { useAccent, type AccentState } from "../../lib/accents"

interface Props {
  sessionID: string
  isDark: boolean
}

export function StatusIndicator({ sessionID, isDark }: Props) {
  const { t } = useTranslation()
  const acc = useAccent()
  const s = makeStyles(acc)
  const status = useEvents((s) => s.sessionStatus[sessionID])
  const text = useEvents((s) => s.statusText[sessionID])
  const optimistic = useSessions((s) => s.sending[sessionID])

  // SSE status is the source of truth. The optimistic `sending` flag only
  // covers the gap between the user tapping send and SSE confirming busy.
  // Once SSE reports idle, the indicator hides regardless of the optimistic flag.
  const sseBusy = status && status.type !== "idle"
  const busy = sseBusy || (optimistic && !status)
  if (!busy) return null

  const label =
    status?.type === "retry" ? t("chat.statusIndicator.retrying", { attempt: status.attempt }) : text || t("chat.statusIndicator.working")

  return (
    <View style={[s.bar, isDark && s.barDark]}>
      <ActivityIndicator size="small" color={acc.cur.accent} />
      <Text style={[s.text, isDark && s.textDark]}>{label}</Text>
    </View>
  )
}

function makeStyles(acc: AccentState) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: acc.light.tintBg,
      borderTopWidth: 1,
      borderTopColor: "#e5e5e5",
    },
    barDark: { backgroundColor: acc.dark.tintSurface, borderTopColor: "#2a2a2a" },
    text: { fontSize: 13, color: acc.light.soft, fontWeight: "500" },
    textDark: { color: acc.dark.soft },
  })
}