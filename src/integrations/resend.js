import { env } from '../config/env.js'

const RESEND_URL = 'https://api.resend.com/emails'

export function resendEnabled() {
  return Boolean(env.RESEND_API_KEY)
}

// Sends an email via Resend. If no key is configured, logs it (dev fallback).
export async function sendEmail({ to, subject, html }) {
  if (!resendEnabled()) {
    console.log(`[email:dev] to=${to} subject="${subject}"`)
    return { sent: false }
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM, to, subject, html }),
    })
    if (!res.ok) {
      console.error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return { sent: false }
    }
    return { sent: true }
  } catch (e) {
    console.error('Resend request failed:', e.message)
    return { sent: false }
  }
}
