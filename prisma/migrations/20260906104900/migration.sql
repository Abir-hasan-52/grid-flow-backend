/*
  Warnings:

  - You are about to drop the column `profileImage` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "profileImage",
ADD COLUMN     "ImagePublicId" TEXT DEFAULT '',
ADD COLUMN     "ImageUrl" TEXT DEFAULT '';
