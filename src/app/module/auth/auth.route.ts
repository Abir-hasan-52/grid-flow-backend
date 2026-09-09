/** biome-ignore-all assist/source/organizeImports: <explanation> */
import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";
import { AuthController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthValidation } from "./auth.validation";
import { authLimiter } from "../../lib/ratelimiter";

const router = Router();

router.post(
  "/register",authLimiter,
  validateRequest(AuthValidation.registerCustomerValidation),
  AuthController.registerCustomer,
);

router.post(
  "/login",authLimiter,
  validateRequest(AuthValidation.loginValidation),
  AuthController.loginUser,
);

router.post(
  "/verify-email",authLimiter,
  validateRequest(AuthValidation.verifyCustomerEmailValidation),
  AuthController.verifyCustomerEmail,
);

router.get(
  "/me",
  auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN, Role.ZONE_MANAGER),
  AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN, Role.ZONE_MANAGER), AuthController.logoutUser);

router.post("/google",authLimiter, AuthController.googleLogin);

router.post(
  "/forgot-password",authLimiter,
  validateRequest(AuthValidation.forgotCustomerValidation),
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",authLimiter,
  validateRequest(AuthValidation.resetCustomerValidation),
  AuthController.resetPassword,
);

export const AuthRoutes = router;
