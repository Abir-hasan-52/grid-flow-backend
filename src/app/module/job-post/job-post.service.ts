import httpStatus from "http-status";
import { JobPostStatus } from "../../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  ICreateJobPostPayload,
  IGetAllJobPostsAdminQuery,
  IGetAllJobPostsQuery,
  IUpdateJobPostPayload,
} from "./job-post.interface";

const createJobPost = async (
  payload: ICreateJobPostPayload,
  createdById: string,
) => {
  if (payload.powerZoneId) {
    const zone = await prisma.powerZone.findFirst({
      where: { id: payload.powerZoneId, deletedAt: null },
    });
    if (!zone) {
      throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
    }
  }

  const jobPost = await prisma.jobPost.create({
    data: {
      title: payload.title,
      description: payload.description,
      requirements: payload.requirements,
      deadline: new Date(payload.deadline),
      powerZoneId: payload.powerZoneId,
      createdById,
    },
  });

  return jobPost;
};

const getAllPublishedJobPosts = async (query: IGetAllJobPostsQuery) => {
  const {
    page = 1,
    limit = 10,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    status: JobPostStatus.PUBLISHED,
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [jobPosts, total] = await Promise.all([
    prisma.jobPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        title: true,
        description: true,
        requirements: true,
        deadline: true,
        status: true,
        createdAt: true,
        powerZone: { select: { id: true, name: true } },
      },
    }),
    prisma.jobPost.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: jobPosts,
  };
};

const getPublishedJobPostById = async (id: string) => {
  const jobPost = await prisma.jobPost.findFirst({
    where: { id, deletedAt: null, status: JobPostStatus.PUBLISHED },
    include: {
      powerZone: { select: { id: true, name: true } },
    },
  });

  if (!jobPost) {
    throw new AppError(httpStatus.NOT_FOUND, "Job post not found");
  }

  return jobPost;
};

const getAllJobPostsAdmin = async (query: IGetAllJobPostsAdminQuery) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(status && { status }),
    ...(search && {
      title: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [jobPosts, total] = await Promise.all([
    prisma.jobPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        powerZone: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { applications: true } },
      },
    }),
    prisma.jobPost.count({ where }),
  ]);

  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    data: jobPosts,
  };
};

// internal helper -- not exposed as its own route, used by update/delete/publish/close
const getExistingJobPostOrThrow = async (id: string) => {
  const jobPost = await prisma.jobPost.findFirst({
    where: { id, deletedAt: null },
  });

  if (!jobPost) {
    throw new AppError(httpStatus.NOT_FOUND, "Job post not found");
  }

  return jobPost;
};

const updateJobPost = async (id: string, payload: IUpdateJobPostPayload) => {
  await getExistingJobPostOrThrow(id);

  if (payload.powerZoneId) {
    const zone = await prisma.powerZone.findFirst({
      where: { id: payload.powerZoneId, deletedAt: null },
    });
    if (!zone) {
      throw new AppError(httpStatus.NOT_FOUND, "Power zone not found");
    }
  }

  const updated = await prisma.jobPost.update({
    where: { id },
    data: {
      ...payload,
      deadline: payload.deadline ? new Date(payload.deadline) : undefined,
    },
  });

  return updated;
};

const deleteJobPost = async (id: string) => {
  await getExistingJobPostOrThrow(id);

  const pendingApplications = await prisma.technicianApplication.count({
    where: { jobPostId: id, status: "PENDING" },
  });

  if (pendingApplications > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a job post with pending applications. Review or close it first.",
    );
  }

  const deleted = await prisma.jobPost.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return deleted;
};

const publishJobPost = async (id: string) => {
  const jobPost = await getExistingJobPostOrThrow(id);

  if (jobPost.status !== JobPostStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot publish a job post with status "${jobPost.status}". Only DRAFT job posts can be published.`,
    );
  }

  if (jobPost.deadline <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot publish a job post whose deadline has already passed. Update the deadline first.",
    );
  }

  const published = await prisma.jobPost.update({
    where: { id },
    data: { status: JobPostStatus.PUBLISHED },
  });

  return published;
};

const closeJobPost = async (id: string) => {
  const jobPost = await getExistingJobPostOrThrow(id);

  if (jobPost.status !== JobPostStatus.PUBLISHED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot close a job post with status "${jobPost.status}". Only PUBLISHED job posts can be closed.`,
    );
  }

  const closed = await prisma.jobPost.update({
    where: { id },
    data: { status: JobPostStatus.CLOSED },
  });

  return closed;
};

export const JobPostService = {
  createJobPost,
  getAllPublishedJobPosts,
  getPublishedJobPostById,
  getAllJobPostsAdmin,
  updateJobPost,
  deleteJobPost,
  publishJobPost,
  closeJobPost,
};
