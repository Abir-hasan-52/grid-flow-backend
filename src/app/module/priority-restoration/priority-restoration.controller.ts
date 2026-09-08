import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PriorityRestorationService } from "./priority-restoration.service";
import type { IRequestUser } from "../auth/auth.interface";

const createPriorityRequest = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await PriorityRestorationService.createPriorityRequest(req.body, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Priority request created successfully. Redirect the user to bkashURL to pay.",
    data: result,
  });
});

const priorityRestorationCallback = catchAsync(async (req: Request, res: Response) => {
  // fix: was `{ executePaymentResult, redirectUrl } = ...` -- missing `const`,
  // which is a syntax error (parsed as a block statement, not destructuring).
  const { redirectUrl } = await PriorityRestorationService.priorityRestorationCallback(
    req.query,
  );
  res.redirect(redirectUrl);
});

const getMyPriorityRequests = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await PriorityRestorationService.getMyPriorityRequests(
    requestUser.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Priority requests fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await PriorityRestorationService.getPaymentStatus(
    requestUser.userId,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment status fetched successfully",
    data: result,
  });
});

const getAllPriorityRequests = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await PriorityRestorationService.getAllPriorityRequests(
    req.query,
    requestUser,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Priority requests fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const PriorityRestorationController = {
  createPriorityRequest,
  priorityRestorationCallback,
  getMyPriorityRequests,
  getPaymentStatus,
  getAllPriorityRequests,
};