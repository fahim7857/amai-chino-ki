import { AppError } from '../utils/errors.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  const msg = err instanceof Error ? err.message : 'Unexpected server error';
  if (msg.includes('SQLITE_CONSTRAINT') || msg.includes('RAISE(ABORT')) {
    res.status(400).json({
      error: 'Database validation prevented an invalid operation.',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  console.error('[ServerError]', msg);
  res.status(500).json({
    error: 'Something went wrong on our end. Please try again.',
    code: 'INTERNAL_ERROR',
  });
}
