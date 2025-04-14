import { httpAction, mutation } from "./_generated/server";
import { getCurrentMember } from "./sessions";

export const resendProxy = httpAction(async (ctx, req) => {

})

export const issueResendToken = mutation({
    handler: async (ctx) => {
        const member = await getCurrentMember(ctx);
        if (!member) {
            return null;
        }
    }
});