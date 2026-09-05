/** biome-ignore-all assist/source/organizeImports: <explanation> */
import { Router } from "express";
import { AreaController } from "./area.controller";
import { AreaValidation } from "./area.validation";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

router.post(
	"/create-area",
	auth(Role.ADMIN),
	validateRequest(AreaValidation.createAreaSchema),
	AreaController.createArea,
);

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
