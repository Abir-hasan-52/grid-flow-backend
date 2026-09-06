/** biome-ignore-all assist/source/organizeImports: <explanation> */
/** biome-ignore-all lint/style/useImportType: <explanation> */
import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import crypto from "crypto";
import ejs from "ejs";
import type {
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginUserPayload,
  IRegisterCustomerPayload,
  IRequestUser,
  IResetPasswordPayload,
  IVerifyCustomerEmailPayload,
} from "./auth.interface";
import {
  AuthProvider,
  EmailStatus,
  EmailType,
  Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import { googleClient } from "../../lib/googleAuth";
import { TokenPayload } from "google-auth-library";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import path from "path";

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
  const { name, password } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User with this email already exists",
    );
  }

  // fix: areaId was never validated before -- accepted any string, even a fake/deleted id
  const area = await prisma.area.findFirst({
    where: { id: payload.areaId, deletedAt: null },
  });

  if (!area) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid area selected");
  }

  // fix: hardcoded "8" -> use config, consistent with forgotPassword/resetPassword
  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const otpValue = crypto.randomInt(100000, 1000000).toString();
  const otpKey = `register-customer-otp:${email}`;

  await redisClient.set(otpKey, otpValue, {
    expiration: { type: "EX", value: 5 * 60 }, // 5 minutes
  });

  const customerDataKey = `register-customer-data:${email}`;
  const redisCustomerDataPayload: IRegisterCustomerPayload = {
    name,
    email,
    password: hashedPassword,
    areaId: payload.areaId,
  };

  await redisClient.set(
    customerDataKey,
    JSON.stringify(redisCustomerDataPayload),
    { expiration: { type: "EX", value: 5 * 60 } },
  );

  const subject = "Verify your GridFlow account";
  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/register-customer.ejs",
  );
  const html = await ejs.renderFile(templatePath, {
    name,
    email,
    otp: otpValue,
    expiresInMinutes: 5, // fix: was "5 * 60" (300), should just be 5
  });

  // Email send is wrapped -- if it fails, the OTP/customer-data keys are already
  // in Redis but useless without the email, so we surface a clear error instead
  // of silently leaving the user stuck.
  try {
    await transporter.sendMail({
      from: config.email_sender,
      to: email,
      subject,
      html,
    });
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to send verification email. Please try registering again.",
    );
  }

  // Note: no EmailLog entry here -- there is no User row yet (account is only
  // created in verifyCustomerEmail on success). If your EmailLog.userId is a
  // required field, log after account creation in verifyCustomerEmail instead
  // (already done below), rather than making userId optional just for this case.
};

