import type { AssignmentStatus } from "../../../../generated/prisma/enums";

export interface ICreateAssignmentPayload {
  technicianId: string;
  isPriority?: boolean;
}

export interface IRejectAssignmentPayload {
  rejectionReason: string;
}

export interface ICreateRepairUpdatePayload {
  note: string;
}

export interface IGetAllAssignmentsQuery {
  page?: number;
  limit?: number;
  status?: AssignmentStatus;
  outageId?: string;
  powerZoneId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IGetMyAssignmentsQuery {
  page?: number;
  limit?: number;
  status?: AssignmentStatus;
}