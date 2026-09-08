import path from "node:path";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  AssignmentStatus,
  EmailStatus,
  EmailType,
  OutageStatus,
  Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

import type { IRequestUser } from "../auth/auth.interface";
import { transporter } from "../../lib/nodemailer";
import {
  ICreateAssignmentPayload,
  ICreateRepairUpdatePayload,
  IGetAllAssignmentsQuery,
  IGetMyAssignmentsQuery,
  IRejectAssignmentPayload,
} from "./technician-assignment.interface";

const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.PENDING,
  AssignmentStatus.ACCEPTED,
  AssignmentStatus.IN_PROGRESS,
];

// ---------- shared helpers ----------

const getOutageZoneId = async (outageId: string) => {
  const outage = await prisma.outage.findUnique({
    where: { id: outageId },
    include: { feeder: { include: { substation: true } } },
  });
  return { outage, zoneId: outage?.feeder.substation.powerZoneId };
};

const assertZoneManagerOwnsZone = async (
  zoneId: string | undefined,
  requestUser: IRequestUser,
) => {
  if (requestUser.role !== Role.ZONE_MANAGER) return;

  const zoneManager = await prisma.user.findFirst({
    where: { id: requestUser.userId, deletedAt: null },
  });

  if (!zoneManager?.managedZoneId || zoneManager.managedZoneId !== zoneId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only manage assignments in your own zone",
    );
  }
};

const sendEmail = async (
  userId: string,
  to: string,
  subject: string,
  templateFile: string,
  templateData: Record<string, unknown>,
) => {
  try {
    const templatePath = path.join(
      process.cwd(),
      "src/app/templates",
      templateFile,
    );
    const html = await ejs.renderFile(templatePath, templateData);

    await transporter.sendMail({
      from: config.email_sender,
      to,
      subject,
      html,
    });

    await prisma.emailLog.create({
      data: {
        userId,
        type: EmailType.OUTAGE_UPDATE,
        subject,
        status: EmailStatus.SENT,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        userId,
        type: EmailType.OUTAGE_UPDATE,
        subject,
        status: EmailStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown email error",
      },
    });
  }
};

// ---------- create / assign ----------

