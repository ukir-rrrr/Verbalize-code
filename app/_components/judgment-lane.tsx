'use client'

import type { CodeLine } from '@/domain/code-display'
import type { InlineNote, Verdict } from '@/domain/judgment-display'

type JudgmentLaneProps = {
  readonly lines: readonly CodeLine[]
  readonly notes: readonly InlineNote[]
}

type LaneMark = {
  readonly note: InlineNote
  readonly isFirst: boolean
}

function verdictClass(verdict: Verdict): string {
  switch (verdict) {
    case 'aligned':
      return 'text-emerald-300/70'
    case 'missing':
      return 'text-amber-300/70'
    case 'misunderstood':
      return 'text-rose-300/70'
    default:
      return 'text-[#f0e2c4]/70'
  }
}

function coversLine(note: InlineNote, line: CodeLine): boolean {
  return note.range.startOffset <= line.endOffset && note.range.endOffset > line.startOffset
}

export function JudgmentLane({ lines, notes }: JudgmentLaneProps) {
  const perLine: LaneMark[][] = lines.map(() => [])
  for (const note of notes) {
    let seen = false
    lines.forEach((line, index) => {
      if (coversLine(note, line)) {
        perLine[index]?.push({ note, isFirst: !seen })
        seen = true
      }
    })
  }

  return (
    <div className="select-none font-sans text-[13px] leading-7">
      {lines.map((line, index) => {
        const marks = perLine[index] ?? []
        return (
          <div key={line.startOffset} className="flex min-h-7 flex-col justify-center gap-0.5">
            {marks.map(({ note, isFirst }) => (
              <div key={`${note.range.startOffset}-${note.range.endOffset}`} className="flex gap-2">
                <span className={`shrink-0 font-medium ${verdictClass(note.verdict)}`}>
                  {note.labelJa}
                </span>
                {isFirst ? (
                  <span className="text-[#f0e2c4]/50">{note.feedback}</span>
                ) : null}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
