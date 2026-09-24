import { InventoryMovementType, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { InboundTransferInput } from "./inbound-transfers.schema.js";
import { logger } from "../../utils/logger.js";
import { createHash } from "node:crypto";
import { config } from "../../config/index.js";

export class MissingPasaloProductMappingsError extends Error {
  constructor(public readonly missingMappings: string[]) {
    super("One or more PASALO products are not mapped to local products.");
    this.name = "MissingPasaloProductMappingsError";
  }
}

export class StoreSyncEventConflictError extends Error {
  statusCode = 409;

  constructor() {
    super("The event ID was already processed with a different payload.");
    this.name = "StoreSyncEventConflictError";
  }
}

function payloadHash(input: InboundTransferInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        transferId: input.transferId,
        transferNo: input.transferNo,
        destinationBranchCode: input.destinationBranchCode,
        eventType: input.eventType,
        occurredAt: input.occurredAt.toISOString(),
        metadata: input.metadata || null,
        items: input.items,
      }),
    )
    .digest("hex");
}

export class InboundTransfersService {
  static async receive(input: InboundTransferInput) {
    const hash = payloadHash(input);

    try {
      return await prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findUnique({
          where: { code: input.destinationBranchCode },
          select: { id: true, code: true },
        });
        if (!branch) {
          throw new Error(
            `Destination branch '${input.destinationBranchCode}' not found.`,
          );
        }
        if (!config.pasaloAllowedBranchCodes.includes(branch.code)) {
          const error = new Error(
            `Destination branch '${branch.code}' is not authorized for PASALO store sync.`,
          );
          (error as any).statusCode = 403;
          throw error;
        }

        const existing = await tx.storeSyncEvent.findUnique({
          where: { event_id: input.eventId },
        });
        if (existing) {
          if (existing.payload_hash !== hash)
            throw new StoreSyncEventConflictError();
          return {
            ...(existing.response_body as object),
            alreadyProcessed: true,
          };
        }

        const mappedItems = await Promise.all(
          input.items.map(async (item) => ({
            item,
            product: await tx.product.findUnique({
              where: { pasalo_product_id: item.productId },
              select: { id: true, cost_price: true, name: true },
            }),
          })),
        );
        const missingMappings = mappedItems
          .filter(({ product }) => !product)
          .map(({ item }) => item.productId);

        if (missingMappings.length > 0) {
          logger.error(
            "Inbound PASALO transfer rejected because product mappings are missing",
            undefined,
            {
              transferId: input.transferId,
              transferNo: input.transferNo,
              destinationBranchCode: input.destinationBranchCode,
              missingMappings,
            },
          );
          throw new MissingPasaloProductMappingsError(missingMappings);
        }

        const actor = await tx.user.findFirst({
          where: { is_active: true, role: { name: { in: ["CEO", "ADMIN"] } } },
          select: { id: true },
        });
        if (!actor)
          throw new Error(
            "No active CEO or ADMIN user is available for webhook inventory entries.",
          );

        await tx.storeSyncEvent.create({
          data: {
            event_id: input.eventId,
            transfer_id: input.transferId,
            destination_branch_id: branch.id,
            event_type: input.eventType,
            occurred_at: input.occurredAt,
            payload_hash: hash,
            metadata: input.metadata as Prisma.InputJsonValue | undefined,
          },
        });

        const processedItems = [];
        for (const { item, product } of mappedItems) {
          if (!product)
            throw new MissingPasaloProductMappingsError([item.productId]);
          const result = await InventoryService.recordMovementTx(tx, {
            productId: product.id,
            locationType: "BRANCH",
            locationId: branch.id,
            movementType: InventoryMovementType.TRANSFER_IN,
            quantity: item.quantity,
            unitCost: product.cost_price,
            referenceType: "PASALO_TRANSFER",
            referenceId: input.transferId,
            userId: actor.id,
            notes: `PASALO transfer ${input.transferNo}`,
          });
          processedItems.push({
            pasaloProductId: item.productId,
            productId: product.id,
            quantity: item.quantity,
            stockBalanceId: result.updatedBalance.id,
          });
        }

        const response = {
          transferId: input.transferId,
          transferNo: input.transferNo,
          destinationBranchCode: branch.code,
          branchId: branch.id,
          processedItems,
        };
        await tx.storeSyncEvent.update({
          where: { event_id: input.eventId },
          data: { response_body: response },
        });
        return response;
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
      const existing = await prisma.storeSyncEvent.findUnique({
        where: { event_id: input.eventId },
      });
      if (!existing) throw err;
      if (existing.payload_hash !== hash)
        throw new StoreSyncEventConflictError();
      return { ...(existing.response_body as object), alreadyProcessed: true };
    }
  }
}
