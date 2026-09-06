import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { uploadDocument } from "../../lib/multer";
import { TechnicianApplicationValidation } from "./technician-application.validation";
import { TechnicianApplicationController } from "./technician-application.controller";


// Mounted at /api/v1/job-posts -- adds POST /:jobPostId/applications
const applyRouter = Router();
applyRouter.post(
  "/:jobPostId/applications",
  auth(Role.CUSTOMER),
  uploadDocument.single("resume"),
  validateRequest(TechnicianApplicationValidation.createApplicationSchema),
  TechnicianApplicationController.applyForJob,
);

// Mounted at /api/v1/my-applications
const myApplicationsRouter = Router();
myApplicationsRouter.get(
  "/me",
  auth(Role.CUSTOMER),
  TechnicianApplicationController.getMyApplications,
);
myApplicationsRouter.get(
  "/me/:id",
  auth(Role.CUSTOMER),
  TechnicianApplicationController.getMyApplicationById,
);

// Mounted at /api/v1/admin/technician-applications
const adminRouter = Router();
adminRouter.get(
  "/",
  auth(Role.ADMIN),
  TechnicianApplicationController.getAllApplicationsAdmin,
);
adminRouter.get(
  "/:id",
  auth(Role.ADMIN),
  TechnicianApplicationController.getApplicationByIdAdmin,
);
adminRouter.patch(
  "/:id/approve",
  auth(Role.ADMIN),
  TechnicianApplicationController.approveApplication,
);
adminRouter.patch(
  "/:id/reject",
  auth(Role.ADMIN),
  validateRequest(TechnicianApplicationValidation.rejectApplicationSchema),
  TechnicianApplicationController.rejectApplication,
);

export const TechnicianApplicationRoutes = {
  applyRouter,
  myApplicationsRouter,
  adminRouter,
};