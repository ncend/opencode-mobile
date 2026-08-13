import { useMemo, type ReactNode } from "react"
import { View, Text, useColorScheme, Platform, type StyleProp, type ViewStyle, type TextStyle } from "react-native"
import { useMarkdown, Renderer } from "react-native-marked"
import { CodeBlock } from "./CodeBlock"
import { useAccent, type AccentState } from "../../lib/accents"

// react-native-marked's base Renderer hardcodes `selectable` on every plain
// text node it produces (text/strong/em/del/heading/codespan). On Android,
// selectable <Text> nested inside a FlatList row has a long-standing,
// still-unresolved RN bug (facebook/react-native#46999, a reopened
// regression of #28952's fix) where the underlying view's selectable state
// — and, per our own diff-scroll flow (issue #104), its exposure to the
// accessibility tree Maestro/UiAutomator reads from — never gets applied
// correctly. Chat messages here are rendered as rows of the session screen's
// own FlatList (app/session/[id].tsx), so every markdown text node hits
// this. Code content is still copyable via CodeBlock's explicit Copy
// button, so dropping `selectable` on plain text costs little.
class CustomRenderer extends Renderer {
  // react-native-marked parses sibling inline tokens (bold/italic/etc. inside a
  // paragraph) with an EMPTY style object, so the library's own default
  // emphasis style (fontSize 16/lineHeight 24, hardcoded in its theme
  // flattening) would win over our scaled base text. We therefore provide
  // `strong`/`em`/`strikethrough` theme keys carrying the scaled base text
  // style plus the modifier (see lightTheme) — the library merges those last,
  // so emphasis text scales with the font-size setting like plain text.
  private plainText(children: string | ReactNode[], styles?: StyleProp<TextStyle>): ReactNode {
    return (
      <Text key={this.getKey()} style={styles}>
        {children}
      </Text>
    )
  }

  code(text: string, language?: string, containerStyle?: ViewStyle, _textStyle?: TextStyle) {
    return (
      <View key={this.getKey()} style={containerStyle}>
        <CodeBlock code={text} language={language} />
      </View>
    )
  }

  text(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    return this.plainText(text, styles)
  }

  heading(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    return this.plainText(text, styles)
  }

  codespan(text: string, styles?: TextStyle): ReactNode {
    return this.plainText(text, [styles, { fontStyle: "normal", fontWeight: "normal" }])
  }
}

const mono = Platform.OS === "ios" ? "Menlo" : "monospace"

/** Base message font size the markdown scale is derived from (matches original UI). */
const BASE_SIZE = 15

function scaled(base: number, f: number): number {
  return Math.round(base * f)
}

