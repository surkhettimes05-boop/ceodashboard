CREATE TABLE "store_sync_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "destination_branch_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "metadata" JSONB,
    "response_body" JSONB,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_sync_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "store_sync_events_event_id_key" ON "store_sync_events"("event_id");
CREATE INDEX "store_sync_events_transfer_id_idx" ON "store_sync_events"("transfer_id");

ALTER TABLE "store_sync_events"
ADD CONSTRAINT "store_sync_events_destination_branch_id_fkey"
FOREIGN KEY ("destination_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;