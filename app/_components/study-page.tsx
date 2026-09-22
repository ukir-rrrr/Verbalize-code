'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toCodeView } from '@/domain/code-display'
import { toExplanationForm } from '@/domain/explanation-input'
import { toInlineNotes } from '@/domain/judgment-display'
import {
  applyJudgment,
  beginSelection,
  emptySession,
  markSubmitting,
  pasteSource,
  resetSession,
  restoreEditing,
  toJudgeRequest,
  updateDraftText,
  type ActiveSession,
  type EditingDraft,
  type IdleDraft,
  type StudySession,
} from '@/domain/session'
import { CodeView, type ActiveRange } from '@/app/_components/code-view'
import { ExplanationComposer } from '@/app/_components/explanation-composer'
import { createBrowserJudgePort } from '@/app/_lib/judge-client'
import { createSessionVault } from '@/app/_lib/session-vault'

function offsetFromPoint(node: Node, offsetInNode: number): number | null {
  let el: HTMLElement | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
  while (el && el.dataset?.offset === undefined) {
    el = el.parentElement
  }
  if (!el) return null
  const base = Number(el.dataset.offset)
  if (Number.isNaN(base)) return null
  if (node.nodeType === Node.TEXT_NODE) {
    return base + offsetInNode
  }
  const length = el.textContent?.length ?? 0
  return base + (offsetInNode > 0 ? length : 0)
}

