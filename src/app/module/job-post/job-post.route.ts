import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { JobPostController } from "./job-post.controller";
import { JobPostValidation } from "./job-post.validation";

const router = Router();

router.get("/all-posts", auth(Role.ADMIN), JobPostController.getAllJobPostsAdmin);

router.post(
  "/create-post",
  auth(Role.ADMIN),
  validateRequest(JobPostValidation.createJobPostSchema),
  JobPostController.createJobPost,
);

// Public
router.get("/public-posts", JobPostController.getAllPublishedJobPosts);
router.get("/public-posts/:id", JobPostController.getPublishedJobPostById);

router.patch(
  "/update-post/:id",
  auth(Role.ADMIN),
  validateRequest(JobPostValidation.updateJobPostSchema),
  JobPostController.updateJobPost,
);

router.delete("/single-post/:id", auth(Role.ADMIN), JobPostController.deleteJobPost);

router.patch(
  "/single-post/:id/publish",
  auth(Role.ADMIN),
  JobPostController.publishJobPost,
);

router.patch("/single-post/:id/close", auth(Role.ADMIN), JobPostController.closeJobPost);

export const JobPostRoutes = router;
 
