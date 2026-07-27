// In-memory response cache for authenticated GET list endpoints.
// Server-side optimization #1 (Assignment 3).
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 })

// Cache GET responses, keyed by URL + user id (data is user-scoped).
export function cacheMiddleware(ttlSeconds = 60) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next()

    const key = `${req.originalUrl}:u${req.user?.id ?? 'anon'}`
    const hit = cache.get(key)
    if (hit !== undefined) {
      res.set('X-Cache', 'HIT')
      return res.status(200).json(hit)
    }

    const originalJson = res.json.bind(res)
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, body, ttlSeconds)
      }
      res.set('X-Cache', 'MISS')
      return originalJson(body)
    }
    next()
  }
}

// Drop all cached entries whose key starts with any given prefix.
// Called from write routes so stale lists are never served.
export function invalidateCache(...prefixes) {
  const keys = cache.keys().filter((k) => prefixes.some((p) => k.startsWith(p)))
  if (keys.length) cache.del(keys)
}
