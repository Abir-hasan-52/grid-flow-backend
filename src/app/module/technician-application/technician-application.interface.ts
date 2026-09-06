import type { ApplicationStatus } from "../../../../generated/prisma/enums";

export interface ICreateApplicationPayload {
  experience?: string;
}

export interface IRejectApplicationPayload {
  rejectionReason: string;
}

export interface IGetMyApplicationsQuery {
  page?: number;
  limit?: number;
}

export interface IGetAllApplicationsAdminQuery {
  page?: number;
  limit?: number;
  status?: ApplicationStatus;
  jobPostId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}