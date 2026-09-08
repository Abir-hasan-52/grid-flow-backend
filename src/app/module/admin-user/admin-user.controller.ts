import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminUserService } from "./admin-user.service";
import { AdminUserValidation } from "./admin-user.validation";
 

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


// GET ALL USERS
 
const getAllUsers = catchAsync(
  async (req: Request, res: Response) => {
    const parsedQuery =
      AdminUserValidation.getAllUsersQuerySchema.parse(
        req.query,
      );

    const result =
      await AdminUserService.getAllUsers(parsedQuery);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Users retrieved successfully",
      data: result,
    });
  },
);

 
// GET SINGLE USER
 
const getUserById = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await AdminUserService.getUserById(
        req.params.id as string,
      );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User retrieved successfully",
      data: result,
    });
  },
);

// ======================================================
// SUSPEND USER
// ======================================================
const suspendUser = catchAsync(
  async (req: Request, res: Response) => {
    const requestUserId = req.user?.userId as string;
    const result =
      await AdminUserService.suspendUser(
        req.params.id as string,
        requestUserId,
      );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User suspended successfully",
      data: result,
    });
  },
);

// ======================================================
// ACTIVATE USER
// ======================================================
const activateUser = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await AdminUserService.activateUser(
        req.params.id as string,
      );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User activated successfully",
      data: result,
    });
  },
);

// ======================================================
// DELETE USER
// ======================================================
const deleteUser = catchAsync(
  async (req: Request, res: Response) => {
    const requestUserId = req.user?.userId as string;
    const result =
      await AdminUserService.deleteUser(
        req.params.id as string,
        requestUserId,
      );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "User deleted successfully",
      data: result,
    });
  },
);



export const AdminUserController = {
  createAdmin,
  createZoneManager,
  getAllUsers,
  getUserById,
  suspendUser,
  activateUser,
  deleteUser,
};
