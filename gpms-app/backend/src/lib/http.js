import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details)
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg)
export const forbidden = (msg = 'You do not have permission for this action') => new HttpError(403, msg)
export const notFound = (msg = 'Not found') => new HttpError(404, msg)
export const conflict = (msg) => new HttpError(409, msg)

/** Parse req.body / req.query with a zod schema, turning failures into a 400 with field errors. */
export function parse(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) throw result.error
  return result.data
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {}
    for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message
    return res.status(400).json({ error: 'Validation failed', fields })
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) })
  // Postgres constraint violations → friendly client errors.
  if (err.code === '23505') return res.status(409).json({ error: 'A record with this value already exists', constraint: err.constraint })
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist', constraint: err.constraint })
  if (err.code === '23514') return res.status(400).json({ error: 'Value violates a business rule', constraint: err.constraint })
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large' })
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
