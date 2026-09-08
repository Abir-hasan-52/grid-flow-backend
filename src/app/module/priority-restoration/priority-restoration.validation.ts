import { z } from "zod";

const createPriorityRequestSchema = z.object({
  outageId: z.string({ message: "Outage id is required" }).min(1),
  reason: z.string().optional(),
});

export const PriorityRestorationValidation = {
  createPriorityRequestSchema,
};