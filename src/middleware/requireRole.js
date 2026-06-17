// Guards a route to one or more roles. Use after `authenticate`.
// Example: router.get('/admin', authenticate, requireRole('ADMIN'), handler)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' })
    }
    next()
  }
}
