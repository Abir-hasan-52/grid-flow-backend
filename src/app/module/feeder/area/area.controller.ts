import type { Request, Response } from "express";
import httpStatus from "http-status";
// import { catchAsync } from "../../utils/catchAsync";
// import { sendResponse } from "../../utils/sendResponse";
import { AreaService } from "./area.service";
import { catchAsync } from "../../../utils/catchAsync";
import { sendResponse } from "../../../utils/sendResponse";

const createArea = catchAsync(async (req: Request, res: Response) => {
	const result = await AreaService.createArea(req.body);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Area created successfully",
		data: result,
	});
});

const getAllAreas = catchAsync(async (req: Request, res: Response) => {
	const result = await AreaService.getAllAreas(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Areas fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getSingleArea = catchAsync(async (req: Request, res: Response) => {
	const result = await AreaService.getSingleArea(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Area fetched successfully",
		data: result,
	});
});

const updateArea = catchAsync(async (req: Request, res: Response) => {
	const result = await AreaService.updateArea(
		req.params.id as string,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Area updated successfully",
		data: result,
	});
});

const deleteArea = catchAsync(async (req: Request, res: Response) => {
	const result = await AreaService.deleteArea(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Area deleted successfully",
		data: result,
	});
});

export const AreaController = {
	createArea,
	getAllAreas,
	getSingleArea,
	updateArea,
	deleteArea,
};
