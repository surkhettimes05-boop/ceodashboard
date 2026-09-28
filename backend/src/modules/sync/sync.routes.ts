import { Router } from "express";
import { authenticatePasaloWebhook } from "./pasalo-webhook.middleware.js";
import { SyncController } from "./sync.controller.js";
import { verifyPasaloEvent } from "./verify-pasalo-event.middleware.js";

const router = Router();

router.post(
  "/inbound-transfers",
  authenticatePasaloWebhook,
  verifyPasaloEvent,
  SyncController.receiveInboundTransfer,
);

router.post(
  "/online-fulfillments/reserve",
  authenticatePasaloWebhook,
  SyncController.reserveOnlineFulfillment,
);
router.post(
  "/online-fulfillments/:externalOrderId/complete",
  authenticatePasaloWebhook,
  SyncController.completeOnlineFulfillment,
);
router.post(
  "/online-fulfillments/:externalOrderId/cancel",
  authenticatePasaloWebhook,
  SyncController.cancelOnlineFulfillment,
);

export default router;
