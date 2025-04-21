import RateLimiter, { MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

function resendProxyEmailsPerMinute() {
  const fromEnv = process.env.RESEND_PROXY_EMAILS_PER_MINUTE;
  return fromEnv ? parseInt(fromEnv) : 20;
}

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  resendProxy: {
    kind: "token bucket",
    // Permit 20 requests per minute => ~900k emails per month => ~$650/month on Resend's scale plan.
    rate: resendProxyEmailsPerMinute(),
    period: MINUTE,
    // Allow accumulating at most one minute's worth of bursts.
    capacity: resendProxyEmailsPerMinute(),
  },
});
