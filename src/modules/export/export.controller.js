import * as service from './export.service.js'

export async function scheduleIcs(req, res) {
  const { ics, count } = await service.tasksIcs(req.user.id)
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="studyflow.ics"')
  res.setHeader('X-Event-Count', String(count))
  res.send(ics)
}