const verifyCustomerEmail = async (payload: IVerifyCustomerEmailPayload) => {
  const otp = payload.otp;
  const email = payload.email.trim().toLowerCase();

  // fix: the whole block below was inverted and unreachable. The correct check
  // at THIS stage is simply: does a user with this email already exist? (it
  // shouldn't, since registerCustomer never creates a DB row -- only Redis data)
  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User with this email already exists",
    );
  }

  const otpKey = `register-customer-otp:${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP expired or not found");
  }
  if (redisOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
  }

  const customerDataKey = `register-customer-data:${email}`;
  const redisCustomerData = await redisClient.get(customerDataKey);

  if (!redisCustomerData) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Registration data expired or not found. Please register again.",
    );
  }

  const customerDataPayload: IRegisterCustomerPayload =
    JSON.parse(redisCustomerData);

  // Area could theoretically be deleted during the 5-minute OTP window -- re-check.
  const area = await prisma.area.findFirst({
    where: { id: customerDataPayload.areaId, deletedAt: null },
  });

  if (!area) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The selected area is no longer available. Please register again.",
    );
  }

  const createdUser = await prisma.user.create({
    data: {
      name: customerDataPayload.name,
      email: customerDataPayload.email,
      password: customerDataPayload.password,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      areaId: customerDataPayload.areaId,
    },
    omit: { password: true },
  });

  // Redis keys were never cleaned up after a successful verify
  await redisClient.del([otpKey, customerDataKey]);

  await prisma.emailLog.create({
    data: {
      userId: createdUser.id,
      type: EmailType.EMAIL_VERIFICATION,
      subject: "Verify your GridFlow account",
      status: EmailStatus.SENT,
      sentAt: new Date(),
    },
  });

  const jwtPayload = {
    userId: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    user: createdUser,
    accessToken,
    refreshToken,
  };
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is suspended");
  }

  if (user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
  }

  // fix: this specific check MUST come before the generic "no password" check
  // below, otherwise it can never be reached (a Google-only user always has
  // password === null, so the generic check would fire first and swallow this
  // more useful message).
  if (user.authProvider === AuthProvider.GOOGLE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "User registered with Google login. Please use Google login.",
    );
  }

  if (!user.password) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "User does not have a password set",
    );
  }

  if (!user.emailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Please verify your email before logging in",
    );
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findFirst({
    where: {
      id: user.userId,
      deletedAt: null,
    },
    omit: {
      password: true,
    },
  });

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return isUserExists;
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      config.node_env === "development"
        ? (verifiedRefreshToken.error as string)
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findFirst({
    where: { id: data.userId, deletedAt: null },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User is inactive or not found",
    );
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const newRefreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

const logoutUser = async (refreshToken?: string) => {
  if (!refreshToken) {
    return;
  }

  const verified = jwtUtils.verifyToken(
    refreshToken,
    config.jwt_refresh_secret,
  );

  if (!verified.success || !verified.data) {
    return;
  }

  const decoded = verified.data as JwtPayload;
  const nowInSeconds = Math.floor(Date.now() / 1000);

  const ttlInSeconds = decoded.exp
    ? decoded.exp - nowInSeconds
    : 60 * 60 * 24 * 7;

  if (ttlInSeconds <= 0) {
    return;
  }

  await redisClient.set(`blacklist-refresh-token:${refreshToken}`, "true", {
    expiration: {
      type: "EX",
      value: ttlInSeconds,
    },
  });
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googleIdTokenPayload: TokenPayload | null | undefined = null;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.googleId,
      audience: config.google_client_id,
    });
    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("google id token verification failed ", error);
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Google ID token");
  }
  if (!googleIdTokenPayload) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Google ID token");
  }
  if (!googleIdTokenPayload.email) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Google ID token does not contain email",
    );
  }
  if (!googleIdTokenPayload.name) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Google ID token does not contain name",
    );
  }
  const ifCustomerExistWithGoogleId = await prisma.user.findUnique({
    where: {
      email: googleIdTokenPayload.email,
      role: Role.CUSTOMER,
      googleId: googleIdTokenPayload.sub,
    },
  });
  let user = ifCustomerExistWithGoogleId;
  if (!ifCustomerExistWithGoogleId) {
    const ifCustomerExistWithCredentials = await prisma.user.findUnique({
      where: {
        email: googleIdTokenPayload.email,
        role: Role.CUSTOMER,
        authProvider: AuthProvider.CREDENTIAL,
      },
    });

    if (ifCustomerExistWithCredentials) {
      if (!ifCustomerExistWithCredentials.emailVerified) {
        throw new AppError(httpStatus.FORBIDDEN, "User email is not verified");
      }
      if (ifCustomerExistWithCredentials.status === UserStatus.SUSPENDED) {
        throw new AppError(httpStatus.FORBIDDEN, "User is suspended");
      }
      if (ifCustomerExistWithCredentials.status === UserStatus.DELETED) {
        throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
      }
      user = await prisma.user.update({
        where: {
          id: ifCustomerExistWithCredentials.id,
        },
        data: {
          googleId: googleIdTokenPayload.sub,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name,
          email: googleIdTokenPayload.email,
          role: Role.CUSTOMER,
          googleId: googleIdTokenPayload.sub,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          authProvider: AuthProvider.GOOGLE,
        },
      });
    }
  }
  if (!user) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "User  not found or created after Google login",
    );
  }
  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is suspended");
  }
  if (user.status === UserStatus.DELETED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const { email } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: { email },
  });
  if (isUserExist?.role === Role.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Admin password reset is not allowed",
    );
  }

  if (!isUserExist) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (isUserExist.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is suspended");
  }
  if (!isUserExist.emailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, "User email is not verified");
  }
  if (
    isUserExist.deletedAt !== null &&
    isUserExist.status === UserStatus.DELETED
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
  }
  if (
    isUserExist.googleId &&
    isUserExist.authProvider === AuthProvider.GOOGLE
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "User registered with Google login. Please use Google login.",
    );
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const key = `forgot-password-${isUserExist.email}`;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: 5 * 60, // 5 minutes
    },
  });

  const subject = "Reset your GridFlow password";
  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/forgot-password.ejs",
  );
  const html = await ejs.renderFile(templatePath, {
    otp,
    userName: isUserExist.name,
    expiresInMinutes: 5,
  });

  // Email sending is wrapped so a failure is logged (not silently swallowed)
  // and the user gets a clear error instead of an unhandled crash.
  try {
    await transporter.sendMail({
      from: config.email_sender,
      to: isUserExist.email,
      subject,
      html,
    });

    await prisma.emailLog.create({
      data: {
        userId: isUserExist.id,
        type: EmailType.PASSWORD_RESET,
        subject,
        status: EmailStatus.SENT,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        userId: isUserExist.id,
        type: EmailType.PASSWORD_RESET,
        subject,
        status: EmailStatus.FAILED,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error while sending OTP email",
      },
    });

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to send OTP email. Please try again.",
    );
  }
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const { email, otp, newPassword } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: { email },
  });
  if (isUserExist?.role === Role.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Admin password reset is not allowed",
    );
  }

  if (!isUserExist) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (isUserExist.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is suspended");
  }
  if (!isUserExist.emailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, "User email is not verified");
  }
  if (
    isUserExist.deletedAt !== null &&
    isUserExist.status === UserStatus.DELETED
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
  }
  if (
    isUserExist.googleId &&
    isUserExist.authProvider === AuthProvider.GOOGLE
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "User registered with Google login. Please use Google login.",
    );
  }

  const key = `forgot-password-${isUserExist.email}`;
  const existingRedisOtp = await redisClient.get(key);

  // If the OTP is not found in Redis, it means it has expired
  if (!existingRedisOtp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP expired or not found");
  }
  if (existingRedisOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
    },
    omit: {
      password: true,
    },
  });

  // Delete the OTP from Redis after successful password reset
  await redisClient.del([key]);

  // Send a "your password was changed" confirmation email.
  // This runs AFTER the password is already updated, so a failure here
  // must NOT throw -- the reset itself already succeeded.
  const subject = "Your GridFlow password was changed";
  try {
    const templatePath = path.join(
      process.cwd(),
      "src/app/templates/password-changed.ejs",
    );
    const html = await ejs.renderFile(templatePath, {
      userName: isUserExist.name,
      email: isUserExist.email,
      changedAt: new Date().toLocaleString("en-BD", {
        timeZone: "Asia/Dhaka",
      }),
    });

    await transporter.sendMail({
      from: config.email_sender,
      to: isUserExist.email,
      subject,
      html,
    });

    await prisma.emailLog.create({
      data: {
        userId: isUserExist.id,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.SENT,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    // Log the failure but don't throw password reset already succeeded.
    await prisma.emailLog.create({
      data: {
        userId: isUserExist.id,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.FAILED,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error while sending confirmation email",
      },
    });
  }
};

export const AuthService = {
  registerCustomer,
  verifyCustomerEmail,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
  logoutUser,
};
