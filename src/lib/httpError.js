// Creates an Error carrying an HTTP status for the central error handler.
export function httpError(message, status = 500) {
  const err = new Error(message)
  err.status = status
  return err
}
