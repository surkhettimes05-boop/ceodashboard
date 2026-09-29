import { Prisma, TransferStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
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

        const inboundTransfer = await tx.stockTransfer.create({
          data: {
            transfer_number: `PASALO-${input.transferNo}`,
            source_location_id: "PASALO:CENTRAL_WAREHOUSE",
            destination_location_id: branch.id,
            status: TransferStatus.IN_TRANSIT,
            notes: `Inbound from PASALO.OS (${input.transferId})`,
            created_by: actor.id,
            source_system: "PASALO",
            external_transfer_id: input.transferId,
            source_label: "Central Warehouse",
            items: {
              create: mappedItems.map(({ item, product }) => ({
                product_id: product!.id,
                quantity: item.quantity,
              })),
            },
          },
          include: {
            items: { include: { product: { select: { id: true, sku: true, name: true } } } },
          },
        });

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

        const response = {
          transferId: input.transferId,
          transferNo: input.transferNo,
          destinationBranchCode: branch.code,
          branchId: branch.id,
          inboundTransferId: inboundTransfer.id,
          status: inboundTransfer.status,
          items: mappedItems.map(({ item, product }) => ({
            pasaloProductId: item.productId,
            productId: product!.id,
            quantity: item.quantity,
          })),
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
      if (!existing) {
        const transfer = await prisma.stockTransfer.findUnique({
          where: { external_transfer_id: input.transferId },
          include: { items: { include: { product: { select: { pasalo_product_id: true } } } } },
        });
        if (transfer) {
          const branch = await prisma.branch.findUnique({
            where: { id: transfer.destination_location_id },
            select: { code: true },
          });
          const existingItems = transfer.items
            .map((item) => ({ productId: item.product.pasalo_product_id, quantity: Number(item.quantity) }))
            .sort((a, b) => String(a.productId).localeCompare(String(b.productId)));
          const incomingItems = input.items
            .map((item) => ({ productId: item.productId, quantity: item.quantity }))
            .sort((a, b) => a.productId.localeCompare(b.productId));
          if (
            branch?.code !== input.destinationBranchCode ||
            JSON.stringify(existingItems) !== JSON.stringify(incomingItems)
          ) {
            throw new StoreSyncEventConflictError();
          }
          return {
            transferId: input.transferId,
            transferNo: input.transferNo,
            destinationBranchCode: input.destinationBranchCode,
            branchId: transfer.destination_location_id,
            inboundTransferId: transfer.id,
            status: transfer.status,
            alreadyProcessed: true,
          };
        }
        throw err;
      }
      if (existing.payload_hash !== hash)
        throw new StoreSyncEventConflictError();
      return { ...(existing.response_body as object), alreadyProcessed: true };
    }
  }
}
