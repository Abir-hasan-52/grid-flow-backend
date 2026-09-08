import { z } from "zod";
import { Role, UserStatus } from "../../../../generated/prisma/enums";

const createAdminSchema = z.object({
  name: z.string({ message: "Name is required" }).min(2),
  email: z.email(),
});

const createZoneManagerSchema = z.object({
  name: z.string({ message: "Name is required" }).min(2),
  email: z.email(),
  managedZoneId: z.string({ message: "Zone is required" }).min(1),
});


const getAllUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  sortBy: z
    .enum(["name", "email", "createdAt", "updatedAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const AdminUserValidation = {
  createAdminSchema,
  createZoneManagerSchema,
  getAllUsersQuerySchema,
};