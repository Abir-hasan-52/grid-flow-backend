import { z } from "zod";

const createScheduleSchema = z
  .object({
    title: z.string({ message: "Title is required" }).min(2),
    reason: z.string().optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    areaIds: z.array(z.string()).min(1, "Select at least one area"),
    powerZoneId: z.string().optional(),
  })
  .refine((data) => data.startTime > new Date(), {
    message: "Start time must be in the future",
    path: ["startTime"],
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

const updateScheduleSchema = z
  .object({
    title: z.string().min(2).optional(),
    reason: z.string().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    areaIds: z.array(z.string()).min(1).optional(),
  })
  .refine(
    (data) => !data.startTime || data.startTime > new Date(),
    { message: "Start time must be in the future", path: ["startTime"] },
  )
  .refine(
    (data) => !data.startTime || !data.endTime || data.endTime > data.startTime,
    { message: "End time must be after start time", path: ["endTime"] },
  );

export const ScheduleValidation = {
  createScheduleSchema,
  updateScheduleSchema,
};