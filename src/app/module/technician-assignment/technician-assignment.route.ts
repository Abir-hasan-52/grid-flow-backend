import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TechnicianAssignmentController } from "./technician-assignment.controller";
import { TechnicianAssignmentValidation } from "./technician-assignment.validation";

// Mounted at /api/v1/outages -- adds POST /:outageId/assignments
const outageAssignRouter = Router();
outageAssignRouter.post(
  "/:outageId/assignments",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  validateRequest(TechnicianAssignmentValidation.createAssignmentSchema),
  TechnicianAssignmentController.createAssignment,
);

// Mounted at /api/v1/assignments
const assignmentRouter = Router();
assignmentRouter.get(
  "/",
  auth(Role.ADMIN, Role.ZONE_MANAGER,),
  TechnicianAssignmentController.getAllAssignments,
);
assignmentRouter.get(
  "/:id",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  TechnicianAssignmentController.getAssignmentByIdStaff,
);
assignmentRouter.patch(
  "/:id/accept",
  auth(Role.TECHNICIAN),
  TechnicianAssignmentController.acceptAssignment,
);
assignmentRouter.patch(
  "/:id/reject",
  auth(Role.TECHNICIAN),
  validateRequest(TechnicianAssignmentValidation.rejectAssignmentSchema),
  TechnicianAssignmentController.rejectAssignment,
);
assignmentRouter.patch(
  "/:id/start",
  auth(Role.TECHNICIAN),
  TechnicianAssignmentController.startAssignment,
);
assignmentRouter.patch(
  "/:id/complete",
  auth(Role.TECHNICIAN),
  TechnicianAssignmentController.completeAssignment,
);
assignmentRouter.post(
  "/:id/repair-updates",
  auth(Role.TECHNICIAN),
  validateRequest(TechnicianAssignmentValidation.createRepairUpdateSchema),
  TechnicianAssignmentController.addRepairUpdate,
);
assignmentRouter.get(
  "/:id/repair-updates",
  auth(Role.ADMIN, Role.ZONE_MANAGER, Role.TECHNICIAN),
  TechnicianAssignmentController.getRepairUpdates,
);

// Mounted at /api/v1/my-assignments
const myAssignmentsRouter = Router();
myAssignmentsRouter.get(
  "/",
  auth(Role.TECHNICIAN),
  TechnicianAssignmentController.getMyAssignments,
);
myAssignmentsRouter.get(
  "/:id",
  auth(Role.TECHNICIAN),
  TechnicianAssignmentController.getMyAssignmentById,
);

export const TechnicianAssignmentRoutes = {
  outageAssignRouter,
  assignmentRouter,
  myAssignmentsRouter,
};