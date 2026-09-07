import path from "node:path";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  EmailStatus,
  EmailType,
  OutageStatus,
  Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
// import { transporter } from "../../lib/mailer";
import { AppError } from "../../utils/AppError";
import type {
  ICreateManualOutagePayload,
  ICreateOutageReportPayload,
  IGetAllOutagesQuery,
  IGetMyReportsQuery,
} from "./outage.interface";
import type { IRequestUser } from "../auth/auth.interface";
import { transporter } from "../../lib/nodemailer";

// Outage statuses that count as "still open" -- new reports for the same
// feeder should merge into one of these instead of creating a duplicate.
const OPEN_STATUSES: OutageStatus[] = [
  OutageStatus.REPORTED,
  OutageStatus.VERIFIED,
  OutageStatus.ASSIGNED,
  OutageStatus.IN_PROGRESS,
];

// ---------- shared helpers ----------

const getFeederZoneId = async (feederId: string) => {
  const feeder = await prisma.feeder.findFirst({
    where: { id: feederId, deletedAt: null },
    include: { substation: true },
  });
  return feeder?.substation.powerZoneId;
};

const assertZoneManagerOwnsOutage = async (feederId: string, requestUser: IRequestUser) => {
  if (requestUser.role !== Role.ZONE_MANAGER) return;

  const zoneManager = await prisma.user.findFirst({
    where: { id: requestUser.userId, deletedAt: null },
  });

  const feederZoneId = await getFeederZoneId(feederId);

  if (!zoneManager?.managedZoneId || zoneManager.managedZoneId !== feederZoneId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only manage outages in your own zone",
    );
  }
};

const getAffectedCustomersForFeeder = (feederId: string) =>
  prisma.user.findMany({
    where: {
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      area: { feederId },
    },
    select: { id: true, name: true, email: true },
  });

const notifyCustomers = async (
  recipients: { id: string; name: string; email: string }[],
  subject: string,
  templateFile: string,
) => {
  const templatePath = path.join(process.cwd(), "src/app/templates", templateFile);
  const html = await ejs.renderFile(templatePath, {});

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
            type: EmailType.OUTAGE_UPDATE,
            subject,
            status: EmailStatus.SENT,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        await prisma.emailLog.create({
          data: {
            userId: recipient.id,
            type: EmailType.OUTAGE_UPDATE,
            subject,
            status: EmailStatus.FAILED,
            error: error instanceof Error ? error.message : "Unknown email error",
          },
        });
      }
    }),
  );
};

const getExistingOutageOrThrow = async (id: string) => {
  const outage = await prisma.outage.findUnique({
    where: { id },
    include: { feeder: { include: { substation: true } } },
  });

  if (!outage) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage not found");
  }

  return outage;
};

// ---------- customer-facing ----------

const reportOutage = async (
  customerId: string,
  payload: ICreateOutageReportPayload,
) => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, deletedAt: null },
  });

  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!customer.areaId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please update your profile with your area before reporting an outage",
    );
  }

  const area = await prisma.area.findFirst({
    where: { id: customer.areaId, deletedAt: null },
  });

  if (!area) {
    throw new AppError(httpStatus.BAD_REQUEST, "Your assigned area is no longer valid");
  }

  // Core dedup logic: reuse any already-open outage for this feeder instead
  // of creating a new one every time a customer reports.
  const existingOpenOutage = await prisma.outage.findFirst({
    where: {
      feederId: area.feederId,
      status: { in: OPEN_STATUSES },
    },
  });

  if (existingOpenOutage) {
    const alreadyReported = await prisma.outageReport.findFirst({
      where: { customerId, outageId: existingOpenOutage.id },
    });

    if (alreadyReported) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You have already reported this outage",
      );
    }

    const report = await prisma.outageReport.create({
      data: {
        customerId,
        outageId: existingOpenOutage.id,
        description: payload.description,
      },
    });

    return { outage: existingOpenOutage, report, merged: true };
  }

  const newOutage = await prisma.outage.create({
    data: {
      feederId: area.feederId,
      status: OutageStatus.REPORTED,
    },
  });

  const report = await prisma.outageReport.create({
    data: {
      customerId,
      outageId: newOutage.id,
      description: payload.description,
    },
  });

  return { outage: newOutage, report, merged: false };
};

const getMyReports = async (customerId: string, query: IGetMyReportsQuery) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = { customerId };

  const [reports, total] = await Promise.all([
    prisma.outageReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        outage: { select: { id: true, status: true, createdAt: true, closedAt: true } },
      },
    }),
    prisma.outageReport.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: reports,
  };
};

// ---------- staff-facing ----------

