import type { OutageStatus } from "../../../../generated/prisma/enums";

export interface ICreateOutageReportPayload {
  description?: string;
}

export interface ICreateManualOutagePayload {
  feederId: string;
}

export interface IGetAllOutagesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OutageStatus;
  feederId?: string;
  powerZoneId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IGetMyReportsQuery {
  page?: number;
  limit?: number;
}