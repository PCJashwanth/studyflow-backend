import * as service from './notifications.service.js'

export async function dispatch(req, res) {
  res.json(await service.dispatchDeadlineReminders())
}
