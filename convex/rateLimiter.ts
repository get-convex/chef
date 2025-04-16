import RateLimiter, { MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
    resendProxy: {
        kind: "token bucket",
        rate: 20,
        period: MINUTE,
        capacity: 60,
    },
});
