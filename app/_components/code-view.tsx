'use client'

import type { RefObject } from 'react'
import type { CodeViewModel } from '@/domain/code-display'
import type { HighlightToken, TokenKind } from '@/app/_lib/highlight'
import { highlightLines } from '@/app/_lib/highlight'
import type { InlineNote } from '@/domain/judgment-display'
import { JudgmentLane } from '@/app/_components/judgment-lane'

export type ActiveRange = { readonly start: number; readonly end: number }

type CodeViewProps = {
  readonly view: CodeViewModel
  readonly notes: readonly InlineNote[]
  readonly activeRange: ActiveRange | null
  readonly containerRef: RefObject<HTMLDivElement | null>
  readonly onSelect: () => void
}

function kindClass(kind: TokenKind): string {
  switch (kind) {
    case 'comment':
      return 'text-[#8d7d6e] italic'
    case 'string':
      return 'text-[#d9825f]'
    case 'number':
      return 'text-[#d9825f]'
    case 'keyword':
      return 'text-[#e6a24c]'
    case 'jsx':
      return 'text-[#dcc39a]'
    default:
      return ''
  }
}

function TokenSpans({
  token,
  active,
}: {
  token: HighlightToken
  active: ActiveRange | null
}) {
  const base = kindClass(token.kind)
  const start = token.offset
  const end = token.offset + token.text.length

  if (!active || active.end <= start || active.start >= end) {
    return (
      <span className={base} data-offset={start}>
        {token.text}
      </span>
    )
  }

  const hiStart = Math.max(start, active.start)
  const hiEnd = Math.min(end, active.end)
  const parts: Array<{ text: string; offset: number; highlighted: boolean }> = []
  if (hiStart > start) {
    parts.push({ text: token.text.slice(0, hiStart - start), offset: start, highlighted: false })
  }
  parts.push({
    text: token.text.slice(hiStart - start, hiEnd - start),
    offset: hiStart,
    highlighted: true,
  })
  if (hiEnd < end) {
    parts.push({ text: token.text.slice(hiEnd - start), offset: hiEnd, highlighted: false })
  }

  return (
    <>
      {parts.map((part) => (
        <span
          key={part.offset}
          data-offset={part.offset}
          className={`${base}${part.highlighted ? ' rounded-sm bg-[#f0e2c4]/20' : ''}`}
        >
          {part.text}
        </span>
      ))}
    </>
  )
}

export function CodeView({
  view,
  notes,
  activeRange,
  containerRef,
  onSelect,
}: CodeViewProps) {
  const lines = highlightLines(view)
  const hasNotes = notes.length > 0

  return (
    <div className="flex gap-x-6">
      <div
        ref={containerRef}
        onMouseUp={onSelect}
        className="min-w-0 flex-1 cursor-text overflow-x-auto whitespace-pre font-mono text-[15px] leading-8 text-[#f0e2c4]"
      >
        {view.lines.map((line, index) => {
          const tokens = lines[index] ?? []
          return (
            <div key={line.startOffset} className="min-h-8">
              {tokens.length === 0 ? (
                <br />
              ) : (
                tokens.map((token) => (
                  <TokenSpans key={token.offset} token={token} active={activeRange} />
                ))
              )}
            </div>
          )
        })}
      </div>
      {hasNotes ? (
        <div className="w-56 shrink-0">
          <JudgmentLane lines={view.lines} notes={notes} />
        </div>
      ) : null}
    </div>
  )
}
