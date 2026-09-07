import type { ScheduleStatus } from "../../../../generated/prisma/enums";

export interface ICreateSchedulePayload {
  title: string;
  reason?: string;
  startTime: string | Date;
  endTime: string | Date;
  areaIds: string[];
  powerZoneId?: string; // required for ADMIN, ignored/overridden for ZONE_MANAGER
}

export interface IUpdateSchedulePayload {
  title?: string;
  reason?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  areaIds?: string[];
}

export interface IGetAllSchedulesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ScheduleStatus;
  powerZoneId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}