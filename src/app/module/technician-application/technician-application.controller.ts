import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/AppError";
// import { TechnicianApplicationService } from "./technicianApplication.service";
import type { IRequestUser } from "../auth/auth.interface";
import { TechnicianApplicationService } from "./technician-application.service";

const applyForJob = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;

  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "Resume file is required");
  }

  const result = await TechnicianApplicationService.applyForJob(
    req.params.jobPostId as string,
    requestUser.userId,
    req.file.buffer,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Application submitted successfully",
    data: result,
  });
});

const getMyApplications = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianApplicationService.getMyApplications(
    requestUser.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Applications fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyApplicationById = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianApplicationService.getMyApplicationById(
    requestUser.userId,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Application fetched successfully",
    data: result,
  });
});

const getAllApplicationsAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianApplicationService.getAllApplicationsAdmin(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Applications fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getApplicationByIdAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await TechnicianApplicationService.getApplicationByIdAdmin(req.params.id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Application fetched successfully",
    data: result,
  });
});

const approveApplication = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianApplicationService.approveApplication(
    req.params.id as string,
    requestUser.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Application approved successfully",
    data: result,
  });
});

const rejectApplication = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianApplicationService.rejectApplication(
    req.params.id as string,
    requestUser.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Application rejected successfully",
    data: result,
  });
});

export const TechnicianApplicationController = {
  applyForJob,
  getMyApplications,
  getMyApplicationById,
  getAllApplicationsAdmin,
  getApplicationByIdAdmin,
  approveApplication,
  rejectApplication,
};