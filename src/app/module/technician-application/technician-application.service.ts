import path from "node:path";
import ejs from "ejs";
import httpStatus from "http-status";
import {
  ApplicationStatus,
  EmailStatus,
  EmailType,
  JobPostStatus,
  Role,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
// import { transporter } from "../../lib/mailer";
import { AppError } from "../../utils/AppError";
import {
  ICreateApplicationPayload,
    IGetAllApplicationsAdminQuery,
//   IGetAllApplicationsAdminQuery,
//   IGetAllApplicationsAdminQuery,
  IGetMyApplicationsQuery,
  IRejectApplicationPayload,
} from "./technician-application.interface";
import { transporter } from "../../lib/nodemailer";
// import type {
//   ICreateApplicationPayload,
//   IGetAllApplicationsAdminQuery,
//   IGetMyApplicationsQuery,
//   IRejectApplicationPayload,
// } from "./technicianApplication.interface";

const applyForJob = async (
  jobPostId: string,
  applicantId: string,
  resumeBuffer: Buffer,
  payload: ICreateApplicationPayload,
) => {
  const jobPost = await prisma.jobPost.findFirst({
    where: { id: jobPostId, deletedAt: null },
  });

  if (!jobPost) {
    throw new AppError(httpStatus.NOT_FOUND, "Job post not found");
  }

  if (jobPost.status !== JobPostStatus.PUBLISHED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This job post is not currently accepting applications",
    );
  }

  if (jobPost.deadline <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The application deadline has passed",
    );
  }

  const applicant = await prisma.user.findFirst({
    where: { id: applicantId, deletedAt: null },
  });

  if (!applicant) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Only current customers can apply -- someone already a technician/admin/
  // zone manager shouldn't be re-applying through this flow.
  if (applicant.role !== Role.CUSTOMER) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only customer accounts can apply to become a technician",
    );
  }

  const existingApplication = await prisma.technicianApplication.findFirst({
    where: { jobPostId, applicantId },
  });

  if (existingApplication) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already applied to this job post",
    );
  }

  // Resume is a document (PDF/DOC), not an image -- upload as "raw" resource type.
  const uploadResult = await new Promise<{ secure_url: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "gridflow/resumes",
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary resume upload error:", error);
            return reject(
              new AppError(httpStatus.BAD_REQUEST, "Failed to upload resume"),
            );
          }
          if (!result?.secure_url) {
            return reject(
              new AppError(httpStatus.BAD_REQUEST, "Resume upload failed"),
            );
          }
          resolve({ secure_url: result.secure_url });
        },
      );
      stream.end(resumeBuffer);
    },
  );

  const application = await prisma.technicianApplication.create({
    data: {
      jobPostId,
      applicantId,
      experience: payload.experience,
      resumeUrl: uploadResult.secure_url,
      status: ApplicationStatus.PENDING,
    },
  });

  return application;
};

const getMyApplications = async (
  applicantId: string,
  query: IGetMyApplicationsQuery,
) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = { applicantId };

  const [applications, total] = await Promise.all([
    prisma.technicianApplication.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        jobPost: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.technicianApplication.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: applications,
  };
};

const getMyApplicationById = async (applicantId: string, id: string) => {
  const application = await prisma.technicianApplication.findFirst({
    where: { id, applicantId }, // ownership check baked into the query
    include: {
      jobPost: { select: { id: true, title: true, status: true } },
    },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  return application;
};

const getAllApplicationsAdmin = async (
  query: IGetAllApplicationsAdminQuery,
) => {
  const {
    page = 1,
    limit = 10,
    status,
    jobPostId,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status }),
    ...(jobPostId && { jobPostId }),
    ...(search && {
      applicant: {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      },
    }),
  };

  const [applications, total] = await Promise.all([
    prisma.technicianApplication.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        applicant: {
          select: { id: true, name: true, email: true, phone: true },
        },
        jobPost: { select: { id: true, title: true, powerZoneId: true } },
      },
    }),
    prisma.technicianApplication.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: applications,
  };
};

