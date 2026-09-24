import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { inboundTransferSchema } from "../../src/modules/sync/inbound-transfers.schema.js";
import { InboundTransfersService } from "../../src/modules/sync/inbound-transfers.service.js";
import { SalesService } from "../../src/modules/sales/sales.service.js";
import { config } from "../../src/config/index.js";
import { createHash } from "node:crypto";

const suffix = Date.now().toString();
const branchCode = `SYNC-BRANCH-${suffix}`;
const productPasaloId = `pasalo-product-${suffix}`;
const transferPrefix = `sync-transfer-${suffix}`;
const webhookSecret = `sync-secret-${suffix}`;

let branchId: string;
let productId: string;
let categoryId: string;
let unitId: string;
let actorId: string;

const input = (
  eventId: string,
  quantity = 10,
  destinationBranchCode = branchCode,
  pasaloProductId = productPasaloId,
) => ({
  eventId,
  transferId: `${transferPrefix}-${eventId}`,
  transferNo: `SYNC-${eventId}`,
  destinationBranchCode,
  eventType: "STOCK_TRANSFER",
  occurredAt: new Date("2026-09-24T10:00:00.000Z"),
  items: [{ productId: pasaloProductId, quantity }],
});

function webhookHeaders(body: any, overrides: Record<string, string> = {}) {
  return {
    "X-Pasalo-Webhook-Secret": webhookSecret,
    "X-Event-Id": body.eventId,
    "X-Payload-Sha256": createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex"),
    ...overrides,
  };
}

async function balanceQuantity() {
  const balance = await prisma.stockBalance.findUnique({
    where: {
      product_id_location_id: { product_id: productId, location_id: branchId },
    },
  });
  return Number(balance?.quantity || 0);
}

