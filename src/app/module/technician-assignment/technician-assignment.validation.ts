import { z } from "zod";

const createAssignmentSchema = z.object({
  technicianId: z.string({ message: "Technician id is required" }).min(1),
  isPriority: z.boolean().optional(),
});

const rejectAssignmentSchema = z.object({
  rejectionReason: z.string({ message: "Rejection reason is required" }).min(5),
});

const createRepairUpdateSchema = z.object({
  note: z.string({ message: "Note is required" }).min(3),
});

export const TechnicianAssignmentValidation = {
  createAssignmentSchema,
  rejectAssignmentSchema,
  createRepairUpdateSchema,
};