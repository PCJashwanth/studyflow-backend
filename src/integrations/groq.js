import { env } from '../config/env.js'

// Groq is OpenAI-SDK compatible, so we hit the chat-completions endpoint directly.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export function groqEnabled() {
  return Boolean(env.GROQ_API_KEY)
}

// Calls Groq requesting a strict JSON object back, and parses it.
export async function groqChatJSON(system, user) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  })

  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = await res.json()
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
}
