/*
  Warnings:

  - A unique constraint covering the columns `[bkashPaymentId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bkashPaymentId" TEXT,
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bkashPaymentId_key" ON "Payment"("bkashPaymentId");

-- CreateIndex
CREATE INDEX "Payment_bkashPaymentId_idx" ON "Payment"("bkashPaymentId");
