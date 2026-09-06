-- AlterTable
ALTER TABLE "User" ADD COLUMN     "technicianZoneId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_technicianZoneId_fkey" FOREIGN KEY ("technicianZoneId") REFERENCES "PowerZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
