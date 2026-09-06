import { Role } from "../../../../generated/prisma/enums";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import type { IUpdateMyProfilePayload } from "./user.interface";
import type { IRequestUser } from "../auth/auth.interface";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, ImagePublicId: true },
  });

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "gridflow/profile-images",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(
            new AppError(httpStatus.BAD_REQUEST, "Failed to upload image to Cloudinary"),
          );
        }
        if (!result?.secure_url || !result?.public_id) {
          return reject(new AppError(httpStatus.BAD_REQUEST, "Cloudinary upload failed"));
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
    stream.end(buffer);
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ImageUrl: result.secure_url,
      ImagePublicId: result.public_id,
    },
    omit: { password: true },
  });

  if (existingUser.ImagePublicId) {
    try {
      await cloudinary.uploader.destroy(existingUser.ImagePublicId, {
        resource_type: "image",
      });
    } catch (error) {
      console.error("Failed to delete old profile image:", error);
    }
  }

  return user;
};

const updateMyProfile = async (
  requestUser: IRequestUser,
  payload: IUpdateMyProfilePayload,
) => {
  const existingUser = await prisma.user.findFirst({
    where: { id: requestUser.userId, deletedAt: null },
  });

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (payload.areaId && existingUser.role !== Role.CUSTOMER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only customers can update their area");
  }

  let validatedAreaId: string | undefined;
  if (payload.areaId && existingUser.role === Role.CUSTOMER) {
    const area = await prisma.area.findFirst({
      where: { id: payload.areaId, deletedAt: null },
    });

    if (!area) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid area selected");
    }

    validatedAreaId = payload.areaId;
  }

  const updatedUser = await prisma.user.update({
    where: { id: existingUser.id },
    data: {
      name: payload.name,
      phone: payload.phone,
      ...(validatedAreaId && { areaId: validatedAreaId }),
    },
    omit: { password: true },
  });

  return updatedUser;
};

export const UserService = {
  uploadProfileImage,
  updateMyProfile,
};