import path from "node:path";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  EmailStatus,
  EmailType,
  Role,
  ScheduleStatus,
  UserStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
// import { transporter } from "../../lib/mailer";
import { AppError } from "../../utils/AppError";
// import type {
//   ICreateSchedulePayload,
//   IGetAllSchedulesQuery,
//   IUpdateSchedulePayload,
// } from "./schedule.interface";
import type { IRequestUser } from "../auth/auth.interface";
import { transporter } from "../../lib/nodemailer";
import {
  ICreateSchedulePayload,
  IGetAllSchedulesQuery,
  IUpdateSchedulePayload,
} from "./schedule.interface";

// ---------- shared helpers ----------

const resolveZoneScopeForCreate = async (
  requestUser: IRequestUser,
  payloadZoneId?: string,
) => {
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
    // fix (business rule): never trust a zone id from a zone manager's payload
    return zoneManager.managedZoneId;
  }

  // ADMIN must explicitly specify which zone
  if (!payloadZoneId) {
    throw new AppError(httpStatus.BAD_REQUEST, "powerZoneId is required");
  }
  return payloadZoneId;
};

const assertZoneManagerOwnsSchedule = async (
  schedulePowerZoneId: string,
  requestUser: IRequestUser,
) => {
  if (requestUser.role !== Role.ZONE_MANAGER) return;

  const zoneManager = await prisma.user.findFirst({
    where: { id: requestUser.userId, deletedAt: null },
  });

  if (
    !zoneManager?.managedZoneId ||
    zoneManager.managedZoneId !== schedulePowerZoneId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only manage load shedding schedules in your own zone",
    );
  }
};

const validateAreasBelongToZone = async (
  areaIds: string[],
  powerZoneId: string,
) => {
  const areas = await prisma.area.findMany({
    where: { id: { in: areaIds }, deletedAt: null },
    include: { feeder: { include: { substation: true } } },
  });

  if (areas.length !== areaIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "One or more areas were not found",
    );
  }

  const mismatched = areas.find(
    (area) => area.feeder.substation.powerZoneId !== powerZoneId,
  );

  if (mismatched) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Area "${mismatched.name}" does not belong to the selected zone`,
    );
  }
};

const getAffectedCustomers = (areaIds: string[]) =>
  prisma.user.findMany({
    where: {
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      areaId: { in: areaIds },
    },
    select: { id: true, name: true, email: true },
  });

const notifyCustomers = async (
  recipients: { id: string; name: string; email: string }[],
  subject: string,
  templateFile: string,
  templateData: Record<string, unknown>,
) => {
  const templatePath = path.join(
    process.cwd(),
    "src/app/templates",
    templateFile,
  );
  const html = await ejs.renderFile(templatePath, templateData);

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
            type: EmailType.SCHEDULE_NOTIFICATION,
            subject,
            status: EmailStatus.SENT,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        await prisma.emailLog.create({
          data: {
            userId: recipient.id,
            type: EmailType.SCHEDULE_NOTIFICATION,
            subject,
            status: EmailStatus.FAILED,
            error:
              error instanceof Error ? error.message : "Unknown email error",
          },
        });
      }
    }),
  );
};

// ---------- CRUD ----------

const createSchedule = async (
  payload: ICreateSchedulePayload,
  requestUser: IRequestUser,
) => {
  const powerZoneId = await resolveZoneScopeForCreate(
    requestUser,
    payload.powerZoneId,
  );

  const zone = await prisma.powerZone.findFirst({
    where: { id: powerZoneId, deletedAt: null },
  });
  if (!zone) {
    throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
  }

  await validateAreasBelongToZone(payload.areaIds, powerZoneId);

  // Skipping DRAFT entirely -- schedules are created directly as PENDING,
  // awaiting Admin approval.
  const schedule = await prisma.loadSheddingSchedule.create({
    data: {
      title: payload.title,
      reason: payload.reason,
      startTime: new Date(payload.startTime),
      endTime: new Date(payload.endTime),
      status: ScheduleStatus.PENDING,
      powerZoneId,
      createdById: requestUser.userId,
      areas: { connect: payload.areaIds.map((id) => ({ id })) },
    },
    include: { areas: true, powerZone: true },
  });

  return schedule;
};

const getAllSchedules = async (
  query: IGetAllSchedulesQuery,
  requestUser: IRequestUser,
) => {
  const {
    page = 1,
    limit = 10,
    search,
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
    zoneScope = { powerZoneId: zoneManager?.managedZoneId ?? "__none__" };
  } else if (powerZoneId) {
    zoneScope = { powerZoneId };
  }

  const where = {
    ...zoneScope,
    ...(status && { status }),
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [schedules, total] = await Promise.all([
    prisma.loadSheddingSchedule.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        powerZone: { select: { id: true, name: true } },
        areas: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.loadSheddingSchedule.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: schedules,
  };
};

const getExistingScheduleOrThrow = async (id: string) => {
  const schedule = await prisma.loadSheddingSchedule.findUnique({
    where: { id },
    include: { areas: true },
  });

  if (!schedule) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Load shedding schedule not found",
    );
  }

  return schedule;
};

const getScheduleById = async (id: string, requestUser: IRequestUser) => {
  const schedule = await getExistingScheduleOrThrow(id);
  await assertZoneManagerOwnsSchedule(schedule.powerZoneId, requestUser);
  return schedule;
};

const updateSchedule = async (
  id: string,
  payload: IUpdateSchedulePayload,
  requestUser: IRequestUser,
) => {
  const schedule = await getExistingScheduleOrThrow(id);
  await assertZoneManagerOwnsSchedule(schedule.powerZoneId, requestUser);

  if (schedule.status !== ScheduleStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot edit a schedule with status "${schedule.status}". Only PENDING schedules can be edited.`,
    );
  }

  const newStartTime = payload.startTime
    ? new Date(payload.startTime)
    : schedule.startTime;
  const newEndTime = payload.endTime
    ? new Date(payload.endTime)
    : schedule.endTime;

  if (newEndTime <= newStartTime) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "End time must be after start time",
    );
  }

  if (payload.areaIds) {
    await validateAreasBelongToZone(payload.areaIds, schedule.powerZoneId);
  }

  const updated = await prisma.loadSheddingSchedule.update({
    where: { id },
    data: {
      title: payload.title,
      reason: payload.reason,
      startTime: newStartTime,
      endTime: newEndTime,
      ...(payload.areaIds && {
        areas: { set: payload.areaIds.map((areaId) => ({ id: areaId })) },
      }),
    },
    include: { areas: true },
  });

  return updated;
};

