import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../utils/response.js';
import { inboundTransferSchema } from './inbound-transfers.schema.js';
import { InboundTransfersService, MissingPasaloProductMappingsError, StoreSyncEventConflictError } from './inbound-transfers.service.js';

export class SyncController {
  static async receiveInboundTransfer(req: Request, res: Response) {
    try {
      const input = inboundTransferSchema.parse(req.body);
      const result = await InboundTransfersService.receive({
        ...input,
        eventId: input.eventId || input.idempotencyKey!,
      });
      const alreadyProcessed = 'alreadyProcessed' in result && result.alreadyProcessed === true;
      return sendSuccess(
        res,
        result,
        alreadyProcessed ? 'Inbound transfer already processed' : 'Inbound transfer processed',
        alreadyProcessed ? 200 : 201,
      );
    } catch (err: any) {
      if (err instanceof MissingPasaloProductMappingsError) {
        return sendError(res, err.message, 400, { missingMappings: err.missingMappings });
      }
      if (err instanceof StoreSyncEventConflictError) {
        return sendError(res, err.message, err.statusCode);
      }
      if (err?.statusCode === 403) {
        return sendError(res, err.message, 403);
      }
      if (err?.name === 'ZodError') {
        return sendError(res, 'Invalid inbound transfer request.', 400, err.issues);
      }
      const statusCode = err.message?.includes('already in progress') ? 409 : 400;
      return sendError(res, err.message || 'Inbound transfer processing failed.', statusCode);
    }
  }
}
