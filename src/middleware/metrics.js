// Prometheus instrumentation (Assignment 3 monitoring).
// Exposes default process metrics (CPU, memory, event loop) plus HTTP
// request latency histogram and request/error counters at GET /metrics.
import client from 'prom-client'

client.collectDefaultMetrics({ prefix: 'studyflow_' })

const httpRequestDuration = new client.Histogram({
  name: 'studyflow_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
})

const httpRequestsTotal = new client.Counter({
  name: 'studyflow_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
})

export function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer()
  res.on('finish', () => {
    const route = req.route?.path ? (req.baseUrl || '') + req.route.path : req.path
    const labels = { method: req.method, route, status_code: res.statusCode }
    end(labels)
    httpRequestsTotal.inc(labels)
  })
  next()
}

export async function metricsEndpoint(_req, res) {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
}
