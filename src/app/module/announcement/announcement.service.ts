import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

import { Role } from "../../../../generated/prisma/enums";
import { ICreateAnnouncement } from "./announcement.interface";

const createAnnouncement = async (
  payload: ICreateAnnouncement,
  userId: string,
) => {
  // 1. Find logged-in user
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      managedZoneId: true,
    },
  });

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  // 2. Zone Manager business logic
  if (user.role === Role.ZONE_MANAGER) {
    if (!user.managedZoneId) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Zone manager is not assigned to any zone",
      );
    }

    if (payload.powerZoneId !== user.managedZoneId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only create announcements for your own zone",
      );
    }
  }

  // 3. If zone is provided, check zone exists
  if (payload.powerZoneId) {
    const powerZone = await prisma.powerZone.findUnique({
      where: {
        id: payload.powerZoneId,
      },
      select: {
        id: true,
      },
    });

    if (!powerZone) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Power zone not found",
      );
    }
  }

  // 4. Create announcement
  const announcement = await prisma.announcement.create({
    data: {
      title: payload.title,
      content: payload.content,
      type: payload.type,
      powerZoneId: payload.powerZoneId,

      // Always starts as DRAFT
      status: "DRAFT",

      createdById: userId,
    },

    include: {
      powerZone: {
        select: {
          id: true,
          name: true,
        },
      },

      createdBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  return announcement;
};

export const AnnouncementService = {
  createAnnouncement,
};