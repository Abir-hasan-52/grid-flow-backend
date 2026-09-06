import { AnnouncementType } from "../../../../generated/prisma/enums";

export interface ICreateAnnouncement {
  title: string;
  content: string;
  type?: AnnouncementType;
  powerZoneId?: string;
}