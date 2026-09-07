import { z } from "zod";

const createOutageReportSchema = z.object({
  description: z.string().optional(),
});

const createManualOutageSchema = z.object({
  feederId: z.string({ message: "Feeder id is required" }).min(1),
});

export const OutageValidation = {
  createOutageReportSchema,
  createManualOutageSchema,
};