import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { config } from "../../src/config/index.js";
import { inboundTransferSchema } from "../../src/modules/sync/inbound-transfers.schema.js";
import { InboundTransfersService } from "../../src/modules/sync/inbound-transfers.service.js";
import { InventoryService } from "../../src/modules/inventory/inventory.service.js";
import { SalesService } from "../../src/modules/sales/sales.service.js";

const suffix = `${Date.now()}`;
const branchCode = `SYNC-BRANCH-${suffix}`;
const otherBranchCode = `SYNC-OTHER-${suffix}`;
const pasaloProductId = `pasalo-product-${suffix}`;
const transferPrefix = `sync-transfer-${suffix}`;
const webhookSecret = `sync-secret-${suffix}`;

let branchId: string;
let otherBranchId: string;
let productId: string;
let categoryId: string;
let unitId: string;
let actorId: string;

const input = (eventId: string, quantity = 10, destinationBranchCode = branchCode, productExternalId = pasaloProductId) => ({
  eventId: `${suffix}-${eventId}`,
  transferId: `${transferPrefix}-${eventId}`,
  transferNo: `SYNC-${eventId}`,
  destinationBranchCode,
  eventType: "STOCK_TRANSFER",
  occurredAt: new Date("2026-09-24T10:00:00.000Z"),
  items: [{ productId: productExternalId, quantity }],
});

function webhookHeaders(body: any, overrides: Record<string, string> = {}) {
  return {
    "X-Pasalo-Webhook-Secret": webhookSecret,
    "X-Event-Id": body.eventId,
    "X-Payload-Sha256": createHash("sha256").update(JSON.stringify(body)).digest("hex"),
    ...overrides,
  };
}

async function localTransfer(eventId: string) {
  return prisma.stockTransfer.findUniqueOrThrow({
    where: { external_transfer_id: `${transferPrefix}-${eventId}` },
    include: { items: true },
  });
}

async function receive(eventId: string, key: string, storeId = branchId) {
  const transfer = await localTransfer(eventId);
  return InventoryService.receiveStockTransfer(
    transfer.id,
    { items: transfer.items.map((item) => ({ productId: item.product_id, quantity: Number(item.quantity) })) },
    actorId,
    storeId,
    key,
  );
}

async function balanceQuantity(storeId = branchId) {
  const balance = await prisma.stockBalance.findUnique({
    where: { product_id_location_id: { product_id: productId, location_id: storeId } },
  });
  return Number(balance?.quantity ?? 0);
}

