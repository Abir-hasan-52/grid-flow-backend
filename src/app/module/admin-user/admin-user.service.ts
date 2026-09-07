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
import { ICreateAdminPayload, ICreateZoneManagerPayload } from "./admin-user.interface";
 

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
    throw new AppError(httpStatus.BAD_REQUEST, "A user with this email already exists");
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
    throw new AppError(httpStatus.BAD_REQUEST, "A user with this email already exists");
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

export const AdminUserService = {
  createAdmin,
  createZoneManager,
};