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
  "/",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(OutageValidation.createManualOutageSchema),
  OutageController.createManualOutage,
);

outageRouter.get(
  "/",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.getAllOutages,
);

outageRouter.get(
  "/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.getOutageById,
);

outageRouter.patch(
  "/:id/verify",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.verifyOutage,
);

outageRouter.patch(
  "/:id/close",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  OutageController.closeOutage,
);

// Mounted at /api/v1/my-reports
const myReportsRouter = Router();

myReportsRouter.get(
  "/",
  auth(Role.CUSTOMER),
  OutageController.getMyReports,
);

export const OutageRoutes = {
  outageRouter,
  myReportsRouter,
};