describe("PASALO dispatch -> physical store receipt integration", () => {
  beforeAll(async () => {
    const [branch, otherBranch] = await Promise.all([
      prisma.branch.create({ data: { code: branchCode, name: "Sync Test Branch" } }),
      prisma.branch.create({ data: { code: otherBranchCode, name: "Other Test Branch" } }),
    ]);
    branchId = branch.id;
    otherBranchId = otherBranch.id;
    (config as any).pasaloWebhookSecret = webhookSecret;
    (config as any).pasaloAllowedBranchCodes = [branchCode, otherBranchCode];
    (config as any).pasaloReceiptAckUrl = "https://pasalo.test/api/integrations/store-receipts";

    const category = await prisma.category.create({ data: { name: `Sync Category ${suffix}` } });
    categoryId = category.id;
    const unit = await prisma.unit.create({ data: { name: `Sync Unit ${suffix}`, abbreviation: "pc" } });
    unitId = unit.id;
    const product = await prisma.product.create({
      data: {
        sku: `SYNC-SKU-${suffix}`,
        pasalo_product_id: pasaloProductId,
        name: "Sync Test Product",
        category_id: categoryId,
        unit_id: unitId,
        cost_price: 10,
        selling_price: 15,
      },
    });
    productId = product.id;
    const role = await prisma.role.upsert({
      where: { name: "CEO" }, update: {}, create: { name: "CEO", description: "Sync integration actor" },
    });
    const actor = await prisma.user.create({
      data: {
        username: `sync-actor-${suffix}`,
        email: `sync-actor-${suffix}@example.com`,
        password_hash: "test-hash",
        full_name: "Sync Actor",
        role_id: role.id,
        branch_id: branchId,
      },
    });
    actorId = actor.id;
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.inventoryTransaction.deleteMany({ where: { product_id: productId } });
    await prisma.stockBalance.deleteMany({ where: { product_id: productId } });
    await prisma.transferReceipt.deleteMany({
      where: { transfer: { external_transfer_id: { startsWith: transferPrefix } } },
    });
    await prisma.stockTransfer.deleteMany({ where: { external_transfer_id: { startsWith: transferPrefix } } });
    await prisma.storeSyncEvent.deleteMany({ where: { transfer_id: { startsWith: transferPrefix } } });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const sales = await prisma.sale.findMany({ where: { cashier_id: actorId }, select: { id: true } });
    const journals = await prisma.journalEntry.findMany({
      where: { reference_type: "SALE", reference_id: { in: sales.map((sale) => sale.id) } }, select: { id: true },
    });
    await prisma.ledgerEntry.deleteMany({ where: { journal_entry_id: { in: journals.map((entry) => entry.id) } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journals.map((entry) => entry.id) } } });
    await prisma.sale.deleteMany({ where: { cashier_id: actorId } });
    await prisma.idempotencyKey.deleteMany({ where: { key: { startsWith: `sync-${suffix}` } } });
    await prisma.inventoryTransaction.deleteMany({ where: { product_id: productId } });
    await prisma.stockBalance.deleteMany({ where: { product_id: productId } });
    await prisma.transferReceipt.deleteMany({
      where: { transfer: { external_transfer_id: { startsWith: transferPrefix } } },
    });
    await prisma.stockTransfer.deleteMany({ where: { external_transfer_id: { startsWith: transferPrefix } } });
    await prisma.storeSyncEvent.deleteMany({ where: { transfer_id: { startsWith: transferPrefix } } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchId, otherBranchId] } } });
  });

  it("registers dispatch as IN_TRANSIT without increasing store inventory", async () => {
    const result = await InboundTransfersService.receive(input("dispatch", 30));
    expect(result.status).toBe("IN_TRANSIT");
    expect(await balanceQuantity()).toBe(0);
    expect(await prisma.inventoryTransaction.count({ where: { product_id: productId } })).toBe(0);
    expect((await localTransfer("dispatch")).destination_location_id).toBe(branchId);
  });

  it("posts exact store stock once on physical receipt and acknowledges PASALO", async () => {
    await InboundTransfersService.receive(input("receipt", 30));
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);
    const receipt = await receive("receipt", `sync-${suffix}-receipt`);
    expect(receipt.status).toBe("COMPLETED");
    expect(receipt.acknowledgement.status).toBe("ACKNOWLEDGED");
    expect(await balanceQuantity()).toBe(30);
    expect(await prisma.inventoryTransaction.count({ where: { product_id: productId } })).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`${transferPrefix}-receipt`),
      expect.objectContaining({ headers: expect.objectContaining({ "x-pasalo-webhook-secret": webhookSecret }) }),
    );
  });

  it("returns the existing receipt on duplicate confirmation without another stock posting", async () => {
    await InboundTransfersService.receive(input("duplicate", 30));
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);
    const first = await receive("duplicate", `sync-${suffix}-duplicate-1`);
    const replay = await receive("duplicate", `sync-${suffix}-duplicate-2`);
    expect(replay.id).toBe(first.id);
    expect(await balanceQuantity()).toBe(30);
    expect(await prisma.inventoryTransaction.count({ where: { product_id: productId } })).toBe(1);
  });

  it("survives a lost acknowledgement and retries without duplicating stock", async () => {
    await InboundTransfersService.receive(input("lost-ack", 30));
    const fetchMock = vi.spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const first = await receive("lost-ack", `sync-${suffix}-lost-1`);
    expect(first.acknowledgement.status).toBe("PENDING");
    expect(await balanceQuantity()).toBe(30);
    const replay = await receive("lost-ack", `sync-${suffix}-lost-2`);
    expect(replay.id).toBe(first.id);
    expect(replay.acknowledgement.status).toBe("ACKNOWLEDGED");
    expect(await balanceQuantity()).toBe(30);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a wrong-store receiver before any inventory mutation", async () => {
    await InboundTransfersService.receive(input("wrong-store", 30));
    await expect(receive("wrong-store", `sync-${suffix}-wrong`, otherBranchId)).rejects.toMatchObject({ statusCode: 403 });
    expect(await balanceQuantity()).toBe(0);
    expect(await balanceQuantity(otherBranchId)).toBe(0);
  });

  it("rolls back receipt state when inventory posting fails", async () => {
    await InboundTransfersService.receive(input("inventory-failure", 30));
    vi.spyOn(InventoryService, "recordMovementTx").mockRejectedValueOnce(new Error("forced inventory failure"));
    await expect(receive("inventory-failure", `sync-${suffix}-failure`)).rejects.toThrow("forced inventory failure");
    expect(await balanceQuantity()).toBe(0);
    const transfer = await localTransfer("inventory-failure");
    expect(transfer.status).toBe("IN_TRANSIT");
    expect(await prisma.transferReceipt.count({ where: { transfer_id: transfer.id } })).toBe(0);
  });

  it("rejects unknown product mappings and quantity discrepancies safely", async () => {
    await expect(InboundTransfersService.receive(input("unknown", 1, branchCode, "missing-product"))).rejects.toThrow();
    expect(() => inboundTransferSchema.parse(input("zero", 0))).toThrow();
    await InboundTransfersService.receive(input("discrepancy", 30));
    const transfer = await localTransfer("discrepancy");
    await expect(InventoryService.receiveStockTransfer(
      transfer.id,
      { items: [{ productId, quantity: 29 }] },
      actorId,
      branchId,
      `sync-${suffix}-discrepancy`,
    )).rejects.toMatchObject({ statusCode: 409 });
    expect(await balanceQuantity()).toBe(0);
  });

  it("authenticates and idempotently registers the signed dispatch webhook", async () => {
    const body = input("http", 10);
    const unauthorized = await request(app).post("/api/sync/inbound-transfers").send(body);
    expect(unauthorized.status).toBe(401);
    const first = await request(app).post("/api/sync/inbound-transfers").set(webhookHeaders(body)).send(body);
    const replay = await request(app).post("/api/sync/inbound-transfers").set(webhookHeaders(body)).send(body);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.data.alreadyProcessed).toBe(true);
    expect(await balanceQuantity()).toBe(0);
    expect(await prisma.stockTransfer.count({ where: { external_transfer_id: body.transferId } })).toBe(1);
  });

  it("keeps received inventory available to POS and isolated to the destination store", async () => {
    await InboundTransfersService.receive(input("pos", 10));
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);
    await receive("pos", `sync-${suffix}-pos-receipt`);
    await SalesService.createSaleTransaction(
      {
        branchId,
        channel: "RETAIL",
        taxAmount: 0,
        items: [{ productId, quantity: 2, unitPrice: 15 }],
        payments: [{ paymentMethod: "CASH", amount: 30 }],
      },
      actorId,
      { role: "CEO", branchId },
      `sync-${suffix}-pos-sale`,
    );
    expect(await balanceQuantity()).toBe(8);
    expect(await balanceQuantity(otherBranchId)).toBe(0);
  });
});
