import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

const uploadProfileImage = async (
  buffer: Buffer,
  userId: string,
) => {
  // 1. Check user exists
  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      ImagePublicId: true,
    },
  });

  if (!existingUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  // 2. Upload image to Cloudinary
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
            new AppError(
              httpStatus.BAD_REQUEST,
              "Failed to upload image to Cloudinary",
            ),
          );
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(
            new AppError(
              httpStatus.BAD_REQUEST,
              "Cloudinary upload failed",
            ),
          );
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    stream.end(buffer);
  });

  // 3. Update user's profile image
  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      ImageUrl: result.secure_url,
      ImagePublicId: result.public_id,
    },
    omit: {
      password: true,
    },
  });

  // 4. Delete previous image from Cloudinary
  if (existingUser.ImagePublicId) {
    try {
      await cloudinary.uploader.destroy(
        existingUser.ImagePublicId,
        {
          resource_type: "image",
        },
      );
    } catch (error) {
      console.error(
        "Failed to delete old profile image:",
        error,
      );
    }
  }

  return user;
};

export const UserService = {
  uploadProfileImage,
};