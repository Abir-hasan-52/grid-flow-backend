import { Router } from "express";
import { UserController } from "./user.controller";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../../generated/prisma/enums";

const router= Router()

router.patch("/profile-image",
auth(Role.ADMIN, Role.CUSTOMER, Role.TECHNICIAN, Role.ZONE_MANAGER),
    upload.single("profileImage"), UserController.uploadProfileImage)

export const UserRoutes = router