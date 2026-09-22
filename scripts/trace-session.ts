import assert from 'node:assert/strict'
import { parseJudgment, createJudgePort } from '@/domain/judge-port'
import { toInlineNotes } from '@/domain/judgment-display'
import {
  applyJudgment,
  beginSelection,
  emptySession,
  markSubmitting,
  pasteSource,
  restoreEditing,
  toJudgeRequest,
  updateDraftText,
} from '@/domain/session'

async function main() {
  const source = 'const n = 1\nconst m = 2\n'
  const explanation = 'n を 1 にする'

  const emptyPaste = pasteSource(emptySession(), { text: '   ', languageId: 'ts' })
  assert.equal(emptyPaste.ok, false, 'empty paste stays out of active')
  if (!emptyPaste.ok) {
    assert.deepEqual(emptyPaste.error, { kind: 'empty_source' })
  }

  const pasted = pasteSource(emptySession(), { text: source, languageId: 'ts' })
  assert.equal(pasted.ok, true, 'non-empty paste becomes active')
  if (!pasted.ok) {
    throw new Error('paste failed')
  }
  assert.equal(pasted.value.status, 'active')
  assert.equal(pasted.value.draft.kind, 'idle')
  assert.deepEqual(pasted.value.entries, [])

  const inverted = beginSelection(pasted.value, { startOffset: 8, endOffset: 1 })
  assert.equal(inverted.ok, false, 'inverted selection does not edit')
  if (!inverted.ok) {
    assert.deepEqual(inverted.error, { kind: 'inverted' })
  }
  assert.equal(pasted.value.draft.kind, 'idle')

  const selected = beginSelection(pasted.value, { startOffset: 0, endOffset: 11 })
  assert.equal(selected.ok, true, 'forward selection edits')
  if (!selected.ok) {
    throw new Error('selection failed')
  }
  assert.equal(selected.value.draft.kind, 'editing')

  const blank = markSubmitting(updateDraftText(selected.value, '   '))
  assert.equal(blank.ok, false, 'blank explanation is not minted')
  if (!blank.ok) {
    assert.deepEqual(blank.error, { kind: 'empty_explanation' })
  }

  const submitting = markSubmitting(updateDraftText(selected.value, explanation))
  assert.equal(submitting.ok, true, 'explanation submits')
  if (!submitting.ok) {
    throw new Error('submit failed')
  }
  assert.equal(submitting.value.draft.kind, 'submitting')
  assert.equal(toJudgeRequest(submitting.value).excerpt, 'const n = 1')

  const emptyFeedback = parseJudgment({ verdict: 'aligned', feedback: '  ' })
  assert.equal(emptyFeedback.ok, false, 'empty feedback is rejected')
  if (!emptyFeedback.ok) {
    assert.deepEqual(emptyFeedback.error, { kind: 'empty_feedback' })
  }

  const parsed = parseJudgment({
    verdict: 'missing',
    feedback: '初期化の理由がない',
  })
  assert.equal(parsed.ok, true, 'judgment parses')
  if (!parsed.ok) {
    throw new Error('parse failed')
  }

  const applied = applyJudgment(submitting.value, parsed.value)
  assert.equal(applied.draft.kind, 'idle')
  assert.equal(applied.entries.length, 1)
  assert.equal(applied.entries[0]?.judgment.verdict, 'missing')
  assert.deepEqual(toInlineNotes(applied.entries), [
    {
      range: { documentId: pasted.value.source.id, startOffset: 0, endOffset: 11 },
      verdict: 'missing',
      feedback: '初期化の理由がない',
      labelJa: '抜けている',
    },
  ])

  const retried = applyJudgment(
    { ...submitting.value, entries: applied.entries },
    parsed.value,
  )
  assert.equal(retried.entries.length, 1, 'same submission does not add an entry')
  assert.equal(retried.entries[0]?.id, applied.entries[0]?.id)

  const revised = markSubmitting(
    updateDraftText(selected.value, '別の読み'),
  )
  assert.equal(revised.ok, true, 'a new explanation submits')
  if (!revised.ok) {
    throw new Error('revise failed')
  }
  const reparsed = parseJudgment({
    verdict: 'aligned',
    feedback: '主目的は合っている',
  })
  assert.equal(reparsed.ok, true, 'replacement judgment parses')
  if (!reparsed.ok) {
    throw new Error('reparse failed')
  }
  const replaced = applyJudgment(
    { ...revised.value, entries: applied.entries },
    reparsed.value,
  )
  assert.equal(replaced.entries.length, 1, 'same range replaces the note')
  assert.equal(replaced.entries[0]?.judgment.verdict, 'aligned')
  assert.equal(toInlineNotes(replaced.entries)[0]?.labelJa, '合っている')

  const failed = await createJudgePort(async () => {
    throw new Error('down')
  }).judge(toJudgeRequest(submitting.value))
  assert.equal(failed.ok, false, 'port failure is unreachable')
  if (!failed.ok) {
    assert.deepEqual(failed.error, { kind: 'unreachable' })
  }
  const restored = restoreEditing(submitting.value)
  assert.equal(restored.draft.kind, 'editing')
  if (restored.draft.kind === 'editing') {
    assert.equal(restored.draft.text, explanation)
  }
  assert.deepEqual(restored.entries, [])

  console.log('trace-session ok')
}

main()
