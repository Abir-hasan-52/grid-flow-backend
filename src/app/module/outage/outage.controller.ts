import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OutageService } from "./outage.service";
import type { IRequestUser } from "../auth/auth.interface";

const reportOutage = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await OutageService.reportOutage(requestUser.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.merged
      ? "Your report has been added to an existing outage"
      : "Outage reported successfully",
    data: result,
  });
});

const getMyReports = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await OutageService.getMyReports(requestUser.userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reports fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAllOutages = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await OutageService.getAllOutages(req.query, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outages fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getOutageById = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await OutageService.getOutageById(req.params.id as string, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outage fetched successfully",
    data: result,
  });
});

const createManualOutage = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await OutageService.createManualOutage(req.body, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Outage created successfully",
    data: result,
  });
});

const verifyOutage = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await OutageService.verifyOutage(req.params.id as string, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outage verified successfully",
    data: result,
  });
});

const closeOutage = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await OutageService.closeOutage(req.params.id as string, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Outage closed successfully",
    data: result,
  });
});

export const OutageController = {
  reportOutage,
  getMyReports,
  getAllOutages,
  getOutageById,
  createManualOutage,
  verifyOutage,
  closeOutage,
};