const getApplicationByIdAdmin = async (id: string) => {
  const application = await prisma.technicianApplication.findFirst({
    where: { id },
    include: {
      applicant: { select: { id: true, name: true, email: true, phone: true } },
      jobPost: { select: { id: true, title: true, powerZoneId: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  return application;
};

const approveApplication = async (id: string, reviewedById: string) => {
  const application = await prisma.technicianApplication.findFirst({
    where: { id },
    include: { jobPost: true, applicant: true },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  if (application.status !== ApplicationStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot approve an application with status "${application.status}". Only PENDING applications can be reviewed.`,
    );
  }

  // Defensive check: role may have changed since applying (edge case).
  if (application.applicant.role !== Role.CUSTOMER) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This applicant is no longer a customer account and cannot be promoted",
    );
  }

  const [, updatedApplication] = await prisma.$transaction([
    prisma.user.update({
      where: { id: application.applicantId },
      data: {
        role: Role.TECHNICIAN,
        technicianZoneId: application.jobPost.powerZoneId,
        areaId: null, // area was customer-specific; clear it on promotion
      },
    }),
    prisma.technicianApplication.update({
      where: { id },
      data: {
        status: ApplicationStatus.APPROVED,
        reviewedById,
        reviewedAt: new Date(),
      },
    }),
  ]);

  // Email confirmation -- wrapped so a failure here doesn't undo the
  // promotion/approval, which already succeeded above.
  const subject = "Your GridFlow technician application was approved";
  try {
    const zone = application.jobPost.powerZoneId
      ? await prisma.powerZone.findUnique({
          where: { id: application.jobPost.powerZoneId },
        })
      : null;

    const templatePath = path.join(
      process.cwd(),
      "src/app/templates/technician-approved.ejs",
    );
    const html = await ejs.renderFile(templatePath, {
      name: application.applicant.name,
      jobTitle: application.jobPost.title,
      zoneName: zone?.name ?? "your assigned",
    });

    await transporter.sendMail({
      from: config.email_sender,
      to: application.applicant.email,
      subject,
      html,
    });

    await prisma.emailLog.create({
      data: {
        userId: application.applicantId,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.SENT,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        userId: application.applicantId,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown email error",
      },
    });
  }

  return updatedApplication;
};

const rejectApplication = async (
  id: string,
  reviewedById: string,
  payload: IRejectApplicationPayload,
) => {
  const application = await prisma.technicianApplication.findFirst({
    where: { id },
    include: { jobPost: true, applicant: true },
  });

  if (!application) {
    throw new AppError(httpStatus.NOT_FOUND, "Application not found");
  }

  if (application.status !== ApplicationStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot reject an application with status "${application.status}". Only PENDING applications can be reviewed.`,
    );
  }

  const updatedApplication = await prisma.technicianApplication.update({
    where: { id },
    data: {
      status: ApplicationStatus.REJECTED,
      rejectionReason: payload.rejectionReason,
      reviewedById,
      reviewedAt: new Date(),
    },
  });

  const subject = "Update on your GridFlow technician application";
  try {
    const templatePath = path.join(
      process.cwd(),
      "src/app/templates/technician-rejected.ejs",
    );
    const html = await ejs.renderFile(templatePath, {
      name: application.applicant.name,
      jobTitle: application.jobPost.title,
      rejectionReason: payload.rejectionReason,
    });

    await transporter.sendMail({
      from: config.email_sender,
      to: application.applicant.email,
      subject,
      html,
    });

    await prisma.emailLog.create({
      data: {
        userId: application.applicantId,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.SENT,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        userId: application.applicantId,
        type: EmailType.ACCOUNT,
        subject,
        status: EmailStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown email error",
      },
    });
  }

  return updatedApplication;
};

export const TechnicianApplicationService = {
  applyForJob,
  getMyApplications,
  getMyApplicationById,
  getAllApplicationsAdmin,
  getApplicationByIdAdmin,
  approveApplication,
  rejectApplication,
};
