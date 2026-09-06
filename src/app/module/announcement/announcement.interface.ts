import { AnnouncementStatus, AnnouncementType } from "../../../../generated/prisma/enums";

export interface ICreateAnnouncement {
  title: string;
  content: string;
  type?: AnnouncementType;
  powerZoneId?: string;
}


export interface IGetAllAnnouncementsQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: AnnouncementType;
  status?: AnnouncementStatus;
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}