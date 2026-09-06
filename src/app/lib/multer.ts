import multer from "multer";
import httpStatus from "http-status";
import { AppError } from "../utils/AppError";

// Shared storage engine -- both image and document uploads use memory
// (buffer), since both go straight to Cloudinary without touching disk.
const storage = multer.memoryStorage();

const createUploader = (allowedMimeTypes: string[], maxSizeMB: number) =>
  multer({
    storage,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(
          new AppError(
            httpStatus.BAD_REQUEST,
            `Invalid file type. Allowed: ${allowedMimeTypes.join(", ")}`,
          ) as Error,
        );
      }
      cb(null, true);
    },
  });

// Profile pictures (used now)
export const uploadImage = createUploader(
  ["image/jpeg", "image/png", "image/webp"],
  5,
);

// Resumes / documents (used later for job applications)
export const uploadDocument = createUploader(
  ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  5,
);