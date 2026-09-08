import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OutageController } from "./outage.controller";
import { OutageValidation } from "./outage.validation";

// Mounted at /api/v1/outages
const outageRouter = Router();

outageRouter.post(
  "/report",
  auth(Role.CUSTOMER),
  validateRequest(OutageValidation.createOutageReportSchema),
  OutageController.reportOutage,
);

outageRouter.post(
  "/manual",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(OutageValidation.createManualOutageSchema),
  OutageController.createManualOutage,
);

outageRouter.get(
  "/all-reports",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.getAllOutages,
);

outageRouter.get(
  "/single-outage/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.getOutageById,
);

outageRouter.patch(
  "/reports/:id/verify",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.verifyOutage,
);

outageRouter.patch(
  "/close/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.closeOutage,
);

// Mounted at /api/v1/my-reports
// const myReportsRouter = Router();

outageRouter.get(
  "/my-reports",
  auth(Role.CUSTOMER),
  OutageController.getMyReports,
);

export const OutageRoutes = outageRouter;
