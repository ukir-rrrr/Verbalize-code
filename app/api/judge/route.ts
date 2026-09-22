export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_VERSION = '2023-06-01'

const SYSTEM_PROMPT = [
  'あなたはコードリーディングの学習者の説明を判定する。',
  '判定の対象は、渡した範囲についての学習者の読みだけである。',
  '',
  'verdict は次の3つのいずれか1つにする。',
  '- aligned: 選んだ範囲の主目的を、事実と違う主張なしに言えているとき。主目的でない言い落としは aligned のままにする。',
  '- missing: 書いてあることが範囲と矛盾せず、主目的の一部か、結果に効く条件を言っていないとき。',
  '- misunderstood: 範囲の動き、値、または呼び出しについて事実と違うことを書いているとき。事実と違う一文があれば、ほかが合っていても misunderstood にする。',
  '',
  'feedback は日本語で1文か2文にする。どの読みが合っていたか、何が抜けていたか、どこが事実と違うかだけを書く。',
  'コードの書き方の良し悪しは書かない。範囲に無い関数や API は足さない。feedback を空にしない。',
  '',
  '出力は次の形の JSON オブジェクトだけにする。前後に文章やコードフェンスを付けない。',
  '{"verdict": "aligned" | "missing" | "misunderstood", "feedback": "日本語の1〜2文"}',
].join('\n')

type JudgeBody = {
  languageId?: unknown
  source?: unknown
  startOffset?: unknown
  endOffset?: unknown
  excerpt?: unknown
  explanation?: unknown
}

function buildUserPrompt(body: JudgeBody): string {
  const languageId = typeof body.languageId === 'string' ? body.languageId : 'plaintext'
  const source = typeof body.source === 'string' ? body.source : ''
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt : ''
  const explanation = typeof body.explanation === 'string' ? body.explanation : ''
  return [
    `言語: ${languageId}`,
    '',
    'ソース全体:',
    '```',
    source,
    '```',
    '',
    '学習者が選んだ範囲:',
    '```',
    excerpt,
    '```',
    '',
    '学習者の説明:',
    explanation,
  ].join('\n')
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    return null
  }
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'missing_api_key' }, { status: 500 })
  }

  let body: JudgeBody
  try {
    body = (await request.json()) as JudgeBody
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (
    typeof body.source !== 'string' ||
    typeof body.excerpt !== 'string' ||
    typeof body.explanation !== 'string'
  ) {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(body) }],
      }),
    })
  } catch {
    return Response.json({ error: 'upstream_unreachable' }, { status: 502 })
  }

  if (!upstream.ok) {
    return Response.json({ error: 'upstream_error' }, { status: 502 })
  }

  let payload: unknown
  try {
    payload = await upstream.json()
  } catch {
    return Response.json({ error: 'upstream_invalid' }, { status: 502 })
  }

  const text = (payload as { content?: Array<{ text?: unknown }> })?.content?.[0]?.text
  if (typeof text !== 'string') {
    return Response.json({ error: 'upstream_invalid' }, { status: 502 })
  }

  const judgment = extractJson(text)
  if (judgment === null) {
    return Response.json({ error: 'upstream_invalid' }, { status: 502 })
  }

  return Response.json(judgment)
}
