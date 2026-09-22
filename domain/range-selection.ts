import type { DocumentId, SourceDocument } from '@/domain/code-display'
import type { Result } from '@/domain/result'

export type CodeRange = {
  readonly documentId: DocumentId
  readonly startOffset: number
  readonly endOffset: number
}

export type RawOffsets = {
  readonly startOffset: number
  readonly endOffset: number
}

export type RangeError =
  | { readonly kind: 'out_of_bounds' }
  | { readonly kind: 'empty_range' }
  | { readonly kind: 'inverted' }

export function selectRange(
  document: SourceDocument,
  offsets: RawOffsets,
): Result<CodeRange, RangeError> {
  const { startOffset, endOffset } = offsets
  const length = document.text.length
  if (
    startOffset < 0 ||
    endOffset < 0 ||
    startOffset > length ||
    endOffset > length
  ) {
    return { ok: false, error: { kind: 'out_of_bounds' } }
  }
  if (startOffset > endOffset) {
    return { ok: false, error: { kind: 'inverted' } }
  }
  if (startOffset === endOffset) {
    return { ok: false, error: { kind: 'empty_range' } }
  }
  return {
    ok: true,
    value: { documentId: document.id, startOffset, endOffset },
  }
}

export function excerpt(document: SourceDocument, range: CodeRange): string {
  return document.text.slice(range.startOffset, range.endOffset)
}
