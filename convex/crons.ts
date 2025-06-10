import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "delete debug files for inactive chats",
  { hourUTC: 16, minuteUTC: 0 },
  internal.cleanup.deleteDebugFilesForInactiveChats,
  { forReal: true, shouldScheduleNext: true, ageInDays: 14 },
);

export default crons;