const createAssignment = async (
  outageId: string,
  payload: ICreateAssignmentPayload,
  requestUser: IRequestUser,
) => {
  const { outage, zoneId } = await getOutageZoneId(outageId);

  if (!outage) {
    throw new AppError(httpStatus.NOT_FOUND, "Outage not found");
  }

  await assertZoneManagerOwnsZone(zoneId, requestUser);

  if (
    outage.status !== OutageStatus.VERIFIED &&
    outage.status !== OutageStatus.ASSIGNED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot assign a technician to an outage with status "${outage.status}". The outage must be VERIFIED first.`,
    );
  }

  const existingActive = await prisma.technicianAssignment.findFirst({
    where: { outageId, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
  });

  if (existingActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This outage already has an active assignment",
    );
  }

  const technician = await prisma.user.findFirst({
    where: { id: payload.technicianId, deletedAt: null },
  });

  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician not found");
  }

  if (
    technician.role !== Role.TECHNICIAN ||
    technician.status !== UserStatus.ACTIVE
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Selected user is not an active technician",
    );
  }

  // Business rule: a technician can only be assigned within their own zone,
  // regardless of who (Admin or Zone Manager) is doing the assigning.
  if (technician.technicianZoneId !== zoneId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This technician does not belong to the zone this outage is in",
    );
  }

  const assignment = await prisma.technicianAssignment.create({
    data: {
      outageId,
      technicianId: payload.technicianId,
      assignedById: requestUser.userId,
      isPriority: payload.isPriority ?? false,
      status: AssignmentStatus.PENDING,
    },
    include: { outage: { include: { feeder: true } } },
  });

  if (outage.status !== OutageStatus.ASSIGNED) {
    await prisma.outage.update({
      where: { id: outageId },
      data: { status: OutageStatus.ASSIGNED },
    });
  }

  await sendEmail(
    technician.id,
    technician.email,
    "[GridFlow] New repair assignment",
    "assignment-notify.ejs",
    {
      technicianName: technician.name,
      feederName: assignment.outage.feeder.name,
      isPriority: assignment.isPriority,
    },
  );

  return assignment;
};

// ---------- staff listing ----------

const getAllAssignments = async (
  query: IGetAllAssignmentsQuery,
  requestUser: IRequestUser,
) => {
  const {
    page = 1,
    limit = 10,
    status,
    outageId,
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
      outage: {
        feeder: {
          substation: { powerZoneId: zoneManager?.managedZoneId ?? "__none__" },
        },
      },
    };
  } else if (powerZoneId) {
    zoneScope = { outage: { feeder: { substation: { powerZoneId } } } };
  }

  const where = {
    ...zoneScope,
    ...(status && { status }),
    ...(outageId && { outageId }),
  };

  const [assignments, total] = await Promise.all([
    prisma.technicianAssignment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        technician: {
          select: { id: true, name: true, email: true, phone: true },
        },
        assignedBy: { select: { id: true, name: true } },
        outage: {
          select: {
            id: true,
            status: true,
            feeder: { select: { id: true, name: true } },
          },
        },
        _count: { select: { repairUpdates: true } },
      },
    }),
    prisma.technicianAssignment.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: assignments,
  };
};

const getAssignmentByIdStaff = async (
  id: string,
  requestUser: IRequestUser,
) => {
  const assignment = await prisma.technicianAssignment.findUnique({
    where: { id },
    include: {
      technician: {
        select: { id: true, name: true, email: true, phone: true },
      },
      assignedBy: { select: { id: true, name: true } },
      outage: { include: { feeder: { include: { substation: true } } } },
      repairUpdates: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }

  await assertZoneManagerOwnsZone(
    assignment.outage.feeder.substation.powerZoneId,
    requestUser,
  );

  return assignment;
};

// ---------- technician self-service ----------

const getMyAssignments = async (
  technicianId: string,
  query: IGetMyAssignmentsQuery,
) => {
  const { page = 1, limit = 10, status } = query;
  const skip = (page - 1) * limit;

  const where = { technicianId, ...(status && { status }) };

  const [assignments, total] = await Promise.all([
    prisma.technicianAssignment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        outage: {
          select: {
            id: true,
            status: true,
            feeder: { select: { id: true, name: true } },
          },
        },
        _count: { select: { repairUpdates: true } },
      },
    }),
    prisma.technicianAssignment.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: assignments,
  };
};

const getMyAssignmentById = async (technicianId: string, id: string) => {
  // Ownership check baked into the query -- a mismatch returns NOT_FOUND,
  // not FORBIDDEN, so we don't leak whether the id exists at all.
  const assignment = await prisma.technicianAssignment.findFirst({
    where: { id, technicianId },
    include: {
      outage: { include: { feeder: true } },
      repairUpdates: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }

  return assignment;
};

const getOwnedAssignmentOrThrow = async (technicianId: string, id: string) => {
  const assignment = await prisma.technicianAssignment.findFirst({
    where: { id, technicianId },
    include: { outage: { include: { feeder: true } }, assignedBy: true },
  });

  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }

  return assignment;
};

const acceptAssignment = async (technicianId: string, id: string) => {
  const assignment = await getOwnedAssignmentOrThrow(technicianId, id);

  if (assignment.status !== AssignmentStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot accept an assignment with status "${assignment.status}". Only PENDING assignments can be accepted.`,
    );
  }

  return prisma.technicianAssignment.update({
    where: { id },
    data: { status: AssignmentStatus.ACCEPTED },
  });
};

