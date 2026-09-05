/** biome-ignore-all assist/source/organizeImports: <explanation> */
import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";
import { AuthController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post("/register", AuthController.registerPatient);
router.post("/login", AuthController.loginUser);
router.get(
	"/me",
	auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN, Role.ZONE_MANAGER),
	AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);

router.post("/google", AuthController.googleLogin);
router.post("/forgot-password",
  validateRequest(AuthValidation.forgotCustomerValidation),
  AuthController.forgotPassword);
router.post("/reset-password", 
  validateRequest(AuthValidation.resetCustomerValidation),
  AuthController.resetPassword);

export const AuthRoutes = router;
