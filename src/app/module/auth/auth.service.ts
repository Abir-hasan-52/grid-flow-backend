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
  IRegisterPatientPayload,
  IRequestUser,
  IResetPasswordPayload,
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

const registerPatient = async (payload: IRegisterPatientPayload) => {
  const { name, password } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 8);

  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    },
    omit: { password: true },
  });

  const { ...user } = createdUser;
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
    user,

    accessToken,
    refreshToken,
  };
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new Error("User is suspended");
  }

  if (user.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }
  if (user.password === null || user.password === undefined) {
    throw new Error("User does not have a password set");
  }

  if (user.password === null && user.googleId !== null) {
    throw new Error(
      "User registered with Google login. Please use Google login.",
    );
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new Error("Invalid credentials");
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
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },

    omit: {
      password: true,
    },
  });

  if (!isUserExists) {
    throw new Error("User not found");
  }

  return isUserExists;
};

const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new Error(
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new Error("User is inactive or not found");
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
  registerPatient,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
};
