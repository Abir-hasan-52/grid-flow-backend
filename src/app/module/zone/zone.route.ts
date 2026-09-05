/** biome-ignore-all assist/source/organizeImports: <explanation> */
import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { ZoneValidation } from "./zone.validation";
import { ZoneController } from "./zone.controller";

const router = Router();

router.post(
  "/create-zone",
    auth(Role.ADMIN),
  validateRequest(ZoneValidation.createZoneSchema),
  ZoneController.createZone,
);

router.get(
  "/all-zones",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  ZoneController.getAllZones,
);

router.get(
  "/get-zone/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  ZoneController.getZoneById,
);

router.patch(
  "/update-zone/:id",
  auth(Role.ADMIN),
  validateRequest(ZoneValidation.updateZoneSchema),
  ZoneController.updateZone,
);

router.delete("/delete-zone/:id", auth(Role.ADMIN), ZoneController.deleteZone);

export const ZoneRoutes = router;
