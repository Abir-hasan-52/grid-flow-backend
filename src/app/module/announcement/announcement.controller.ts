import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnnouncementService } from "./announcement.service";
import type { IRequestUser } from "../auth/auth.interface";

const createAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await AnnouncementService.createAnnouncement(req.body, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Announcement created successfully",
    data: result,
  });
});

const getAnnouncements = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await AnnouncementService.getAnnouncements(req.query, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Announcements retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAnnouncementById = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await AnnouncementService.getAnnouncementById(req.params.id as string, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Announcement fetched successfully",
    data: result,
  });
});

const updateAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await AnnouncementService.updateAnnouncement(
    req.params.id as string,
    req.body,
    requestUser,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Announcement updated successfully",
    data: result,
  });
});

const publishAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await AnnouncementService.publishAnnouncement(req.params.id as string, requestUser);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Announcement published successfully",
    data: result,
  });
});

const deleteAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const result = await AnnouncementService.deleteAnnouncement(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Announcement deleted successfully",
    data: result,
  });
});

export const AnnouncementController = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  publishAnnouncement,
  deleteAnnouncement,
};