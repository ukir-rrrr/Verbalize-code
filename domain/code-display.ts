import { brandValue, type Brand } from '@/domain/brand'
import type { Result } from '@/domain/result'

export type DocumentId = Brand<string, 'DocumentId'>
export type SourceText = Brand<string, 'SourceText'>
export type LanguageId = Brand<string, 'LanguageId'>

export type SourceDocument = {
  readonly id: DocumentId
  readonly text: SourceText
  readonly languageId: LanguageId
}

export type CodeLine = {
  readonly lineNumber: number
  readonly startOffset: number
  readonly endOffset: number
  readonly content: string
}

export type CodeViewModel = {
  readonly languageId: LanguageId
  readonly lines: readonly CodeLine[]
}

export type PasteError = { readonly kind: 'empty_source' }

export type RawPaste = {
  readonly text: string
  readonly languageId: string
}

export function parseSource(raw: RawPaste): Result<SourceDocument, PasteError> {
  if (raw.text.trim().length === 0) {
    return { ok: false, error: { kind: 'empty_source' } }
  }
  const language = raw.languageId.trim()
  const document: SourceDocument = {
    id: brandValue(crypto.randomUUID()),
    text: brandValue(raw.text),
    languageId: brandValue(language.length === 0 ? 'plaintext' : language),
  }
  return { ok: true, value: document }
}

export function toCodeView(document: SourceDocument): CodeViewModel {
  const lines: CodeLine[] = []
  let offset = 0
  const parts = document.text.split('\n')
  for (let index = 0; index < parts.length; index += 1) {
    const content = parts[index] ?? ''
    const startOffset = offset
    const endOffset = offset + content.length
    lines.push({
      lineNumber: index + 1,
      startOffset,
      endOffset,
      content,
    })
    offset = endOffset + 1
  }
  return { languageId: document.languageId, lines }
}
