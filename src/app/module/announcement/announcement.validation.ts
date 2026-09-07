import { z } from "zod";
import { AnnouncementStatus, AnnouncementType } from "../../../../generated/prisma/enums";

const createAnnouncementSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title must not exceed 200 characters"),

  content: z
    .string({ message: "Content is required" })
    .min(10, "Content must be at least 10 characters"),

  type: z
    .enum(AnnouncementType, { message: "Invalid announcement type" })
    .optional(),

  powerZoneId: z.string().min(1, "Invalid power zone ID").optional(),
});

// fix: this was missing entirely -- PATCH /:id had no matching schema
const updateAnnouncementSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  content: z.string().min(10).optional(),
  type: z.enum(AnnouncementType).optional(),
  powerZoneId: z.string().min(1).optional(),
});

const getAllAnnouncementsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  type: z.enum(AnnouncementType).optional(),
  status: z.enum(AnnouncementStatus).optional(),
  powerZoneId: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const AnnouncementValidation = {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  getAllAnnouncementsSchema,
};