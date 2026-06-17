// Wraps an async route handler so rejected promises reach the error middleware.
// Works on both Express 4 and 5.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)
