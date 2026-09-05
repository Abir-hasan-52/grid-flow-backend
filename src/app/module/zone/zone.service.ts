import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IGetAllZonesQuery } from "./zone.interface";

const createZone = async (payload: { name: string }) => {
	const existing = await prisma.powerZone.findFirst({
		where: { name: payload.name, deletedAt: null },
	});

	if (existing) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`"${payload.name}" zone with this name already exists`,
		);
	}

	const zone = await prisma.powerZone.create({
		data: { name: payload.name },
	});

	return zone;
};

const getAllZones = async (query: IGetAllZonesQuery) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const skip = (page - 1) * limit;

	const where = {
		deletedAt: null,
		...(query.search && {
			name: { contains: query.search, mode: "insensitive" as const },
		}),
	};

	const [zones, total] = await Promise.all([
		prisma.powerZone.findMany({
			where,
			skip,
			take: limit,
			orderBy: {
				[query.sortBy || "createdAt"]: query.sortOrder || "desc",
			},
			select: {
				id: true,
				name: true,
				createdAt: true,
				updatedAt: true,
				_count: { select: { substations: true, managers: true } },
			},
		}),
		prisma.powerZone.count({ where }),
	]);

	return {
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
		data: zones,
	};
};

const getZoneById = async (id: string) => {
	const zone = await prisma.powerZone.findFirst({
		where: { id, deletedAt: null },
		include: {
			substations: { where: { deletedAt: null } },
			managers: { select: { id: true, name: true, email: true } },
		},
	});

	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
	}

	return zone;
};

const updateZone = async (id: string, payload: { name?: string }) => {
	const zone = await prisma.powerZone.findFirst({
		where: { id, deletedAt: null },
	});

	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
	}

	const updated = await prisma.powerZone.update({
		where: { id },
		data: payload,
	});

	return updated;
};

const deleteZone = async (id: string) => {
	const zone = await prisma.powerZone.findFirst({
		where: { id, deletedAt: null },
	});

	if (!zone) {
		throw new AppError(httpStatus.NOT_FOUND, "Zone not found");
	}

	const activeSubstations = await prisma.substation.count({
		where: { powerZoneId: id, deletedAt: null },
	});

	if (activeSubstations > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete a zone that still has active substations",
		);
	}

	await prisma.powerZone.update({
		where: { id },
		data: { deletedAt: new Date() },
	});

	return null;
};

export const ZoneService = {
	createZone,
	getAllZones,
	getZoneById,
	updateZone,
	deleteZone,
};
