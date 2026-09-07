import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { ScheduleService } from "./Schedule.service";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await ScheduleService.createSchedule(req.body, requestUser);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Load shedding schedule created successfully",
    data: result,
  });
});

const getAllSchedules = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await ScheduleService.getAllSchedules(req.query, requestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedules fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getScheduleById = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await ScheduleService.getScheduleById(req.params.id as string, requestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule fetched successfully",
    data: result,
  });
});

const updateSchedule = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await ScheduleService.updateSchedule(req.params.id as string, req.body, requestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule updated successfully",
    data: result,
  });
});

const approveSchedule = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await ScheduleService.approveSchedule(req.params.id as string, requestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule approved successfully",
    data: result,
  });
});

const cancelSchedule = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await ScheduleService.cancelSchedule(req.params.id as string, requestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Schedule cancelled successfully",
    data: result,
  });
});

export const ScheduleController = {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  approveSchedule,
  cancelSchedule,
};