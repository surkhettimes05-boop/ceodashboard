import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error in request', err, { path: req.path, method: req.method });
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Request failed');

  return sendError(
    res,
    message,
    statusCode,
    process.env.NODE_ENV === 'development' ? err.stack : undefined
  );
}
