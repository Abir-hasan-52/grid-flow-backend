import { Request, Response } from "express";
import httpStatus from "http-status";
// import catchAsync from "../utils/catchAsync";
// import sendResponse from "../utils/sendResponse";
import { ZoneService } from "./zone.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const createZone = catchAsync(async (req: Request, res: Response) => {
	const result = await ZoneService.createZone(req.body);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Zone created successfully",
		data: result,
	});
});

const getAllZones = catchAsync(async (req: Request, res: Response) => {
	const result = await ZoneService.getAllZones(req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zones fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getZoneById = catchAsync(async (req: Request, res: Response) => {
	const result = await ZoneService.getZoneById(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zone fetched successfully",
		data: result,
	});
});

const updateZone = catchAsync(async (req: Request, res: Response) => {
	const result = await ZoneService.updateZone(
		req.params.id as string,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zone updated successfully",
		data: result,
	});
});

const deleteZone = catchAsync(async (req: Request, res: Response) => {
	await ZoneService.deleteZone(req.params.id as string);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Zone deleted successfully",
		data: null,
	});
});

export const ZoneController = {
	createZone,
	getAllZones,
	getZoneById,
	updateZone,
	deleteZone,
};
