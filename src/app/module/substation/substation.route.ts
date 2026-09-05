import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";
import { SubstationValidation } from "./substation.validation";
import { SubstationController } from "./substation.controller";

const router = Router();
router.post(
  "/create-substation",
  auth(Role.ADMIN),
  validateRequest(SubstationValidation.createSubstationValidationSchema),
  SubstationController.createSubstation,
);
router.get(
  "/all-substations",
  // auth(Role.ADMIN, Role.ZONE_MANAGER),
  // SubstationController.getAllSubstations,
);
router.get(
  "/substation/:id",
  // auth(Role.ADMIN, Role.ZONE_MANAGER),
  // SubstationController.getSingleSubstation,
);
router.patch(
  "/update-substation/:id",
  auth(Role.ADMIN),
    validateRequest(SubstationValidation.updateSubstationValidationSchema),
    SubstationController.updateSubstation,
);
router.delete(
  "/delete-substation/:id",
  auth(Role.ADMIN),
  SubstationController.deleteSubstation,
);

export const SubstationRoutes = router;
