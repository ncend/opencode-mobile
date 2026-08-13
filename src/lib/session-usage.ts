import type { Message } from "./sdk"
import type { Provider } from "../stores/catalog"

export interface SessionUsage {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
  context: number
  percent: number
}

export function computeSessionUsage(messages: Message[], providers: Provider[]): SessionUsage {
  let last: Message | null = null
  for (const msg of messages) {
    if (msg.role !== "assistant") continue
    if (msg.tokens && msg.tokens.output > 0) last = msg
  }

  // Last assistant message token breakdown (what the TUI shows)
  const tokens = last?.tokens
  const input = tokens?.input || 0
  const output = tokens?.output || 0
  const reasoning = tokens?.reasoning || 0
  const cacheRead = tokens?.cache?.read || 0
  const cacheWrite = tokens?.cache?.write || 0
  const total = input + output + reasoning + cacheRead + cacheWrite

  // Find context limit from the message's provider/model
  let context = 0
  if (last?.providerID && last?.modelID) {
    const provider = providers.find((p) => p.id === last!.providerID)
    const model = provider?.models.find((m) => m.id === last!.modelID)
    context = model?.limit?.context || 0
  }
  const percent = context > 0 ? Math.round((total / context) * 100) : 0

  return { input, output, reasoning, cacheRead, cacheWrite, total, context, percent }
}