/** biome-ignore-all assist/source/organizeImports: <explanation> */
import httpStatus from "http-status";
import type {
	ICreateAreaPayload,
	IGetAllAreasQuery,
	IUpdateAreaPayload,
} from "./area.interface";
import { AppError } from "../../../utils/AppError";
import { prisma } from "../../../lib/prisma";

const createArea = async (payload: ICreateAreaPayload) => {
	// Check whether feeder exists (and is not soft-deleted)
	const feeder = await prisma.feeder.findFirst({
		where: {
			id: payload.feederId,
			deletedAt: null,
		},
	});

	if (!feeder) {
		throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
	}

	// Check duplicate area name inside the feeder (ignore soft-deleted ones)
	const existing = await prisma.area.findFirst({
		where: {
			name: payload.name,
			feederId: payload.feederId,
			deletedAt: null,
		},
	});

	if (existing) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Area "${payload.name}" already exists under this feeder`,
		);
	}

	const area = await prisma.area.create({
		data: {
			name: payload.name,
			feederId: payload.feederId,
		},
	});

	return area;
};

const getAllAreas = async (query: IGetAllAreasQuery) => {
	const {
		page = 1,
		limit = 10,
		search,
		feederId,
		sortBy = "createdAt",
		sortOrder = "desc",
	} = query;

	const skip = (page - 1) * limit;

	const where = {
		deletedAt: null,
		...(search && {
			name: {
				contains: search,
				mode: "insensitive" as const,
			},
		}),
		...(feederId && {
			feederId,
		}),
	};

	const [areas, total] = await Promise.all([
		prisma.area.findMany({
			where,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			select: {
				id: true,
				name: true,
				feederId: true,
				createdAt: true,
				updatedAt: true,
				feeder: {
					select: { id: true, name: true },
				},
				_count: {
					select: { customers: true },
				},
			},
		}),
		prisma.area.count({ where }),
	]);

	return {
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
		data: areas,
	};
};

const getSingleArea = async (id: string) => {
	const area = await prisma.area.findFirst({
		where: {
			id,
			deletedAt: null,
		},
		include: {
			feeder: {
				select: { id: true, name: true },
			},
			_count: {
				select: { customers: true, schedules: true },
			},
		},
	});

	if (!area) {
		throw new AppError(httpStatus.NOT_FOUND, "Area not found");
	}

	return area;
};

const updateArea = async (id: string, payload: IUpdateAreaPayload) => {
	const existingArea = await prisma.area.findFirst({
		where: {
			id,
			deletedAt: null,
		},
	});

	if (!existingArea) {
		throw new AppError(httpStatus.NOT_FOUND, "Area not found");
	}

	// If changing feeder, check the new feeder exists and is not soft-deleted
	if (payload.feederId) {
		const feeder = await prisma.feeder.findFirst({
			where: {
				id: payload.feederId,
				deletedAt: null,
			},
		});

		if (!feeder) {
			throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
		}
	}

	// Check duplicate name inside the feeder (ignore soft-deleted ones)
	if (payload.name || payload.feederId) {
		const name = payload.name ?? existingArea.name;
		const feederId = payload.feederId ?? existingArea.feederId;

		const duplicate = await prisma.area.findFirst({
			where: {
				name,
				feederId,
				deletedAt: null,
				NOT: {
					id,
				},
			},
		});

		if (duplicate) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Area "${name}" already exists under this feeder`,
			);
		}
	}

	const updatedArea = await prisma.area.update({
		where: { id },
		data: payload,
	});

	return updatedArea;
};

const deleteArea = async (id: string) => {
	const existingArea = await prisma.area.findFirst({
		where: {
			id,
			deletedAt: null,
		},
	});

	if (!existingArea) {
		throw new AppError(httpStatus.NOT_FOUND, "Area not found");
	}

	const activeCustomers = await prisma.user.count({
		where: {
			areaId: id,
			deletedAt: null,
		},
	});

	if (activeCustomers > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete an area that still has customers living in it",
		);
	}

	const deletedArea = await prisma.area.update({
		where: { id },
		data: {
			deletedAt: new Date(),
		},
	});

	return deletedArea;
};

export const AreaService = {
	createArea,
	getAllAreas,
	getSingleArea,
	updateArea,
	deleteArea,
};
