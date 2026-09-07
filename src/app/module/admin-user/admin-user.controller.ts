import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminUserService } from "./admin-user.service";
 

const createAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminUserService.createAdmin(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.emailSent
      ? "Admin account created and credentials emailed successfully"
      : "Admin account created, but the credential email failed to send. Please use forgot-password to issue new credentials.",
    data: result.user,
  });
});

const createZoneManager = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminUserService.createZoneManager(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.emailSent
      ? "Zone manager account created and credentials emailed successfully"
      : "Zone manager account created, but the credential email failed to send. Please use forgot-password to issue new credentials.",
    data: result.user,
  });
});

export const AdminUserController = {
  createAdmin,
  createZoneManager,
};