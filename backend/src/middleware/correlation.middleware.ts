import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || randomUUID();
  req.correlationId = correlationId;
  Logger.setCorrelationId(correlationId);

  res.setHeader('X-Correlation-ID', correlationId);

  res.on('finish', () => {
    Logger.clearCorrelationId();
  });

  next();
}
