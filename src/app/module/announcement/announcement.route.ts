import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AnnouncementController } from "./announcement.controller";
import { AnnouncementValidation } from "./announcement.validation";

const router = Router();

router.post(
  "/create",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(AnnouncementValidation.createAnnouncementSchema),
  AnnouncementController.createAnnouncement,
);

router.get(
  "/drafts",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  AnnouncementController.getAnnouncements,
);

router.get(
  "/drafts/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  AnnouncementController.getAnnouncementById,
);

router.patch(
  "/drafts/:id/update",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(AnnouncementValidation.updateAnnouncementSchema),
  AnnouncementController.updateAnnouncement,
);

router.patch(
  "/drafts/:id/publish",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  AnnouncementController.publishAnnouncement,
);

router.delete(
  "/publish/:id",
  auth(Role.ADMIN),
  AnnouncementController.deleteAnnouncement,
);

export const AnnouncementRoutes = router;