import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ScheduleController } from "./schedule.controller";
import { ScheduleValidation } from "./schedule.validation";
// import { ScheduleValidation } from "./Schedule.validation";
 

const router = Router();

router.post(
  "/create",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(ScheduleValidation.createScheduleSchema),
  ScheduleController.createSchedule,
);

router.get(
  "/get-all",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  ScheduleController.getAllSchedules,
);

router.get(
  "/single/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  ScheduleController.getScheduleById,
);

router.patch(
  "/update/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(ScheduleValidation.updateScheduleSchema),
  ScheduleController.updateSchedule,
);

// Approve is ADMIN-only (confirmed business rule)
router.patch(
  "/:id/approve",
  auth(Role.ADMIN),
  ScheduleController.approveSchedule,
);

router.patch(
  "/:id/cancel",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  ScheduleController.cancelSchedule,
);

export const ScheduleRoutes = router;