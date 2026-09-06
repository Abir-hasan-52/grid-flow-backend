import { Router } from "express";

import { AnnouncementController } from "./announcement.controller";
import { AnnouncementValidation } from "./announcement.validation";

import { validateRequest } from "../../middleware/validateRequest";
import { auth } from "../../middleware/checkAuth";

import { Role } from "../../../../generated/prisma/enums";

const router = Router();

router.post(
  "/create",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(AnnouncementValidation.createAnnouncementSchema),
  AnnouncementController.createAnnouncement,
);

export const AnnouncementRoutes = router;
