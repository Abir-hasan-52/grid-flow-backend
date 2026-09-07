import cron from "node-cron";
// import { prisma } from "./prisma";
import { ScheduleStatus } from "../../../generated/prisma/enums";
import { prisma } from "./prisma";

// Runs every minute. Moves schedules through the automatic parts of the
// state machine that don't need a human action:
//   APPROVED -> ACTIVE   (once startTime has arrived)
//   ACTIVE   -> COMPLETED (once endTime has passed)
export const startScheduleStatusCron = () => {
  cron.schedule("* * * * *", async () => {
    const now = new Date();

    try {
      const activated = await prisma.loadSheddingSchedule.updateMany({
        where: {
          status: ScheduleStatus.APPROVED,
          startTime: { lte: now },
        },
        data: { status: ScheduleStatus.ACTIVE },
      });

      const completed = await prisma.loadSheddingSchedule.updateMany({
        where: {
          status: ScheduleStatus.ACTIVE,
          endTime: { lte: now },
        },
        data: { status: ScheduleStatus.COMPLETED },
      });

      if (activated.count > 0 || completed.count > 0) {
        console.log(
          `[schedule-cron] activated=${activated.count} completed=${completed.count}`,
        );
      }
    } catch (error) {
      console.error("[schedule-cron] failed:", error);
    }
  });
};