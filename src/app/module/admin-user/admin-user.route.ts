import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminUserValidation } from "./admin-user.validation";
import { AdminUserController } from "./admin-user.controller";

const router = Router();

router.post(
  "/admin",
  auth(Role.ADMIN),
  validateRequest(AdminUserValidation.createAdminSchema),
  AdminUserController.createAdmin,
);

router.post(
  "/zone-manager",
  auth(Role.ADMIN),
  validateRequest(AdminUserValidation.createZoneManagerSchema),
  AdminUserController.createZoneManager,
);

router.get("/all-users", auth(Role.ADMIN), AdminUserController.getAllUsers);

router.get("/:id", auth(Role.ADMIN), AdminUserController.getUserById);

router.patch("/:id/suspend", auth(Role.ADMIN), AdminUserController.suspendUser);

router.patch(
  "/:id/activate",
  auth(Role.ADMIN),
  AdminUserController.activateUser,
);

router.delete("/:id/delete", auth(Role.ADMIN), AdminUserController.deleteUser);

export const AdminUserRoutes = router;
