import path from "node:path";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  AnnouncementStatus,
  EmailStatus,
  EmailType,
  Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  ICreateAnnouncement,
  IGetAllAnnouncementsQuery,
  IUpdateAnnouncement,
} from "./announcement.interface";
import type { IRequestUser } from "../auth/auth.interface";
import { transporter } from "../../lib/nodemailer";

const createAnnouncement = async (
  payload: ICreateAnnouncement,
  requestUser: IRequestUser,
) => {
  let powerZoneId: string | undefined = payload.powerZoneId;

  if (requestUser.role === Role.ZONE_MANAGER) {
    const zoneManager = await prisma.user.findFirst({
      where: { id: requestUser.userId, deletedAt: null },
    });

    if (!zoneManager?.managedZoneId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account is not assigned to manage any zone",
      );
    }

    // fix (business rule): a zone manager can ONLY announce for their own
    // zone -- force it server-side rather than trusting whatever zone id
    // the client sends. Prevents a zone manager posting into another zone.
    powerZoneId = zoneManager.managedZoneId;
  } else if (powerZoneId) {
    // ADMIN posting to a specific zone -- validate that zone exists
    const zone = await prisma.powerZone.findFirst({
      where: { id: powerZoneId, deletedAt: null },
    });
    if (!zone) {
      throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
    }
  }
  // ADMIN with no powerZoneId -> global announcement, powerZoneId stays undefined

  const announcement = await prisma.announcement.create({
    data: {
      title: payload.title,
      content: payload.content,
      type: payload.type,
      powerZoneId,
      status: AnnouncementStatus.DRAFT,
      createdById: requestUser.userId,
    },
  });

  return announcement;
};

const getAnnouncements = async (
  query: IGetAllAnnouncementsQuery,
  requestUser: IRequestUser,
) => {
  const {
    page = 1,
    limit = 10,
    search,
    type,
    status,
    powerZoneId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (page - 1) * limit;

  let zoneScope: { powerZoneId?: string } = {};

  if (requestUser.role === Role.ZONE_MANAGER) {
    const zoneManager = await prisma.user.findFirst({
      where: { id: requestUser.userId, deletedAt: null },
    });
    // Zone managers only ever see announcements scoped to their own zone.
    zoneScope = { powerZoneId: zoneManager?.managedZoneId ?? "__none__" };
  } else if (powerZoneId) {
    // ADMIN can optionally filter by a specific zone
    zoneScope = { powerZoneId };
  }

  const where = {
    deletedAt: null,
    ...zoneScope,
    ...(type && { type }),
    ...(status && { status }),
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        powerZone: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: announcements,
  };
};

const getExistingAnnouncementOrThrow = async (id: string) => {
  const announcement = await prisma.announcement.findFirst({
    where: { id, deletedAt: null },
  });

  if (!announcement) {
    throw new AppError(httpStatus.NOT_FOUND, "Announcement not found");
  }

  return announcement;
};

const assertZoneManagerOwnsAnnouncement = async (
  announcementPowerZoneId: string | null,
  requestUser: IRequestUser,
) => {
  if (requestUser.role !== Role.ZONE_MANAGER) return;

  const zoneManager = await prisma.user.findFirst({
    where: { id: requestUser.userId, deletedAt: null },
  });

  if (
    !zoneManager?.managedZoneId ||
    zoneManager.managedZoneId !== announcementPowerZoneId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only manage announcements in your own zone",
    );
  }
};

const getAnnouncementById = async (id: string, requestUser: IRequestUser) => {
  const announcement = await prisma.announcement.findFirst({
    where: { id, deletedAt: null },
    include: {
      powerZone: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!announcement) {
    throw new AppError(httpStatus.NOT_FOUND, "Announcement not found");
  }

  await assertZoneManagerOwnsAnnouncement(announcement.powerZoneId, requestUser);

  return announcement;
};

const updateAnnouncement = async (
  id: string,
  payload: IUpdateAnnouncement,
  requestUser: IRequestUser,
) => {
  const announcement = await getExistingAnnouncementOrThrow(id);
  await assertZoneManagerOwnsAnnouncement(announcement.powerZoneId, requestUser);

  if (announcement.status !== AnnouncementStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only DRAFT announcements can be edited",
    );
  }

  // fix (business rule): a zone manager must not be able to move their
  // announcement into another zone -- strip powerZoneId from their payload.
  const { powerZoneId, ...rest } = payload;
  const allowZoneChange = requestUser.role === Role.ADMIN;

  if (allowZoneChange && powerZoneId) {
    const zone = await prisma.powerZone.findFirst({
      where: { id: powerZoneId, deletedAt: null },
    });
    if (!zone) {
      throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
    }
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      ...rest,
      ...(allowZoneChange && powerZoneId ? { powerZoneId } : {}),
    },
  });

  return updated;
};

const publishAnnouncement = async (id: string, requestUser: IRequestUser) => {
  const announcement = await getExistingAnnouncementOrThrow(id);
  await assertZoneManagerOwnsAnnouncement(announcement.powerZoneId, requestUser);

  if (announcement.status !== AnnouncementStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot publish an announcement with status "${announcement.status}". Only DRAFT announcements can be published.`,
    );
  }

  const published = await prisma.announcement.update({
    where: { id },
    data: { status: AnnouncementStatus.PUBLISHED },
  });

  // Figure out who should receive the email:
  // - zone-scoped announcement -> customers whose area belongs to that zone
  // - global announcement (no powerZoneId) -> all active customers
  const recipients = await prisma.user.findMany({
    where: {
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      ...(announcement.powerZoneId && {
        area: {
          feeder: {
            substation: {
              powerZoneId: announcement.powerZoneId,
            },
          },
        },
      }),
    },
    select: { id: true, name: true, email: true },
  });

  const subject = `[GridFlow] ${announcement.title}`;
  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/announcement.ejs",
  );
  const html = await ejs.renderFile(templatePath, {
    title: announcement.title,
    content: announcement.content,
    type: announcement.type,
  });

  // Send in parallel, but never let one failure block the others or throw
  // back to the caller -- publishing already succeeded above.
  await Promise.allSettled(
    recipients.map(async (recipient) => {
      try {
        await transporter.sendMail({
          from: config.email_sender,
          to: recipient.email,
          subject,
          html,
        });

        await prisma.emailLog.create({
          data: {
            userId: recipient.id,
            type: EmailType.GENERAL,
            subject,
            status: EmailStatus.SENT,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        await prisma.emailLog.create({
          data: {
            userId: recipient.id,
            type: EmailType.GENERAL,
            subject,
            status: EmailStatus.FAILED,
            error: error instanceof Error ? error.message : "Unknown email error",
          },
        });
      }
    }),
  );

  return { ...published, notifiedCustomers: recipients.length };
};

const deleteAnnouncement = async (id: string) => {
  // ADMIN-only per route auth -- no zone-ownership check needed here.
  await getExistingAnnouncementOrThrow(id);

  const deleted = await prisma.announcement.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return deleted;
};

export const AnnouncementService = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  publishAnnouncement,
  deleteAnnouncement,
};