describe("PASALO store-sync receiver integration", () => {
  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: { code: branchCode, name: "Sync Test Branch" },
    });
    branchId = branch.id;
    (config as any).pasaloWebhookSecret = webhookSecret;
    (config as any).pasaloAllowedBranchCodes = [branchCode];

    const category = await prisma.category.create({
      data: { name: `Sync Category ${suffix}` },
    });
    categoryId = category.id;
    const unit = await prisma.unit.create({
      data: { name: `Sync Unit ${suffix}`, abbreviation: "pc" },
    });
    unitId = unit.id;
    const product = await prisma.product.create({
      data: {
        sku: `SYNC-SKU-${suffix}`,
        pasalo_product_id: productPasaloId,
        name: "Sync Test Product",
        category_id: categoryId,
        unit_id: unitId,
        cost_price: 10,
        selling_price: 15,
      },
    });
    productId = product.id;

    const role = await prisma.role.upsert({
      where: { name: "CEO" },
      update: {},
      create: { name: "CEO", description: "Sync integration actor" },
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
    await prisma.storeSyncEvent.deleteMany({
      where: { transfer_id: { startsWith: transferPrefix } },
    });
    await prisma.inventoryTransaction.deleteMany({
      where: { product_id: productId },
    });
    await prisma.stockBalance.deleteMany({ where: { product_id: productId } });
  });

  afterAll(async () => {
    const sales = await prisma.sale.findMany({ where: { cashier_id: actorId }, select: { id: true } });
    const journalEntries = await prisma.journalEntry.findMany({
      where: { reference_type: 'SALE', reference_id: { in: sales.map((sale) => sale.id) } },
      select: { id: true },
    });
    await prisma.ledgerEntry.deleteMany({ where: { journal_entry_id: { in: journalEntries.map((entry) => entry.id) } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalEntries.map((entry) => entry.id) } } });
    await prisma.sale.deleteMany({ where: { cashier_id: actorId } });
    await prisma.idempotencyKey.deleteMany({ where: { key: `sale-replay-${suffix}` } });
    await prisma.storeSyncEvent.deleteMany({
      where: { transfer_id: { startsWith: transferPrefix } },
    });
    await prisma.inventoryTransaction.deleteMany({
      where: { product_id: productId },
    });
    await prisma.stockBalance.deleteMany({ where: { product_id: productId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.branch.delete({ where: { id: branchId } });
  });

  it("receives stock and records one durable event", async () => {
    const result = await InboundTransfersService.receive(input("event-1", 50));

    expect(result.processedItems).toHaveLength(1);
    expect(await balanceQuantity()).toBe(50);
    expect(
      await prisma.storeSyncEvent.count({ where: { event_id: "event-1" } }),
    ).toBe(1);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(1);
  });

  it("replays the same event without a second movement", async () => {
    await InboundTransfersService.receive(input("event-2", 50));
    const replay = await InboundTransfersService.receive(input("event-2", 50));

    expect(replay.alreadyProcessed).toBe(true);
    expect(await balanceQuantity()).toBe(50);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(1);
  });

  it("serializes concurrent duplicate deliveries", async () => {
    const results = await Promise.all([
      InboundTransfersService.receive(input("event-3", 50)),
      InboundTransfersService.receive(input("event-3", 50)),
    ]);

    expect(results.filter((result) => result.alreadyProcessed).length).toBe(1);
    expect(await balanceQuantity()).toBe(50);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(1);
  });

  it("rolls back event processing when the inventory write fails, then retries", async () => {
    await expect(
      InboundTransfersService.receive(
        input("event-4", Number.MAX_SAFE_INTEGER),
      ),
    ).rejects.toThrow();
    expect(
      await prisma.storeSyncEvent.count({ where: { event_id: "event-4" } }),
    ).toBe(0);
    expect(await balanceQuantity()).toBe(0);

    await InboundTransfersService.receive(input("event-4", 7));
    expect(await balanceQuantity()).toBe(7);
  });

  it("rejects invalid store, product, quantity, and payload redirection", async () => {
    await expect(
      InboundTransfersService.receive(input("event-5", 1, "missing-store")),
    ).rejects.toThrow("not found");
    await expect(
      InboundTransfersService.receive(
        input("event-6", 1, branchCode, "missing-product"),
      ),
    ).rejects.toThrow();
    expect(() => inboundTransferSchema.parse(input("event-7", 0))).toThrow();

    await InboundTransfersService.receive(input("event-8", 5));
    await expect(InboundTransfersService.receive(input("event-8", 6))).rejects.toThrow("different payload");
    const otherBranch = await prisma.branch.create({
      data: { code: `SYNC-OTHER-${suffix}`, name: "Other Sync Branch" },
    });
    await expect(
      InboundTransfersService.receive(input("event-8", 5, otherBranch.code)),
    ).rejects.toThrow("not authorized");
    await prisma.branch.delete({ where: { id: otherBranch.id } });
    expect(await balanceQuantity()).toBe(5);
  });

  it("allows two distinct event IDs to create two legitimate movements", async () => {
    await InboundTransfersService.receive(input("event-9", 5));
    await InboundTransfersService.receive(input("event-10", 7));

    expect(await balanceQuantity()).toBe(12);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(2);
  });

  it("keeps the received stock available for POS deduction", async () => {
    await InboundTransfersService.receive(input("event-11", 10));
    await SalesService.createSaleTransaction(
      {
        branchId,
        channel: "RETAIL",
        taxAmount: 0,
        items: [{ productId, quantity: 3, unitPrice: 15 }],
        payments: [{ paymentMethod: "CASH", amount: 45 }],
      },
      actorId,
      { role: "CEO", branchId },
    );

    expect(await balanceQuantity()).toBe(7);
  });

  it("rejects an unauthenticated receiver request", async () => {
    const response = await request(app)
      .post("/api/sync/inbound-transfers")
      .send(input("unauthorized-event", 1));

    expect([401, 503]).toContain(response.status);
    expect(response.body.success).toBe(false);
  });

  it("accepts the canonical signed contract and replays without another movement", async () => {
    const body = input("http-replay-event", 10);
    const first = await request(app)
      .post("/api/sync/inbound-transfers")
      .set(webhookHeaders(body))
      .send(body);
    const replay = await request(app)
      .post("/api/sync/inbound-transfers")
      .set(webhookHeaders(body))
      .send(body);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.data.alreadyProcessed).toBe(true);
    expect(await balanceQuantity()).toBe(10);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(1);
  });

  it("rejects missing and invalid secrets without inventory mutation, then accepts a valid retry", async () => {
    const body = input("http-auth-retry", 4);
    const missing = await request(app)
      .post("/api/sync/inbound-transfers")
      .send(body);
    const invalid = await request(app)
      .post("/api/sync/inbound-transfers")
      .set(webhookHeaders(body, { "X-Pasalo-Webhook-Secret": "wrong" }))
      .send(body);
    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(await balanceQuantity()).toBe(0);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(0);
    const retry = await request(app)
      .post("/api/sync/inbound-transfers")
      .set(webhookHeaders(body))
      .send(body);
    expect(retry.status).toBe(201);
    expect(await balanceQuantity()).toBe(4);
  });

  it("rejects payload tampering and event identity mismatch before mutation", async () => {
    const body = input("http-integrity-event", 5);
    const badHash = await request(app)
      .post("/api/sync/inbound-transfers")
      .set(webhookHeaders(body, { "X-Payload-Sha256": "0".repeat(64) }))
      .send(body);
    const badEventId = await request(app)
      .post("/api/sync/inbound-transfers")
      .set(webhookHeaders(body, { "X-Event-Id": "another-event" }))
      .send(body);
    expect(badHash.status).toBe(400);
    expect(badEventId.status).toBe(400);
    expect(await balanceQuantity()).toBe(0);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(0);
  });

  it("rejects an existing but unauthorized destination branch before mutation", async () => {
    const otherBranch = await prisma.branch.create({
      data: { code: `SYNC-REDIRECT-${suffix}`, name: "Unauthorized branch" },
    });
    const body = input("http-redirection-event", 5, otherBranch.code);
    const response = await request(app)
      .post("/api/sync/inbound-transfers")
      .set(webhookHeaders(body))
      .send(body);
    expect(response.status).toBe(403);
    expect(
      await prisma.stockBalance.count({ where: { product_id: productId } }),
    ).toBe(0);
    expect(
      await prisma.storeSyncEvent.count({ where: { event_id: body.eventId } }),
    ).toBe(0);
    await prisma.branch.delete({ where: { id: otherBranch.id } });
  });

  it("keeps a sale and its inventory and journal writes idempotent beyond 24 hours", async () => {
    await InboundTransfersService.receive(input("full-flow-event", 10));
    const saleInput = {
      branchId,
      channel: "RETAIL" as const,
      taxAmount: 0,
      items: [{ productId, quantity: 3, unitPrice: 15 }],
      payments: [{ paymentMethod: "CASH" as const, amount: 45 }],
    };
    const key = `sale-replay-${suffix}`;
    const first = (await SalesService.createSaleTransaction(
      saleInput,
      actorId,
      { role: "CEO", branchId },
      key,
    )) as any;
    const storedSaleKey = await prisma.idempotencyKey.findUniqueOrThrow({
      where: { key },
    });
    await prisma.idempotencyKey.update({
      where: { key },
      data: { expires_at: new Date("2020-01-01T00:00:00Z") },
    });
    const replay = (await SalesService.createSaleTransaction(
      saleInput,
      actorId,
      { role: "CEO", branchId },
      key,
    )) as any;
    expect(replay.id).toBe(first.id);
    expect(await balanceQuantity()).toBe(7);
    expect(await prisma.sale.count({ where: { id: first.id } })).toBe(1);
    expect(
      await prisma.inventoryTransaction.count({
        where: { product_id: productId },
      }),
    ).toBe(2);
    expect(
      await prisma.journalEntry.count({
        where: { reference_type: "SALE", reference_id: first.id },
      }),
    ).toBe(1);
    expect(storedSaleKey.request_hash).toBeTruthy();
    await expect(
      SalesService.createSaleTransaction(
        {
          ...saleInput,
          items: [{ productId, quantity: 2, unitPrice: 15 }],
          payments: [{ paymentMethod: "CASH", amount: 30 }],
        },
        actorId,
        { role: "CEO", branchId },
        key,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
