import { Router } from "express";
import { UserController } from "./user.controller";
 
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
 
import { Role } from "../../../../generated/prisma/enums";
import { UserValidation } from "./user.validation";
import { uploadImage } from "../../lib/multer";

const router = Router();

// fix: was router.get(...) -- a GET request updating data breaks REST
// conventions and is a semantic bug. This must be PATCH.
router.patch(
  "/me",
  auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN, Role.ZONE_MANAGER),
  validateRequest(UserValidation.updateMyProfileSchema), 
  UserController.updateMyProfile,
);

router.patch(
  "/profile-image",
  auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN, Role.ZONE_MANAGER),
  uploadImage.single("profileImage"),
  UserController.uploadProfileImage,
);

export const UserRoutes = router;