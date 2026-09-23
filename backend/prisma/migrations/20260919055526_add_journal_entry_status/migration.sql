-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED', 'VOIDED');

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "reversal_of_journal_entry_id" TEXT,
ADD COLUMN     "reversal_reason" TEXT,
ADD COLUMN     "reversed_at" TIMESTAMP(3),
ADD COLUMN     "reversed_by" TEXT,
ADD COLUMN     "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_journal_entry_id_fkey" FOREIGN KEY ("reversal_of_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
