import { env } from '../config/env.js'

// No API key? Print the email instead of sending it, so it can be test locally.
export function mailerMode() {
  return env.RESEND_API_KEY ? 'resend' : 'log'
}

export async function sendEmail({ to, subject, text }) {
  if (!env.RESEND_API_KEY) {
    console.log(`📧 would email ${to}: ${subject}\n${text}\n`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text }),
  })

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`)
  }
}
