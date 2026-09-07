import { z } from "zod";

const createAdminSchema = z.object({
  name: z.string({ message: "Name is required" }).min(2),
  email: z.email(),
});

const createZoneManagerSchema = z.object({
  name: z.string({ message: "Name is required" }).min(2),
  email: z.email(),
  managedZoneId: z.string({ message: "Zone is required" }).min(1),
});

export const AdminUserValidation = {
  createAdminSchema,
  createZoneManagerSchema,
};