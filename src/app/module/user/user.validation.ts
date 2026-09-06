import { z } from "zod";

const updateMyProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(11, "Phone number must be at least 11 characters long").optional(),
  areaId: z.string().optional(),
});

export const UserValidation = {
  updateMyProfileSchema,
};