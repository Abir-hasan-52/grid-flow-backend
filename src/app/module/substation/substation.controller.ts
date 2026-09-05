import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { SubstationService } from "./substation.service";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";

const createSubstation = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await SubstationService.createSubstation(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Substation created successfully",
		data: result,
	});
});

const getAllSubstations = catchAsync(async (req: Request, res: Response) => {
	const result = await SubstationService.getAllSubstations(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Substations retrieved successfully",
		data: result,
	});
});

const getSingleSubstation = catchAsync(async (req: Request, res: Response) => {
	const result = await SubstationService.getSingleSubstation(
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Substation retrieved successfully",
		data: result,
	});
});

const updateSubstation = catchAsync(async (req: Request, res: Response) => {
	const result = await SubstationService.updateSubstation(
		req.params.id as string,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Substation updated successfully",
		data: result,
	});
});

const deleteSubstation = catchAsync(async (req: Request, res: Response) => {
	const result = await SubstationService.deleteSubstation(
		req.params.id as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Substation deleted successfully",
		data: result,
	});
});
export const SubstationController = {
	createSubstation,
	getAllSubstations,
	getSingleSubstation,
	updateSubstation,
	deleteSubstation,
};
