import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import type {
  ICreateFeederPayload,
  IGetAllFeedersQuery,
  IUpdateFeederPayload,
} from "./feeder.interface";
import { AppError } from "../../utils/AppError";

const createFeeder = async (payload: ICreateFeederPayload) => {
  // Check whether substation exists (and is not soft-deleted)
  const substation = await prisma.substation.findFirst({
    where: {
      id: payload.substationId,
      deletedAt: null,
    },
  });

  if (!substation) {
    throw new AppError(httpStatus.NOT_FOUND, "Substation not found");
  }

  // Check duplicate feeder name inside the substation (ignore soft-deleted ones)
  const existing = await prisma.feeder.findFirst({
    where: {
      name: payload.name,
      substationId: payload.substationId,
      deletedAt: null,
    },
  });

  if (existing) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Feeder "${payload.name}" already exists in this substation`,
    );
  }

  const feeder = await prisma.feeder.create({
    data: {
      name: payload.name,
      substationId: payload.substationId,
    },
  });

  return feeder;
};

const getAllFeeders = async (query: IGetAllFeedersQuery) => {
  const {
    page = 1,
    limit = 10,
    search,
    substationId,
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
    ...(substationId && {
      substationId,
    }),
  };

  const [feeders, total] = await Promise.all([
    prisma.feeder.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        substation: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            areas: true,
            outages: true,
          },
        },
      },
    }),
    prisma.feeder.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: feeders,
  };
};

const getSingleFeeder = async (id: string) => {
  const feeder = await prisma.feeder.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      substation: {
        select: {
          id: true,
          name: true,
        },
      },
      areas: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          areas: true,
          outages: true,
        },
      },
    },
  });

  if (!feeder) {
    throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
  }

  return feeder;
};

const updateFeeder = async (id: string, payload: IUpdateFeederPayload) => {
  const existingFeeder = await prisma.feeder.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!existingFeeder) {
    throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
  }

  // If changing substation, check the new substation exists and is not soft-deleted
  if (payload.substationId) {
    const substation = await prisma.substation.findFirst({
      where: {
        id: payload.substationId,
        deletedAt: null,
      },
    });

    if (!substation) {
      throw new AppError(httpStatus.NOT_FOUND, "Substation not found");
    }
  }

  // Check duplicate name inside the substation (ignore soft-deleted ones)
  if (payload.name || payload.substationId) {
    const name = payload.name ?? existingFeeder.name;
    const substationId = payload.substationId ?? existingFeeder.substationId;

    const duplicate = await prisma.feeder.findFirst({
      where: {
        name,
        substationId,
        deletedAt: null,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Feeder "${name}" already exists in this substation`,
      );
    }
  }

  const updatedFeeder = await prisma.feeder.update({
    where: { id },
    data: payload,
  });

  return updatedFeeder;
};

const deleteFeeder = async (id: string) => {
  const existingFeeder = await prisma.feeder.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!existingFeeder) {
    throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
  }

  const activeAreas = await prisma.area.count({
    where: {
      feederId: id,
      deletedAt: null,
    },
  });

  if (activeAreas > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a feeder that still has active areas",
    );
  }

  const deletedFeeder = await prisma.feeder.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return deletedFeeder;
};

export const FeederService = {
  createFeeder,
  getAllFeeders,
  getSingleFeeder,
  updateFeeder,
  deleteFeeder,
};