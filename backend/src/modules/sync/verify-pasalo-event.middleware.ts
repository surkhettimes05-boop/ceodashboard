import { createHash, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { sendError } from "../../utils/response.js";

export function verifyPasaloEvent(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const eventId = req.get("X-Event-Id") ?? "";
  const payloadHash = req.get("X-Payload-Sha256") ?? "";
  if (
    !eventId ||
    typeof req.body?.eventId !== "string" ||
    eventId !== req.body.eventId
  ) {
    return sendError(
      res,
      "PASALO event ID header does not match the request body.",
      400,
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(payloadHash)) {
    return sendError(res, "PASALO payload hash is missing or invalid.", 400);
  }
  const actual = Buffer.from(payloadHash.toLowerCase(), "hex");
  // Sender hashes the exact compact JSON body it sends.
  const expected = createHash("sha256")
    .update(JSON.stringify(req.body))
    .digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return sendError(
      res,
      "PASALO payload hash does not match the request body.",
      400,
    );
  }
  return next();
}
