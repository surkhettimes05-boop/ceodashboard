-- CreateEnum
CREATE TYPE "RegisterSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_sessions" (
    "id" TEXT NOT NULL,
    "session_number" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "cashier_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "status" "RegisterSessionStatus" NOT NULL DEFAULT 'OPEN',
    "opening_cash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closing_cash" DECIMAL(12,2),
    "expected_cash" DECIMAL(12,2),
    "variance" DECIMAL(12,2),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opened_by" TEXT NOT NULL,
    "closed_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_code_key" ON "cash_registers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "register_sessions_session_number_key" ON "register_sessions"("session_number");

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_sessions" ADD CONSTRAINT "register_sessions_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_sessions" ADD CONSTRAINT "register_sessions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_sessions" ADD CONSTRAINT "register_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
