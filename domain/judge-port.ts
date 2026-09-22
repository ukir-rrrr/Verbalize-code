import { brandValue } from '@/domain/brand'
import type { SourceDocument } from '@/domain/code-display'
import type { Explanation } from '@/domain/explanation-input'
import type { Judgment } from '@/domain/judgment-display'
import type { CodeRange } from '@/domain/range-selection'
import type { Result } from '@/domain/result'

export type JudgeRequest = {
  readonly source: SourceDocument
  readonly range: CodeRange
  readonly excerpt: string
  readonly explanation: Explanation
}

export type JudgmentParseError =
  | { readonly kind: 'malformed' }
  | { readonly kind: 'missing_verdict' }
  | { readonly kind: 'invalid_verdict' }
  | { readonly kind: 'empty_feedback' }

export type JudgeError =
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'invalid_payload' }

export type JudgePort = {
  judge(request: JudgeRequest): Promise<Result<Judgment, JudgeError>>
}

function isVerdict(value: string): value is Judgment['verdict'] {
  return value === 'aligned' || value === 'missing' || value === 'misunderstood'
}

export function parseJudgment(raw: unknown): Result<Judgment, JudgmentParseError> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: { kind: 'malformed' } }
  }
  if (!('verdict' in raw)) {
    return { ok: false, error: { kind: 'missing_verdict' } }
  }
  const verdict = raw.verdict
  if (typeof verdict !== 'string' || !isVerdict(verdict)) {
    return { ok: false, error: { kind: 'invalid_verdict' } }
  }
  if (!('feedback' in raw) || typeof raw.feedback !== 'string') {
    return { ok: false, error: { kind: 'malformed' } }
  }
  const trimmed = raw.feedback.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: { kind: 'empty_feedback' } }
  }
  return {
    ok: true,
    value: { verdict, feedback: brandValue(trimmed) },
  }
}

export function createJudgePort(
  complete: (body: unknown) => Promise<unknown>,
): JudgePort {
  return {
    async judge(request) {
      const body = {
        languageId: request.source.languageId,
        source: request.source.text,
        startOffset: request.range.startOffset,
        endOffset: request.range.endOffset,
        excerpt: request.excerpt,
        explanation: request.explanation,
      }
      let raw: unknown
      try {
        raw = await complete(body)
      } catch {
        return { ok: false, error: { kind: 'unreachable' } }
      }
      const parsed = parseJudgment(raw)
      if (!parsed.ok) {
        return { ok: false, error: { kind: 'invalid_payload' } }
      }
      return parsed
    },
  }
}
