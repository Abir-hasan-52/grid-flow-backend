import { z } from "zod";

const createZoneSchema = z.object({
  name: z.string({ message: "Zone name is required" }).min(2),
});

const updateZoneSchema = z.object({
  name: z.string().min(2).optional(),
});

export const ZoneValidation = {
  createZoneSchema,
  updateZoneSchema,
};