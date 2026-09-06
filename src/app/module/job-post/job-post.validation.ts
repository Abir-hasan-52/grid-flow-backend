import { z } from "zod";

const createJobPostSchema = z.object({
  title: z.string({ message: "Title is required" }).min(2),
  description: z.string({ message: "Description is required" }).min(10),
  requirements: z.string().optional(),
  deadline: z.coerce.date().refine((date) => date > new Date(), {
    message: "Deadline must be a future date",
  }),
  powerZoneId: z.string().optional(),
});

const updateJobPostSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(10).optional(),
  requirements: z.string().optional(),
  deadline: z.coerce
    .date()
    .refine((date) => date > new Date(), {
      message: "Deadline must be a future date",
    })
    .optional(),
  powerZoneId: z.string().optional(),
});

export const JobPostValidation = {
  createJobPostSchema,
  updateJobPostSchema,
};