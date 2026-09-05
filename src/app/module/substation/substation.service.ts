import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import type {
  ICreateSubstationPayload,
  IGetAllSubstationsQuery,
  IUpdateSubstationPayload,
} from "./substation.interface";
import { AppError } from "../../utils/AppError";

const createSubstation = async (payload: ICreateSubstationPayload) => {
  // Check whether zone exists (and is not soft-deleted)
  const zone = await prisma.powerZone.findFirst({
    where: {
      id: payload.powerZoneId,
      deletedAt: null,
    },
  });

  if (!zone) {
    throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
  }

  // Check duplicate substation name inside the zone (ignore soft-deleted ones)
  const existing = await prisma.substation.findFirst({
    where: {
      name: payload.name,
      powerZoneId: payload.powerZoneId,
      deletedAt: null,
    },
  });

  if (existing) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Substation "${payload.name}" already exists in this zone`,
    );
  }

  const substation = await prisma.substation.create({
    data: {
      name: payload.name,
      powerZoneId: payload.powerZoneId,
    },
  });

  return substation;
};

const getAllSubstations = async (query: IGetAllSubstationsQuery) => {
  const {
    page = 1,
    limit = 10,
    search,
    powerZoneId,
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
    ...(powerZoneId && {
      powerZoneId,
    }),
  };

  const [substations, total] = await Promise.all([
    prisma.substation.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        powerZone: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            feeders: true,
          },
        },
      },
    }),
    prisma.substation.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: substations,
  };
};

const getSingleSubstation = async (id: string) => {
  const substation = await prisma.substation.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      powerZone: {
        select: {
          id: true,
          name: true,
        },
      },
      feeders: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          feeders: true,
        },
      },
    },
  });

  if (!substation) {
    throw new AppError(httpStatus.NOT_FOUND, "Substation not found");
  }

  return substation;
};

const updateSubstation = async (
  id: string,
  payload: IUpdateSubstationPayload,
) => {
  // Check existing substation
  const existingSubstation = await prisma.substation.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!existingSubstation) {
    throw new AppError(httpStatus.NOT_FOUND, "Substation not found");
  }

  // If changing zone, check the new zone exists and is not soft-deleted
  if (payload.powerZoneId) {
    const zone = await prisma.powerZone.findFirst({
      where: {
        id: payload.powerZoneId,
        deletedAt: null,
      },
    });

    if (!zone) {
      throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
    }
  }

  // Check duplicate name inside the zone (ignore soft-deleted ones)
  if (payload.name || payload.powerZoneId) {
    const name = payload.name ?? existingSubstation.name;
    const powerZoneId = payload.powerZoneId ?? existingSubstation.powerZoneId;

    const duplicate = await prisma.substation.findFirst({
      where: {
        name,
        powerZoneId,
        deletedAt: null,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Substation "${name}" already exists in this zone`,
      );
    }
  }

  const updatedSubstation = await prisma.substation.update({
    where: {
      id,
    },
    data: payload,
  });

  return updatedSubstation;
};

const deleteSubstation = async (id: string) => {
  const existingSubstation = await prisma.substation.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!existingSubstation) {
    throw new AppError(httpStatus.NOT_FOUND, "Substation not found");
  }

  const activeFeeders = await prisma.feeder.count({
    where: {
      substationId: id,
      deletedAt: null,
    },
  });

  if (activeFeeders > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a substation that still has active feeders",
    );
  }

  const deletedSubstation = await prisma.substation.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  return deletedSubstation;
};

export const SubstationService = {
  createSubstation,
  getAllSubstations,
  getSingleSubstation,
  updateSubstation,
  deleteSubstation,
};