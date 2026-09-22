import { brandValue, type Brand } from '@/domain/brand'
import type { DocumentId } from '@/domain/code-display'
import type { CodeRange } from '@/domain/range-selection'
import type { Result } from '@/domain/result'

export type Explanation = Brand<string, 'Explanation'>
export type ExplanationId = Brand<string, 'ExplanationId'>

export type ExplanationError = { readonly kind: 'empty_explanation' }

export type DraftState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'editing'; readonly range: CodeRange; readonly text: string }
  | {
      readonly kind: 'submitting'
      readonly range: CodeRange
      readonly explanation: Explanation
    }

export type ExplanationFormModel = {
  readonly range: CodeRange
  readonly text: string
  readonly submitEnabled: boolean
  readonly labels: {
    readonly placeholder: string
    readonly submit: string
  }
}

const placeholder = 'この範囲が何をしているか書いてください'
const submitLabel = '提出する'

export function mintExplanation(
  text: string,
): Result<Explanation, ExplanationError> {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: { kind: 'empty_explanation' } }
  }
  return { ok: true, value: brandValue(trimmed) }
}

export function explanationIdFor(input: {
  documentId: DocumentId
  range: CodeRange
  explanation: Explanation
}): ExplanationId {
  return brandValue(
    JSON.stringify([
      input.documentId,
      input.range.startOffset,
      input.range.endOffset,
      input.explanation,
    ]),
  )
}

export function toExplanationForm(
  draft: Extract<DraftState, { kind: 'editing' }>,
): ExplanationFormModel {
  return {
    range: draft.range,
    text: draft.text,
    submitEnabled: draft.text.trim().length > 0,
    labels: { placeholder, submit: submitLabel },
  }
}
