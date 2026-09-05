import { z } from "zod";

const forgotCustomerValidation = z.object({
  email: z.email(),
});

const resetCustomerValidation = z.object({
  email: z.email(),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
  otp: z.string().length(6, "OTP must be 6 characters long"),
});

export const AuthValidation = {
  resetCustomerValidation,
  forgotCustomerValidation,
};
