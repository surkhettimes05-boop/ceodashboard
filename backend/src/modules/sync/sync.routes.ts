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

export default router;
