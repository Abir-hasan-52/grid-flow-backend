import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { DashboardController } from "./dashboard.controller";

const router = Router();

router.get(
  "/",
  auth(Role.ADMIN, Role.ZONE_MANAGER, Role.TECHNICIAN, Role.CUSTOMER),
  DashboardController.getDashboard,
);

export const DashboardRoutes = router;