const getAllOutages = async (
  query: IGetAllOutagesQuery,
  requestUser: IRequestUser,
) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    feederId,
    powerZoneId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (page - 1) * limit;

  let zoneScope: Record<string, unknown> = {};

  if (requestUser.role === Role.ZONE_MANAGER) {
    const zoneManager = await prisma.user.findFirst({
      where: { id: requestUser.userId, deletedAt: null },
    });
    zoneScope = {
      feeder: { substation: { powerZoneId: zoneManager?.managedZoneId ?? "__none__" } },
    };
  } else if (powerZoneId) {
    zoneScope = { feeder: { substation: { powerZoneId } } };
  }

  const where = {
    ...zoneScope,
    ...(status && { status }),
    ...(feederId && { feederId }),
    ...(search && {
      feeder: { name: { contains: search, mode: "insensitive" as const } },
    }),
  };

  const [outages, total] = await Promise.all([
    prisma.outage.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        feeder: {
          select: {
            id: true,
            name: true,
            substation: { select: { powerZone: { select: { id: true, name: true } } } },
          },
        },
        verifiedBy: { select: { id: true, name: true } },
        _count: { select: { reports: true, assignments: true } },
      },
    }),
    prisma.outage.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: outages,
  };
};

const getOutageById = async (id: string, requestUser: IRequestUser) => {
  const outage = await prisma.outage.findUnique({
    where: { id },
    include: {
      feeder: {
        include: { substation: { include: { powerZone: true } } },
      },
      verifiedBy: { select: { id: true, name: true } },
      reports: {
        include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!outage) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage not found");
  }

  await assertZoneManagerOwnsOutage(outage.feederId, requestUser);

  return outage;
};

const createManualOutage = async (
  payload: ICreateManualOutagePayload,
  requestUser: IRequestUser,
) => {
  const feeder = await prisma.feeder.findFirst({
    where: { id: payload.feederId, deletedAt: null },
  });

  if (!feeder) {
    throw new AppError(httpStatus.NOT_FOUND, "Feeder not found");
  }

  await assertZoneManagerOwnsOutage(payload.feederId, requestUser);

  const existingOpenOutage = await prisma.outage.findFirst({
    where: { feederId: payload.feederId, status: { in: OPEN_STATUSES } },
  });

  if (existingOpenOutage) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "An open outage already exists for this feeder",
    );
  }

  // Staff-detected outages are considered already confirmed -- create them
  // directly as VERIFIED rather than REPORTED, skipping the separate verify step.
  const outage = await prisma.outage.create({
    data: {
      feederId: payload.feederId,
      status: OutageStatus.VERIFIED,
      verifiedById: requestUser.userId,
      verifiedAt: new Date(),
    },
  });

  const recipients = await getAffectedCustomersForFeeder(payload.feederId);
  await notifyCustomers(
    recipients,
    "[GridFlow] Power outage confirmed in your area",
    "outage-verified.ejs",
  );

  return { ...outage, notifiedCustomers: recipients.length };
};

const verifyOutage = async (id: string, requestUser: IRequestUser) => {
  const outage = await getExistingOutageOrThrow(id);
  await assertZoneManagerOwnsOutage(outage.feederId, requestUser);

  if (outage.status !== OutageStatus.REPORTED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot verify an outage with status "${outage.status}". Only REPORTED outages can be verified.`,
    );
  }

  const verified = await prisma.outage.update({
    where: { id },
    data: {
      status: OutageStatus.VERIFIED,
      verifiedById: requestUser.userId,
      verifiedAt: new Date(),
    },
  });

  const recipients = await getAffectedCustomersForFeeder(outage.feederId);
  await notifyCustomers(
    recipients,
    "[GridFlow] Power outage confirmed in your area",
    "outage-verified.ejs",
  );

  return { ...verified, notifiedCustomers: recipients.length };
};

const closeOutage = async (id: string, requestUser: IRequestUser) => {
  const outage = await getExistingOutageOrThrow(id);
  await assertZoneManagerOwnsOutage(outage.feederId, requestUser);

  if (outage.status !== OutageStatus.RESTORED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot close an outage with status "${outage.status}". Only RESTORED outages can be closed.`,
    );
  }

  const closed = await prisma.outage.update({
    where: { id },
    data: {
      status: OutageStatus.CLOSED,
      closedAt: new Date(),
    },
  });

  const recipients = await getAffectedCustomersForFeeder(outage.feederId);
  await notifyCustomers(
    recipients,
    "[GridFlow] Power restored in your area",
    "outage-closed.ejs",
  );

  return { ...closed, notifiedCustomers: recipients.length };
};

export const OutageService = {
  reportOutage,
  getMyReports,
  getAllOutages,
  getOutageById,
  createManualOutage,
  verifyOutage,
  closeOutage,
};