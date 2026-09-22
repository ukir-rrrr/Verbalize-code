import { createJudgePort, type JudgePort } from '@/domain/judge-port'

export function createBrowserJudgePort(): JudgePort {
  return createJudgePort(async (body) => {
    const response = await fetch('/api/judge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`judge request failed: ${response.status}`)
    }
    return response.json()
  })
}
