import type { PasteError, RawPaste, SourceDocument } from '@/domain/code-display'
import { parseSource } from '@/domain/code-display'
import {
  explanationIdFor,
  mintExplanation,
  type DraftState,
  type ExplanationError,
} from '@/domain/explanation-input'
import type { JudgeRequest } from '@/domain/judge-port'
import type { JudgedEntry, Judgment } from '@/domain/judgment-display'
import { excerpt, selectRange } from '@/domain/range-selection'
import type { RangeError, RawOffsets } from '@/domain/range-selection'
import type { Result } from '@/domain/result'

export type { DraftState, JudgedEntry, SourceDocument }

export type IdleDraft = Extract<DraftState, { kind: 'idle' }>
export type EditingDraft = Extract<DraftState, { kind: 'editing' }>
export type SubmittingDraft = Extract<DraftState, { kind: 'submitting' }>

export type ActiveSession<D extends DraftState = DraftState> = {
  readonly status: 'active'
  readonly source: SourceDocument
  readonly draft: D
  readonly entries: readonly JudgedEntry[]
}

export type StudySession =
  | { readonly status: 'empty' }
  | ActiveSession

export type NotEmpty = { readonly kind: 'not_empty' }

export function emptySession(): StudySession {
  return { status: 'empty' }
}

export function resetSession(): StudySession {
  return emptySession()
}

export function pasteSource(
  session: StudySession,
  raw: RawPaste,
): Result<ActiveSession<IdleDraft>, PasteError | NotEmpty> {
  if (session.status !== 'empty') {
    return { ok: false, error: { kind: 'not_empty' } }
  }
  const parsed = parseSource(raw)
  if (!parsed.ok) return parsed
  return {
    ok: true,
    value: {
      status: 'active',
      source: parsed.value,
      draft: { kind: 'idle' },
      entries: [],
    },
  }
}

export function beginSelection(
  session: ActiveSession<IdleDraft | EditingDraft>,
  offsets: RawOffsets,
): Result<ActiveSession<EditingDraft>, RangeError> {
  const selected = selectRange(session.source, offsets)
  if (!selected.ok) return selected
  return {
    ok: true,
    value: {
      ...session,
      draft: { kind: 'editing', range: selected.value, text: '' },
    },
  }
}

export function updateDraftText(
  session: ActiveSession<EditingDraft>,
  text: string,
): ActiveSession<EditingDraft> {
  return { ...session, draft: { ...session.draft, text } }
}

export function markSubmitting(
  session: ActiveSession<EditingDraft>,
): Result<ActiveSession<SubmittingDraft>, ExplanationError> {
  const minted = mintExplanation(session.draft.text)
  if (!minted.ok) return minted
  return {
    ok: true,
    value: {
      ...session,
      draft: {
        kind: 'submitting',
        range: session.draft.range,
        explanation: minted.value,
      },
    },
  }
}

export function restoreEditing(
  session: ActiveSession<SubmittingDraft>,
): ActiveSession<EditingDraft> {
  return {
    ...session,
    draft: {
      kind: 'editing',
      range: session.draft.range,
      text: session.draft.explanation,
    },
  }
}

export function toJudgeRequest(session: ActiveSession<SubmittingDraft>): JudgeRequest {
  const { range, explanation } = session.draft
  return {
    source: session.source,
    range,
    excerpt: excerpt(session.source, range),
    explanation,
  }
}

export function applyJudgment(
  session: ActiveSession<SubmittingDraft>,
  judgment: Judgment,
): ActiveSession<IdleDraft> {
  const id = explanationIdFor({
    documentId: session.source.id,
    range: session.draft.range,
    explanation: session.draft.explanation,
  })
  const next = {
    id,
    range: session.draft.range,
    explanation: session.draft.explanation,
    judgment,
  }
  const sameRange = (entry: JudgedEntry) =>
    entry.range.documentId === next.range.documentId &&
    entry.range.startOffset === next.range.startOffset &&
    entry.range.endOffset === next.range.endOffset
  const index = session.entries.findIndex(sameRange)
  const kept = session.entries.filter((entry) => !sameRange(entry))
  const entries =
    index === -1
      ? [...kept, next]
      : [...kept.slice(0, index), next, ...kept.slice(index)]
  return { ...session, draft: { kind: 'idle' }, entries }
}
