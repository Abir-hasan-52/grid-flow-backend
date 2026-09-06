import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { JobPostService } from "./job-post.service";

const createJobPost = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as IRequestUser;
  const result = await JobPostService.createJobPost(req.body, user.userId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Job post created successfully",
    data: result,
  });
});

const getAllPublishedJobPosts = catchAsync(async (req: Request, res: Response) => {
  const result = await JobPostService.getAllPublishedJobPosts(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Job posts fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getPublishedJobPostById = catchAsync(async (req: Request, res: Response) => {
  const result = await JobPostService.getPublishedJobPostById(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Job post fetched successfully",
    data: result,
  });
});

const getAllJobPostsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await JobPostService.getAllJobPostsAdmin(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Job posts fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateJobPost = catchAsync(async (req: Request, res: Response) => {
  const result = await JobPostService.updateJobPost(req.params.id as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Job post updated successfully",
    data: result,
  });
});

const deleteJobPost = catchAsync(async (req: Request, res: Response) => {
  const result = await JobPostService.deleteJobPost(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Job post deleted successfully",
    data: result,
  });
});

const publishJobPost = catchAsync(async (req: Request, res: Response) => {
  const result = await JobPostService.publishJobPost(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Job post published successfully",
    data: result,
  });
});

const closeJobPost = catchAsync(async (req: Request, res: Response) => {
  const result = await JobPostService.closeJobPost(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Job post closed successfully",
    data: result,
  });
});

export const JobPostController = {
  createJobPost,
  getAllPublishedJobPosts,
  getPublishedJobPostById,
  getAllJobPostsAdmin,
  updateJobPost,
  deleteJobPost,
  publishJobPost,
  closeJobPost,
};