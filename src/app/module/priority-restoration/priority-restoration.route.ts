import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PriorityRestorationController } from "./priority-restoration.controller";
import { PriorityRestorationValidation } from "./priority-restoration.validation";

const router = Router();

// fix: this had NO auth() middleware -- anyone, logged in or not, could
// trigger a real bKash payment creation.
router.post(
  "/create",
  auth(Role.CUSTOMER),
  validateRequest(PriorityRestorationValidation.createPriorityRequestSchema),
  PriorityRestorationController.createPriorityRequest,
);

// bKash redirects the browser here via GET -- must stay public (no auth),
// since bKash itself is the caller, not a logged-in user session.
router.get(
  "/payment/callback",
  PriorityRestorationController.priorityRestorationCallback,
);

// Customer: get own priority restoration requests
router.get(
  "/my-requests",
  auth(Role.CUSTOMER),
  PriorityRestorationController.getMyPriorityRequests,
);

// Customer: get payment status (:id is the priorityRequest id)
router.get(
  "/payment/:id",
  auth(Role.CUSTOMER),
  PriorityRestorationController.getPaymentStatus,
);

// Admin / Zone Manager: view priority restoration requests
router.get(
  "/",
  auth(Role.ADMIN, Role.ZONE_MANAGER),
  PriorityRestorationController.getAllPriorityRequests,
);

export const PriorityRestorationRoute = router;