export function StudyPage() {
  const vault = useMemo(() => createSessionVault(), [])
  const port = useMemo(() => createBrowserJudgePort(), [])
  const rangeRef = useRef<Range | null>(null)
  const codeRef = useRef<HTMLDivElement | null>(null)

  const [session, setSession] = useState<StudySession>(() => emptySession())
  const [ready, setReady] = useState(false)
  const [vaultNote, setVaultNote] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteLang, setPasteLang] = useState('tsx')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [judgeError, setJudgeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await vault.open()
      if (cancelled) return
      if (result.kind === 'ok') {
        setSession(result.session)
      } else if (result.kind === 'corrupt') {
        setVaultNote('保存が読めなかったので、新しく始めます。')
      } else if (result.kind === 'unavailable') {
        setVaultNote('この環境では保存できません。このタブの中だけで続けます。')
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [vault])

  const persist = (next: StudySession) => {
    void vault.save(next)
  }

  const handlePaste = () => {
    const result = pasteSource(session, { text: pasteText, languageId: pasteLang })
    if (!result.ok) {
      setPasteError('コードを入れてください。')
      return
    }
    setPasteError(null)
    rangeRef.current = null
    setSession(result.value)
    persist(result.value)
  }

  const handleReset = () => {
    const next = resetSession()
    rangeRef.current = null
    setPasteText('')
    setJudgeError(null)
    setSession(next)
    persist(next)
  }

  const handleSelect = () => {
    if (session.status !== 'active' || session.draft.kind === 'submitting') return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    if (!codeRef.current || !codeRef.current.contains(range.commonAncestorContainer)) return
    const start = offsetFromPoint(range.startContainer, range.startOffset)
    const end = offsetFromPoint(range.endContainer, range.endOffset)
    if (start === null || end === null) return
    const lo = Math.min(start, end)
    const hi = Math.max(start, end)
    const result = beginSelection(
      session as ActiveSession<IdleDraft | EditingDraft>,
      { startOffset: lo, endOffset: hi },
    )
    if (!result.ok) return
    rangeRef.current = range.cloneRange()
    setJudgeError(null)
    setSession(result.value)
    persist(result.value)
  }

  const handleDraftChange = (text: string) => {
    if (session.status !== 'active' || session.draft.kind !== 'editing') return
    setSession(updateDraftText(session as ActiveSession<EditingDraft>, text))
  }

  const handleDraftBlur = () => {
    if (session.status !== 'active' || session.draft.kind !== 'editing') return
    persist(session)
  }

  const handleSubmit = async () => {
    if (session.status !== 'active' || session.draft.kind !== 'editing') return
    persist(session)
    const marked = markSubmitting(session as ActiveSession<EditingDraft>)
    if (!marked.ok) return
    const submitting = marked.value
    setJudgeError(null)
    setSession(submitting)
    const result = await port.judge(toJudgeRequest(submitting))
    if (result.ok) {
      const next = applyJudgment(submitting, result.value)
      rangeRef.current = null
      setSession(next)
      persist(next)
    } else {
      const back = restoreEditing(submitting)
      setSession(back)
      persist(back)
      setJudgeError('判定できませんでした。もう一度試してください。')
    }
  }

  const dots = (
    <div className="flex items-center gap-2.5">
      <span className="h-3 w-3 rounded-full bg-[#7d7168]" />
      <span className="h-3 w-3 rounded-full bg-[#7d7168]" />
      <span className="h-3 w-3 rounded-full bg-[#7d7168]" />
    </div>
  )

  const isActive = session.status === 'active'
  const draft = isActive ? session.draft : null
  const activeRange: ActiveRange | null =
    draft && (draft.kind === 'editing' || draft.kind === 'submitting')
      ? { start: draft.range.startOffset, end: draft.range.endOffset }
      : null

  return (
    <div className="flex flex-1 items-center justify-center bg-[radial-gradient(125%_125%_at_50%_30%,#f8c25a_0%,#ef9539_50%,#d76c25_100%)] p-10 sm:p-14">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-b from-[#32231a] to-[#231710] shadow-[0_35px_120px_-25px_rgba(50,15,0,0.7)] ring-1 ring-black/20">
        <div className="flex items-center justify-between px-8 pt-6 pb-3">
          {dots}
          {isActive ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md px-2 py-1 font-sans text-xs text-[#f0e2c4]/60 transition-colors hover:text-[#f0e2c4]"
            >
              別のコード
            </button>
          ) : null}
        </div>

        <div className="px-8 pb-9">
          {vaultNote ? (
            <p className="mb-3 font-sans text-xs text-[#f0e2c4]/50">{vaultNote}</p>
          ) : null}

          {!isActive ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder="ここにコードを貼り付けてください"
                rows={12}
                className="w-full resize-none rounded-lg bg-[#1a110b] px-4 py-3 font-mono text-[15px] leading-7 text-[#f0e2c4] placeholder:text-[#8d7d6e] focus:outline-none focus:ring-1 focus:ring-[#f0e2c4]/25"
              />
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 font-sans text-xs text-[#f0e2c4]/60">
                  言語
                  <input
                    value={pasteLang}
                    onChange={(event) => setPasteLang(event.target.value)}
                    className="w-24 rounded-md bg-[#1a110b] px-2 py-1 font-mono text-xs text-[#f0e2c4] focus:outline-none focus:ring-1 focus:ring-[#f0e2c4]/25"
                  />
                </label>
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={!ready}
                  className="rounded-md bg-[#f0e2c4] px-4 py-1.5 font-sans text-sm font-medium text-[#2a1c14] transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  貼り付ける
                </button>
              </div>
              {pasteError ? (
                <p className="font-sans text-xs text-rose-300/80">{pasteError}</p>
              ) : null}
            </div>
          ) : (
            <CodeView
              view={toCodeView(session.source)}
              notes={toInlineNotes(session.entries)}
              activeRange={activeRange}
              containerRef={codeRef}
              onSelect={handleSelect}
            />
          )}
        </div>
      </div>

      {draft && (draft.kind === 'editing' || draft.kind === 'submitting') ? (
        <ExplanationComposer
          form={
            draft.kind === 'editing'
              ? toExplanationForm(draft)
              : {
                  range: draft.range,
                  text: draft.explanation,
                  submitEnabled: false,
                  labels: { placeholder: '', submit: '提出する' },
                }
          }
          rangeRef={rangeRef}
          submitting={draft.kind === 'submitting'}
          error={judgeError}
          onChange={handleDraftChange}
          onBlur={handleDraftBlur}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  )
}
