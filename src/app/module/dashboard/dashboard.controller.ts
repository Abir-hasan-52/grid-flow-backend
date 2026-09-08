import type { Request, Response } from "express";
import httpStatus from "http-status";
import { Role } from "../../../../generated/prisma/enums";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/AppError";
import { DashboardService } from "./dashboard.service";
import type { IRequestUser } from "../auth/auth.interface";

// Single endpoint -- branches internally by the caller's role so the
// frontend only ever needs to call GET /api/v1/dashboard.
const getDashboard = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;

  let data:
    | Awaited<ReturnType<typeof DashboardService.getAdminDashboard>>
    | Awaited<ReturnType<typeof DashboardService.getZoneManagerDashboard>>
    | Awaited<ReturnType<typeof DashboardService.getTechnicianDashboard>>
    | Awaited<ReturnType<typeof DashboardService.getCustomerDashboard>>;
  switch (requestUser.role) {
    case Role.ADMIN:
      data = await DashboardService.getAdminDashboard();
      break;
    case Role.ZONE_MANAGER:
      data = await DashboardService.getZoneManagerDashboard(requestUser.userId);
      break;
    case Role.TECHNICIAN:
      data = await DashboardService.getTechnicianDashboard(requestUser.userId);
      break;
    case Role.CUSTOMER:
      data = await DashboardService.getCustomerDashboard(requestUser.userId);
      break;
    default:
      throw new AppError(httpStatus.FORBIDDEN, "No dashboard available for this role");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard data fetched successfully",
    data,
  });
});

export const DashboardController = {
  getDashboard,
};