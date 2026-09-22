import type { CodeViewModel } from '@/domain/code-display'

export type TokenKind = 'plain' | 'comment' | 'string' | 'keyword' | 'jsx' | 'number'

export type HighlightToken = {
  readonly text: string
  readonly kind: TokenKind
  readonly offset: number
}

type ScanState = { inBlock: boolean }

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends',
  'implements', 'interface', 'type', 'enum', 'import', 'from', 'export',
  'default', 'async', 'await', 'yield', 'try', 'catch', 'finally', 'throw',
  'typeof', 'instanceof', 'in', 'of', 'void', 'delete', 'this', 'super',
  'null', 'undefined', 'true', 'false', 'as', 'readonly', 'public', 'private',
  'protected', 'static', 'get', 'set', 'keyof', 'satisfies', 'namespace',
])

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch)
}

function isIdent(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch)
}

function scanString(content: string, start: number, quote: string): number {
  let i = start + 1
  const len = content.length
  while (i < len) {
    const ch = content[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === quote) {
      return i + 1
    }
    i += 1
  }
  return len
}

function tokenizeLine(
  content: string,
  lineStart: number,
  state: ScanState,
): HighlightToken[] {
  const tokens: HighlightToken[] = []
  const len = content.length
  if (len === 0) {
    return tokens
  }

  let i = 0
  let plainFrom = 0

  const flushPlain = (to: number) => {
    if (to > plainFrom) {
      tokens.push({
        text: content.slice(plainFrom, to),
        kind: 'plain',
        offset: lineStart + plainFrom,
      })
    }
  }
  const emit = (kind: TokenKind, from: number, to: number) => {
    flushPlain(from)
    tokens.push({ text: content.slice(from, to), kind, offset: lineStart + from })
    plainFrom = to
    i = to
  }

  if (state.inBlock) {
    const close = content.indexOf('*/')
    if (close === -1) {
      tokens.push({ text: content, kind: 'comment', offset: lineStart })
      return tokens
    }
    tokens.push({
      text: content.slice(0, close + 2),
      kind: 'comment',
      offset: lineStart,
    })
    state.inBlock = false
    plainFrom = close + 2
    i = close + 2
  }

  while (i < len) {
    const ch = content[i]
    const next = content[i + 1]

    if (ch === '/' && next === '/') {
      emit('comment', i, len)
      break
    }
    if (ch === '/' && next === '*') {
      const close = content.indexOf('*/', i + 2)
      if (close === -1) {
        emit('comment', i, len)
        state.inBlock = true
        break
      }
      emit('comment', i, close + 2)
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      emit('string', i, scanString(content, i, ch))
      continue
    }
    if (ch === '<') {
      let k = i + 1
      if (content[k] === '/') k += 1
      if (k < len && isIdentStart(content[k])) {
        let m = k
        while (m < len && isIdent(content[m])) m += 1
        emit('jsx', k, m)
        continue
      }
      i += 1
      continue
    }
    if (isIdentStart(ch)) {
      let m = i
      while (m < len && isIdent(content[m])) m += 1
      const word = content.slice(i, m)
      if (KEYWORDS.has(word)) {
        emit('keyword', i, m)
      } else {
        i = m
      }
      continue
    }
    if (/[0-9]/.test(ch)) {
      let m = i
      while (m < len && /[0-9._]/.test(content[m])) m += 1
      emit('number', i, m)
      continue
    }
    i += 1
  }

  flushPlain(len)
  return tokens
}

export function highlightLines(
  view: CodeViewModel,
): readonly (readonly HighlightToken[])[] {
  const state: ScanState = { inBlock: false }
  return view.lines.map((line) => tokenizeLine(line.content, line.startOffset, state))
}
