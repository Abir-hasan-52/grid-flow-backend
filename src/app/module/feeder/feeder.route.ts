import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { FeederController } from "./feeder.controller";
import { FeederValidation } from "./feeder.validation";

const router = Router();

router.post(
	"/create-feeder",
	auth(Role.ADMIN),
	validateRequest(FeederValidation.createFeederSchema),
	FeederController.createFeeder,
);

router.get(
	"/all-feeders",
	auth(Role.ADMIN, Role.ZONE_MANAGER),
	FeederController.getAllFeeders,
);

router.get(
	"/get-feeder/:id",
	auth(Role.ADMIN, Role.ZONE_MANAGER),
	FeederController.getSingleFeeder,
);

router.patch(
	"/update-feeder/:id",
	auth(Role.ADMIN),
	validateRequest(FeederValidation.updateFeederSchema),
	FeederController.updateFeeder,
);

router.delete(
	"/delete-feeder/:id",
	auth(Role.ADMIN),
	FeederController.deleteFeeder,
);

export const FeederRoutes = router;
