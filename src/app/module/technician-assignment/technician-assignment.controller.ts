import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TechnicianAssignmentService } from "./technician-assignment.service";
import type { IRequestUser } from "../auth/auth.interface";

const createAssignment = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.createAssignment(
    req.params.outageId as string,
    req.body,
    requestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Technician assigned successfully",
    data: result,
  });
});

const getAllAssignments = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.getAllAssignments(req.query, requestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAssignmentByIdStaff = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.getAssignmentByIdStaff(
    req.params.id as string,
    requestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment fetched successfully",
    data: result,
  });
});

const getMyAssignments = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.getMyAssignments(
    requestUser.userId,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyAssignmentById = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.getMyAssignmentById(
    requestUser.userId,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment fetched successfully",
    data: result,
  });
});

const acceptAssignment = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.acceptAssignment(
    requestUser.userId,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment accepted successfully",
    data: result,
  });
});

const rejectAssignment = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.rejectAssignment(
    requestUser.userId,
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment rejected successfully",
    data: result,
  });
});

const startAssignment = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.startAssignment(
    requestUser.userId,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment started successfully",
    data: result,
  });
});

const addRepairUpdate = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.addRepairUpdate(
    requestUser.userId,
    req.params.id as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Repair update logged successfully",
    data: result,
  });
});

const getRepairUpdates = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.getRepairUpdates(
    req.params.id as string,
    requestUser,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Repair updates fetched successfully",
    data: result,
  });
});

const completeAssignment = catchAsync(async (req: Request, res: Response) => {
  const requestUser = req.user as unknown as IRequestUser;
  const result = await TechnicianAssignmentService.completeAssignment(
    requestUser.userId,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment completed successfully",
    data: result,
  });
});

export const TechnicianAssignmentController = {
  createAssignment,
  getAllAssignments,
  getAssignmentByIdStaff,
  getMyAssignments,
  getMyAssignmentById,
  acceptAssignment,
  rejectAssignment,
  startAssignment,
  addRepairUpdate,
  getRepairUpdates,
  completeAssignment,
};