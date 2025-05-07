// convex/convex.config.ts
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

const app = defineApp();
app.use(rateLimiter);
app.use(migrations);

export default app;
