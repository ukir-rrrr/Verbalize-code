import type { Brand } from '@/domain/brand'
import type { Explanation, ExplanationId } from '@/domain/explanation-input'
import type { CodeRange } from '@/domain/range-selection'

export type Verdict = 'aligned' | 'missing' | 'misunderstood'
export type FeedbackText = Brand<string, 'FeedbackText'>

export type Judgment = {
  readonly verdict: Verdict
  readonly feedback: FeedbackText
}

export type JudgedEntry = {
  readonly id: ExplanationId
  readonly range: CodeRange
  readonly explanation: Explanation
  readonly judgment: Judgment
}

export type InlineNote = {
  readonly range: CodeRange
  readonly verdict: Verdict
  readonly feedback: FeedbackText
  readonly labelJa: string
}

export function verdictLabelJa(verdict: Verdict): string {
  switch (verdict) {
    case 'aligned':
      return '合っている'
    case 'missing':
      return '抜けている'
    case 'misunderstood':
      return '誤解'
    default: {
      const exhaustive: never = verdict
      return exhaustive
    }
  }
}

export function toInlineNotes(
  entries: readonly JudgedEntry[],
): readonly InlineNote[] {
  return entries.map((entry) => ({
    range: entry.range,
    verdict: entry.judgment.verdict,
    feedback: entry.judgment.feedback,
    labelJa: verdictLabelJa(entry.judgment.verdict),
  }))
}
