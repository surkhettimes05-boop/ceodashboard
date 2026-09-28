import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../utils/response.js';
import { inboundTransferSchema } from './inbound-transfers.schema.js';
import { InboundTransfersService, MissingPasaloProductMappingsError, StoreSyncEventConflictError } from './inbound-transfers.service.js';
import { OnlineFulfillmentError, OnlineFulfillmentService } from './online-fulfillment.service.js';
import { reserveOnlineFulfillmentSchema } from './online-fulfillment.schema.js';

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

  static async reserveOnlineFulfillment(req: Request, res: Response) {
    try {
      const input = reserveOnlineFulfillmentSchema.parse(req.body);
      const result = await OnlineFulfillmentService.reserve(input);
      return sendSuccess(res, result, result.alreadyProcessed ? 'Online fulfillment already reserved' : 'Online fulfillment reserved', result.alreadyProcessed ? 200 : 201);
    } catch (err: any) {
      if (err instanceof OnlineFulfillmentError) return sendError(res, err.message, err.statusCode);
      if (err?.name === 'ZodError') return sendError(res, 'Invalid online fulfillment request.', 400, err.issues);
      return sendError(res, err.message || 'Online fulfillment reservation failed.', 500);
    }
  }

  static async completeOnlineFulfillment(req: Request, res: Response) {
    try {
      const result = await OnlineFulfillmentService.complete(String(req.params.externalOrderId));
      return sendSuccess(res, result, result.alreadyProcessed ? 'Online fulfillment already completed' : 'Online fulfillment completed');
    } catch (err: any) {
      if (err instanceof OnlineFulfillmentError) return sendError(res, err.message, err.statusCode);
      return sendError(res, err.message || 'Online fulfillment completion failed.', 500);
    }
  }

  static async cancelOnlineFulfillment(req: Request, res: Response) {
    try {
      const result = await OnlineFulfillmentService.cancel(String(req.params.externalOrderId));
      return sendSuccess(res, result, result.alreadyProcessed ? 'Online fulfillment already cancelled' : 'Online fulfillment cancelled');
    } catch (err: any) {
      if (err instanceof OnlineFulfillmentError) return sendError(res, err.message, err.statusCode);
      return sendError(res, err.message || 'Online fulfillment cancellation failed.', 500);
    }
  }
}
