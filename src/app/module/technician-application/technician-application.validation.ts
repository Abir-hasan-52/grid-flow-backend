import { z } from "zod";

const createApplicationSchema = z.object({
  experience: z.string().optional(),
});

const rejectApplicationSchema = z.object({
  rejectionReason: z.string({ message: "Rejection reason is required" }).min(5),
});

export const TechnicianApplicationValidation = {
  createApplicationSchema,
  rejectApplicationSchema,
};