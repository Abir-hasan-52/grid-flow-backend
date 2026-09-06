-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "powerZoneId" TEXT;

-- CreateIndex
CREATE INDEX "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");

-- CreateIndex
CREATE INDEX "Announcement_powerZoneId_idx" ON "Announcement"("powerZoneId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_powerZoneId_fkey" FOREIGN KEY ("powerZoneId") REFERENCES "PowerZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
