import { Request, Response } from "express";
import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppError } from "../../utils/AppError";

import { AnnouncementService } from "./announcement.service";

const createAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized user");
  }

  const result = await AnnouncementService.createAnnouncement(req.body, userId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Announcement created successfully",
    data: result,
  });
});

const getAllAnnouncements = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Unauthorized user",
      );
    }

    const result =
      await AnnouncementService.getAllAnnouncements(
        req.query,
        userId,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Announcements retrieved successfully",
      data: result,
    });
  },
);

export const AnnouncementController = {
  createAnnouncement,
    getAllAnnouncements,
};
