import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../../config/index.js';
import { sendError } from '../../utils/response.js';

export function authenticatePasaloWebhook(req: Request, res: Response, next: NextFunction) {
  const receivedSecret = req.get('X-Pasalo-Webhook-Secret');
  const configuredSecret = config.pasaloWebhookSecret;

  if (!configuredSecret) {
    return sendError(res, 'PASALO webhook authentication is not configured.', 503);
  }

  const received = Buffer.from(receivedSecret || '');
  const expected = Buffer.from(configuredSecret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return sendError(res, 'Invalid PASALO webhook secret.', 401);
  }

  return next();
}