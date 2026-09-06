/*
  Warnings:

  - You are about to drop the column `email` on the `TechnicianApplication` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `TechnicianApplication` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `TechnicianApplication` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[jobPostId,applicantId]` on the table `TechnicianApplication` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `applicantId` to the `TechnicianApplication` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TechnicianApplication_jobPostId_email_key";

-- AlterTable
ALTER TABLE "TechnicianApplication" DROP COLUMN "email",
DROP COLUMN "fullName",
DROP COLUMN "phone",
ADD COLUMN     "applicantId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "TechnicianApplication_applicantId_idx" ON "TechnicianApplication"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianApplication_jobPostId_applicantId_key" ON "TechnicianApplication"("jobPostId", "applicantId");

-- AddForeignKey
ALTER TABLE "TechnicianApplication" ADD CONSTRAINT "TechnicianApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
