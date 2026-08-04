import * as authService from './auth.service.js'

export async function signup(req, res) {
  const result = await authService.signup(req.body)
  res.status(201).json(result)
}

export async function login(req, res) {
  const result = await authService.login(req.body)
  res.status(200).json(result)
}

export async function verifyOtp(req, res) {
  const result = await authService.verifyOtp(req.body)
  res.status(200).json(result)
}

export async function me(req, res) {
  const user = await authService.getMe(req.user.id)
  res.json({ user })
}

export async function changePassword(req, res) {
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword)
  res.json({ ok: true })
}
