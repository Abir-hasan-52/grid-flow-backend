import crypto from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  EmailStatus,
  EmailType,
  Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
// import { transporter } from "../../lib/mailer";
import { AppError } from "../../utils/AppError";
import { transporter } from "../../lib/nodemailer";
import type {
  ICreateAdminPayload,
  ICreateZoneManagerPayload,
  IGetAllUsersQuery,
} from "./admin-user.interface";
import type { Prisma } from "../../../../generated/prisma/client";

// Readable-ish random password: mix of upper/lower/digits/symbol,
// satisfies the same strength rules as the reset-password validation.
const generateTempPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no ambiguous I/O
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";

  const pick = (chars: string) => chars[crypto.randomInt(0, chars.length)];

  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const all = upper + lower + digits + symbols;

  for (let i = 0; i < 8; i++) {
    base.push(pick(all));
  }

  // shuffle so the fixed-category chars aren't always in the same position
  for (let i = base.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }

  return base.join("");
};

const sendAccountCreatedEmail = async (
  userId: string,
  name: string,
  email: string,
  role: string,
  tempPassword: string,
) => {
  const subject = "Your GridFlow account has been created";

  try {
    const templatePath = path.join(
      process.cwd(),
      "src/app/templates/account-created.ejs",
    );
    const html = await ejs.renderFile(templatePath, {
      name,
      email,
      role,
      tempPassword,
    });

    await transporter.sendMail({
      from: config.email_sender,
      to: email,
      subject,
      html,
    });

    await prisma.emailLog.create({
      data: {
        userId,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.SENT,
        sentAt: new Date(),
      },
    });

    return { emailSent: true };
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        userId,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown email error",
      },
    });

    return { emailSent: false };
  }
};

const createAdmin = async (payload: ICreateAdminPayload) => {
  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A user with this email already exists",
    );
  }

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(
    tempPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const admin = await prisma.user.create({
    data: {
      name: payload.name,
      email,
      password: hashedPassword,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true, // admin-created accounts skip the OTP-verify flow
      emailVerifiedAt: new Date(),
    },
    omit: { password: true },
  });

  const { emailSent } = await sendAccountCreatedEmail(
    admin.id,
    admin.name,
    admin.email,
    "Admin",
    tempPassword,
  );

  return { user: admin, emailSent };
};

const createZoneManager = async (payload: ICreateZoneManagerPayload) => {
  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A user with this email already exists",
    );
  }

  const zone = await prisma.powerZone.findFirst({
    where: { id: payload.managedZoneId, deletedAt: null },
  });
  if (!zone) {
    throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
  }

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(
    tempPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const zoneManager = await prisma.user.create({
    data: {
      name: payload.name,
      email,
      password: hashedPassword,
      role: Role.ZONE_MANAGER,
      managedZoneId: payload.managedZoneId,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    omit: { password: true },
  });

  const { emailSent } = await sendAccountCreatedEmail(
    zoneManager.id,
    zoneManager.name,
    zoneManager.email,
    "Zone Manager",
    tempPassword,
  );

  return { user: zoneManager, emailSent };
};

// GET ALL USERS

const getAllUsers = async (query: IGetAllUsersQuery) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  // Search

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
    ];
  }

  // Role filter

  if (query.role) {
    where.role = query.role;
  }

  // Status filter

  if (query.status) {
    where.status = query.status;
  } else {
    // By default deleted users won't appear in normal user list.
    where.status = { not: UserStatus.DELETED };
  }

  // Sorting

  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        isActive: true,
        authProvider: true,
        emailVerified: true,
        emailVerifiedAt: true,
        managedZoneId: true,
        areaId: true,
        technicianZoneId: true,
        ImageUrl: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    }),

    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

// GET SINGLE USER

const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      isActive: true,
      authProvider: true,
      emailVerified: true,
      emailVerifiedAt: true,
      managedZoneId: true,
      areaId: true,
      technicianZoneId: true,
      ImageUrl: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// SUSPEND USER

const suspendUser = async (userId: string, adminId: string) => {
  if (userId === adminId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You cannot suspend your own account",
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.DELETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Deleted user cannot be suspended",
    );
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already suspended");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.SUSPENDED, isActive: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
    },
  });

  return updatedUser;
};

// ACTIVATE USER

const activateUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.DELETED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Deleted user cannot be activated",
    );
  }

  if (user.status === UserStatus.ACTIVE) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already active");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
    },
  });

  return updatedUser;
};

// SOFT DELETE USER

const deleteUser = async (userId: string, adminId: string) => {
  if (userId === adminId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You cannot delete your own account",
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already deleted");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.DELETED,
      isActive: false,
      deletedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
      deletedAt: true,
    },
  });

  return updatedUser;
};

export const AdminUserService = {
  createAdmin,
  createZoneManager,
  getAllUsers,
  getUserById,
  suspendUser,
  activateUser,
  deleteUser,
};
