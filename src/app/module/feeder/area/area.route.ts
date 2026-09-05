import { Router } from "express";
import { AreaController } from "./area.controller";
import { AreaValidation } from "./area.validation";
import { auth } from "../../../middleware/checkAuth";
import { Role } from "../../../../../generated/prisma/enums";
import { validateRequest } from "../../../middleware/validateRequest";

const router = Router();

router.post(
	"/create-area",
	auth(Role.ADMIN),
	validateRequest(AreaValidation.createAreaSchema),
	AreaController.createArea,
);

// Public — no auth. Needed for the registration dropdown (customer picks their area
// before an account/token exists) and for anyone checking outage status by area.
router.get("/all-areas", AreaController.getAllAreas);
router.get("/get-area/:id", AreaController.getSingleArea);

router.patch(
	"/update-area/:id",
	auth(Role.ADMIN),
	validateRequest(AreaValidation.updateAreaSchema),
	AreaController.updateArea,
);

router.delete("/delete-area/:id", auth(Role.ADMIN), AreaController.deleteArea);

export const AreaRoutes = router;
