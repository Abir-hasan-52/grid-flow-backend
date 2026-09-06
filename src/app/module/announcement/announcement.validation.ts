import { z } from "zod";
import { AnnouncementType } from "../../../../generated/prisma/enums";

const createAnnouncementSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(2, "Title must be at least 2 characters")
    .max(200, "Title must not exceed 200 characters"),

  content: z
    .string({ message: "Content is required" })
    .min(10, "Content must be at least 10 characters"),

  type: z
    .enum(AnnouncementType, {
      message: "Invalid announcement type",
    })
    .optional(),

  powerZoneId: z
    .string()
    .min(1, "Invalid power zone ID")
    .optional(),
});

export const AnnouncementValidation = {
  createAnnouncementSchema,
};