const approveSchedule = async (id: string, requestUser: IRequestUser) => {
  // Route-level auth already restricts this to ADMIN only.
  const schedule = await getExistingScheduleOrThrow(id);

  if (schedule.status !== ScheduleStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot approve a schedule with status "${schedule.status}". Only PENDING schedules can be approved.`,
    );
  }

  const areaIds = schedule.areas.map((area) => area.id);

  // Conflict detection: any OTHER schedule already APPROVED/ACTIVE that
  // shares at least one area AND overlaps in time.
  const conflict = await prisma.loadSheddingSchedule.findFirst({
    where: {
      id: { not: id },
      status: { in: [ScheduleStatus.APPROVED, ScheduleStatus.ACTIVE] },
      areas: { some: { id: { in: areaIds } } },
      startTime: { lt: schedule.endTime },
      endTime: { gt: schedule.startTime },
    },
    select: { id: true, title: true, startTime: true, endTime: true },
  });

  if (conflict) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `This schedule conflicts with an existing approved schedule "${conflict.title}" (${conflict.startTime.toISOString()} - ${conflict.endTime.toISOString()}) covering an overlapping area`,
    );
  }

  const approved = await prisma.loadSheddingSchedule.update({
    where: { id },
    data: {
      status: ScheduleStatus.APPROVED,
      approvedById: requestUser.userId,
      approvedAt: new Date(),
    },
    include: { areas: true },
  });

  const recipients = await getAffectedCustomers(areaIds);
  await notifyCustomers(
    recipients,
    `[GridFlow] Scheduled load shedding: ${schedule.title}`,
    "schedule-approved.ejs",
    {
      title: schedule.title,
      reason: schedule.reason,
      startTime: schedule.startTime.toLocaleString(),
      endTime: schedule.endTime.toLocaleString(),
    },
  );

  return { ...approved, notifiedCustomers: recipients.length };
};

const cancelSchedule = async (id: string, requestUser: IRequestUser) => {
  const schedule = await getExistingScheduleOrThrow(id);
  await assertZoneManagerOwnsSchedule(schedule.powerZoneId, requestUser);

  if (
    schedule.status !== ScheduleStatus.PENDING &&
    schedule.status !== ScheduleStatus.APPROVED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot cancel a schedule with status "${schedule.status}". Only PENDING or APPROVED schedules can be cancelled.`,
    );
  }

  const wasApproved = schedule.status === ScheduleStatus.APPROVED;

  const cancelled = await prisma.loadSheddingSchedule.update({
    where: { id },
    data: { status: ScheduleStatus.CANCELLED },
    include: { areas: true },
  });

  // Only notify if customers had already been told about it (i.e. it was
  // APPROVED). No point emailing a cancellation nobody was told about.
  if (wasApproved) {
    const areaIds = schedule.areas.map((area) => area.id);
    const recipients = await getAffectedCustomers(areaIds);
    await notifyCustomers(
      recipients,
      `[GridFlow] Cancelled: ${schedule.title}`,
      "schedule-cancelled.ejs",
      {
        title: schedule.title,
        startTime: schedule.startTime.toLocaleString(),
        endTime: schedule.endTime.toLocaleString(),
      },
    );
  }

  return cancelled;
};

export const ScheduleService = {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  updateSchedule,
  approveSchedule,
  cancelSchedule,
};
