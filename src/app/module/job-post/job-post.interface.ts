import type { JobPostStatus } from "../../../../generated/prisma/enums";

export interface ICreateJobPostPayload {
  title: string;
  description: string;
  requirements?: string;
  deadline: string | Date;
  powerZoneId?: string;
}

export interface IUpdateJobPostPayload {
  title?: string;
  description?: string;
  requirements?: string;
  deadline?: string | Date;
  powerZoneId?: string;
}

export interface IGetAllJobPostsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IGetAllJobPostsAdminQuery extends IGetAllJobPostsQuery {
  status?: JobPostStatus;
}