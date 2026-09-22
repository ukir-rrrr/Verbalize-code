'use client'

import { useEffect, type RefObject } from 'react'
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react'
import type { ExplanationFormModel } from '@/domain/explanation-input'

type ExplanationComposerProps = {
  readonly form: ExplanationFormModel
  readonly rangeRef: RefObject<Range | null>
  readonly submitting: boolean
  readonly error: string | null
  readonly onChange: (text: string) => void
  readonly onBlur: () => void
  readonly onSubmit: () => void
}

const EMPTY_RECT = () =>
  typeof DOMRect === 'function'
    ? new DOMRect(0, 0, 0, 0)
    : ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 } as DOMRect)

export function ExplanationComposer({
  form,
  rangeRef,
  submitting,
  error,
  onChange,
  onBlur,
  onSubmit,
}: ExplanationComposerProps) {
  const { refs, floatingStyles } = useFloating({
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  useEffect(() => {
    refs.setPositionReference({
      getBoundingClientRect: () =>
        rangeRef.current ? rangeRef.current.getBoundingClientRect() : EMPTY_RECT(),
    })
  }, [refs, rangeRef])

  return (
    <FloatingPortal>
      <div
        // eslint-disable-next-line react-hooks/refs -- Floating UI's setFloating is a stable callback ref setter, safe in render
        ref={refs.setFloating}
        style={floatingStyles}
        className="z-50 flex w-72 flex-col gap-2 rounded-xl border border-[#f0e2c4]/15 bg-[#1a110b] p-3 shadow-2xl"
      >
        <textarea
          autoFocus
          value={form.text}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={form.labels.placeholder}
          rows={3}
          disabled={submitting}
          className="resize-none rounded-md bg-[#2a1c14] px-2 py-1.5 font-sans text-sm text-[#f0e2c4] placeholder:text-[#8d7d6e] focus:outline-none focus:ring-1 focus:ring-[#f0e2c4]/30 disabled:opacity-60"
        />
        {error ? <p className="text-xs text-rose-300/80">{error}</p> : null}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!form.submitEnabled || submitting}
          className="self-end rounded-md bg-[#f0e2c4] px-3 py-1 text-sm font-medium text-[#2a1c14] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? '判定中…' : form.labels.submit}
        </button>
      </div>
    </FloatingPortal>
  )
}
