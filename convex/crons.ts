import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "delete debug files for inactive chats",
  { hourUTC: 16, minuteUTC: 0 },
  internal.cleanup.deleteDebugFilesForInactiveChats,
  { forReal: true, shouldScheduleNext: true, daysInactive: 14 },
);

crons.(
  "delete inactive users and chats"
)

export default crons;
