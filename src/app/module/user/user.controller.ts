import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { UserService } from "./user.service";
import { AppError } from "../../utils/AppError";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
     throw new AppError(httpStatus.BAD_REQUEST, "No file uploaded");
  }
  const userId = req.user?.userId;

  const result = await UserService.uploadProfileImage(req.file.buffer, userId as string); ;
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile image uploaded successfully",
    data: result,
  });
});


export const UserController = {
  uploadProfileImage,
};