const rejectAssignment = async (
  technicianId: string,
  id: string,
  payload: IRejectAssignmentPayload,
) => {
  const assignment = await getOwnedAssignmentOrThrow(technicianId, id);

  if (assignment.status !== AssignmentStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot reject an assignment with status "${assignment.status}". Only PENDING assignments can be rejected.`,
    );
  }

  const updated = await prisma.technicianAssignment.update({
    where: { id },
    data: {
      status: AssignmentStatus.REJECTED,
      rejectionReason: payload.rejectionReason,
    },
  });

  // If no other active assignment exists for this outage, drop it back to
  // VERIFIED so a Zone Manager/Admin can reassign someone else.
  const stillActive = await prisma.technicianAssignment.findFirst({
    where: {
      outageId: assignment.outageId,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
    },
  });

  if (!stillActive) {
    await prisma.outage.update({
      where: { id: assignment.outageId },
      data: { status: OutageStatus.VERIFIED },
    });
  }

  const technician = await prisma.user.findUnique({
    where: { id: technicianId },
  });

  await sendEmail(
    assignment.assignedById,
    assignment.assignedBy.email,
    "[GridFlow] Technician rejected assignment",
    "assignment-rejected.ejs",
    {
      assignedByName: assignment.assignedBy.name,
      technicianName: technician?.name,
      feederName: assignment.outage.feeder.name,
      rejectionReason: payload.rejectionReason,
    },
  );

  return updated;
};

const startAssignment = async (technicianId: string, id: string) => {
  const assignment = await getOwnedAssignmentOrThrow(technicianId, id);

  if (assignment.status !== AssignmentStatus.ACCEPTED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot start an assignment with status "${assignment.status}". Only ACCEPTED assignments can be started.`,
    );
  }

  const [updatedAssignment] = await prisma.$transaction([
    prisma.technicianAssignment.update({
      where: { id },
      data: { status: AssignmentStatus.IN_PROGRESS, startedAt: new Date() },
    }),
    prisma.outage.update({
      where: { id: assignment.outageId },
      data: { status: OutageStatus.IN_PROGRESS },
    }),
  ]);

  return updatedAssignment;
};

const addRepairUpdate = async (
  technicianId: string,
  assignmentId: string,
  payload: ICreateRepairUpdatePayload,
) => {
  const assignment = await getOwnedAssignmentOrThrow(
    technicianId,
    assignmentId,
  );

  if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You can only log repair updates while the assignment is IN_PROGRESS",
    );
  }

  return prisma.repairUpdate.create({
    data: {
      assignmentId,
      technicianId,
      note: payload.note,
    },
  });
};

const getRepairUpdates = async (
  assignmentId: string,
  requestUser: IRequestUser,
) => {
  const assignment = await prisma.technicianAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      outage: { include: { feeder: { include: { substation: true } } } },
    },
  });

  if (!assignment) {
    throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
  }

  if (requestUser.role === Role.TECHNICIAN) {
    if (assignment.technicianId !== requestUser.userId) {
      throw new AppError(httpStatus.NOT_FOUND, "Assignment not found");
    }
  } else {
    await assertZoneManagerOwnsZone(
      assignment.outage.feeder.substation.powerZoneId,
      requestUser,
    );
  }

  return prisma.repairUpdate.findMany({
    where: { assignmentId },
    orderBy: { createdAt: "desc" },
  });
};

const completeAssignment = async (technicianId: string, id: string) => {
  const assignment = await getOwnedAssignmentOrThrow(technicianId, id);

  if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot complete an assignment with status "${assignment.status}". Only IN_PROGRESS assignments can be completed.`,
    );
  }

  // Business rule: technician must log at least one repair update before
  // marking the job done -- prevents a no-evidence "complete" click.
  const repairUpdateCount = await prisma.repairUpdate.count({
    where: { assignmentId: id },
  });

  if (repairUpdateCount === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please log at least one repair update before marking this assignment complete",
    );
  }

  const [updatedAssignment] = await prisma.$transaction([
    prisma.technicianAssignment.update({
      where: { id },
      data: { status: AssignmentStatus.COMPLETED },
    }),
    prisma.outage.update({
      where: { id: assignment.outageId },
      data: { status: OutageStatus.RESTORED },
    }),
  ]);

  return updatedAssignment;
};

export const TechnicianAssignmentService = {
  createAssignment,
  getAllAssignments,
  getAssignmentByIdStaff,
  getMyAssignments,
  getMyAssignmentById,
  acceptAssignment,
  rejectAssignment,
  startAssignment,
  addRepairUpdate,
  getRepairUpdates,
  completeAssignment,
};