function lightTheme(acc: AccentState, f: number) {
  const base = { color: "#0a0a0a", fontSize: scaled(BASE_SIZE, f), lineHeight: scaled(22, f) }
  return {
    text: { ...base },
    paragraph: { marginTop: 0, marginBottom: 8 },
    h1: { fontSize: scaled(22, f), fontWeight: "700" as const, color: "#0a0a0a", marginBottom: 8, marginTop: 12 },
    h2: { fontSize: scaled(19, f), fontWeight: "600" as const, color: "#0a0a0a", marginBottom: 6, marginTop: 10 },
    h3: { fontSize: scaled(16, f), fontWeight: "600" as const, color: "#0a0a0a", marginBottom: 4, marginTop: 8 },
    h4: { ...base, fontWeight: "600" as const, marginBottom: 4, marginTop: 6 },
    h5: { ...base, fontWeight: "600" as const, marginBottom: 3, marginTop: 4 },
    h6: { ...base, marginBottom: 3, marginTop: 4 },
    link: { ...base, color: acc.light.accent },
    blockquote: {
      backgroundColor: "transparent",
      borderLeftWidth: 3,
      borderLeftColor: "#d1d5db",
      paddingLeft: 12,
      paddingVertical: 2,
      marginVertical: 4,
    },
    code: {
      backgroundColor: acc.light.tintSurface,
      color: acc.light.primary,
      fontFamily: mono,
      fontSize: scaled(13, f),
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    codespan: {
      backgroundColor: acc.light.tintSurface,
      color: acc.light.primary,
      fontFamily: mono,
      fontSize: scaled(13, f),
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
    },
    list: { marginBottom: 4 },
    li: { ...base, marginBottom: 2 },
    hr: { backgroundColor: "#e5e5e5", height: 1, marginVertical: 12 },
    strong: { ...base, fontWeight: "700" as const },
    em: { ...base, fontStyle: "italic" as const },
    strikethrough: { ...base, textDecorationLine: "line-through" as const },
    image: { borderRadius: 8 },
  }
}

function theme(acc: AccentState, isDark: boolean, f: number) {
  const light = lightTheme(acc, f)
  if (!isDark) return light
  return {
    ...light,
    text: { ...light.text, color: "#e5e5e5" },
    h1: { ...light.h1, color: "#ffffff" },
    h2: { ...light.h2, color: "#ffffff" },
    h3: { ...light.h3, color: "#ffffff" },
    h4: { ...light.h4, color: "#ffffff" },
    h5: { ...light.h5, color: "#ffffff" },
    h6: { ...light.h6, color: "#ffffff" },
    link: { ...light.link, color: acc.dark.soft },
    blockquote: {
      ...light.blockquote,
      borderLeftColor: "#4a4a5a",
    },
    li: { ...light.li, color: "#e5e5e5" },
    code: {
      ...light.code,
      backgroundColor: acc.dark.tintBg,
      color: acc.dark.softer,
    },
    codespan: {
      ...light.codespan,
      backgroundColor: acc.dark.tintBg,
      color: acc.dark.softer,
    },
    strong: { ...light.strong, color: "#e5e5e5" },
    em: { ...light.em, color: "#e5e5e5" },
    strikethrough: { ...light.strikethrough, color: "#e5e5e5" },
    hr: { ...light.hr, backgroundColor: "#2a2a2a" },
  }
}

interface Props {
  children: string
  /** Message body font size in points. Defaults to the original UI size (15). */
  fontSize?: number
}

export function Markdown({ children, fontSize = BASE_SIZE }: Props) {
  const isDark = useColorScheme() === "dark"
  const acc = useAccent()
  const f = fontSize / BASE_SIZE
  const themeStyles = theme(acc, isDark, f)

  // A module-scope singleton renderer would share one CustomRenderer (and
  // its underlying github-slugger) across every Markdown instance and every
  // streamed token forever. github-slugger never resets, so its heading-slug
  // keys only ever climb — which fed into useMarkdown's memoized parser and
  // made the emitted React keys change on every token, remounting the whole
  // subtree (resetting code-block scroll position, flashing content). Scoping
  // the renderer to `children` resets the slugger per parse, so keys are
  // deterministic (and stable) for a given value, while re-renders with an
  // unchanged value stay memoized instead of creating a new renderer.
  const renderer = useMemo(() => new CustomRenderer(), [
    children,
    themeStyles.text?.fontSize,
    themeStyles.text?.color,
    themeStyles.text?.lineHeight,
  ])

  // react-native-marked's default <RNMarkdown> export renders blocks inside a
  // FlatList. Chat messages are rendered inside app/session/[id].tsx's own
  // *inverted* FlatList (each row a MessageBubble) — nesting one
  // VirtualizedList inside another, especially an inverted one, is a known
  // React Native footgun where the inner list's content can fail to lay out
  // (renders zero height) instead of just warning. We already force
  // scrollEnabled: false and a large initialNumToRender here, which defeats
  // virtualization anyway, so there's nothing to lose by rendering the parsed
  // blocks directly with the useMarkdown hook instead (issue #104).
  const elements = useMarkdown(children ?? "", {
    renderer,
    styles: themeStyles,
    colorScheme: isDark ? "dark" : "light",
  })

  if (!children?.trim()) return null

  return <View style={{ backgroundColor: "transparent" }}>{elements}</View>
}
