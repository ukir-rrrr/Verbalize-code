import { restoreEditing, type StudySession } from '@/domain/session'
import type { ActiveSession, SubmittingDraft } from '@/domain/session'

const FILE_NAME = 'study-session.json'
const FORMAT_VERSION = 1

type Envelope = {
  readonly version: number
  readonly session: StudySession
}

export type OpenResult =
  | { readonly kind: 'ok'; readonly session: StudySession }
  | { readonly kind: 'empty' }
  | { readonly kind: 'corrupt' }
  | { readonly kind: 'unavailable' }

export type SaveResult = 'ok' | 'unavailable'

async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.storage ||
      typeof navigator.storage.getDirectory !== 'function'
    ) {
      return null
    }
    return await navigator.storage.getDirectory()
  } catch {
    return null
  }
}

function isStudySession(value: unknown): value is StudySession {
  if (typeof value !== 'object' || value === null) return false
  const status = (value as { status?: unknown }).status
  if (status === 'empty') return true
  if (status !== 'active') return false
  const draft = (value as { draft?: { kind?: unknown } }).draft
  const kind = draft?.kind
  return kind === 'idle' || kind === 'editing' || kind === 'submitting'
}

function toPersistable(session: StudySession): StudySession {
  if (session.status === 'active' && session.draft.kind === 'submitting') {
    return restoreEditing(session as ActiveSession<SubmittingDraft>)
  }
  return session
}

export type SessionVault = {
  open(): Promise<OpenResult>
  save(session: StudySession): Promise<SaveResult>
}

export function createSessionVault(): SessionVault {
  return {
    async open() {
      const root = await getRoot()
      if (!root) return { kind: 'unavailable' }
      let handle: FileSystemFileHandle
      try {
        handle = await root.getFileHandle(FILE_NAME)
      } catch {
        return { kind: 'empty' }
      }
      let text: string
      try {
        const file = await handle.getFile()
        text = await file.text()
      } catch {
        return { kind: 'unavailable' }
      }
      if (text.trim().length === 0) {
        return { kind: 'corrupt' }
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return { kind: 'corrupt' }
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as Envelope).version !== FORMAT_VERSION ||
        !isStudySession((parsed as Envelope).session)
      ) {
        return { kind: 'corrupt' }
      }
      return { kind: 'ok', session: (parsed as Envelope).session }
    },

    async save(session) {
      const root = await getRoot()
      if (!root) return 'unavailable'
      const envelope: Envelope = {
        version: FORMAT_VERSION,
        session: toPersistable(session),
      }
      try {
        const handle = await root.getFileHandle(FILE_NAME, { create: true })
        const writable = await handle.createWritable()
        await writable.write(JSON.stringify(envelope))
        await writable.close()
        return 'ok'
      } catch {
        return 'unavailable'
      }
    },
  }
}
