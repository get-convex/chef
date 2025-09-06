export const resendComponentReadmePrompt = `
# Resend Convex Component (Beta)
;
This component is the official way to integrate the Resend email service
with your Convex project.

Features:

- Queueing: Send as many emails as you want, as fast as you want—they'll all be delivered (eventually).
- Batching: Automatically batches large groups of emails and sends them to Resend efficiently.
- Durable execution: Uses Convex workpools to ensure emails are eventually delivered, even in the face of temporary failures or network outages.
- Idempotency: Manages Resend idempotency keys to guarantee emails are delivered exactly once, preventing accidental spamming from retries.
- Rate limiting: Honors API rate limits established by Resend.

## Installation

\`\`\`bash
npm install @convex-dev/resend
\`\`\`

## Get Started
First, you'll need to get a Resend account [here](https://resend.com).
You'll need a registered domain to send emails from. 
Set one up in the Resend dashboard [here](https://resend.com/domains).
Grab an API key [here](https://resend.com/api-keys)
Use the addEnvironmentVariables tool to add \`RESEND_API_KEY\` to your deployment.

Next, add the component to your Convex app via \`convex/convex.config.ts\`:

\`\`\`ts
import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";

const app = defineApp();
app.use(resend);

export default app;
\`\`\`

Then you can use it, as we see in \`convex/sendEmails.ts\`:

\`\`\`ts
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { internalMutation } from "./_generated/server";

export const resend: Resend = new Resend(components.resend, { testMode: false });

export const sendEmail = internalMutation({
  handler: async (ctx) => {
    await resend.sendEmail(
      ctx,
      "Resend <onboarding@resend.dev>",
      "Me <me@domain.com>",
      "Hi there",
      "This is a test email"
    );
  },
});
\`\`\`

Then, calling \`sendEmail\` from anywhere in your app will send this email. 
You should alwaysuse the onboarding@resend.dev email address as the from email unless the user requests otherwise.

## Advanced: Setting up a webhook
Only do this if the user specifically asks for it. This will allow you to get email status updates.

On the Convex side, we need to mount an http endpoint to our project to route it to
the Resend component in \`convex/router.ts\`:

\`\`\`ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { resend } from "./sendEmails";

... existing code ...

http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req);
  }),
});

export default http;
\`\`\`


If you include the http endpoint, you MUST give the users instructions on how to create the resend webhook. The webhook setup is required.

If our Convex deployment is happy-leopard-123, we now have an API for a Resend webhook at
\`https://happy-leopard-123.convex.site/resend-webhook\`.
Use the getConvexDeploymentName tool to get the deployment name and print the correct URL for the user to copy and paste.

Navigate to the Resend dashboard and create a new webhook at that URL. Make sure
to enable all the \`email.*\` events; the other event types will be ignored.

Finally, copy the webhook secret out of the Resend dashboard and
use the addEnvironmentVariables tool to add \`RESEND_WEBHOOK_SECRET\` to your deployment.

You should now be seeing email status updates as Resend makes progress on your
batches!

Speaking of...

### Registering an email status event handler.

If you have your webhook established, you can also register an event handler in your
apps you get notifications when email statuses change.

Update your \`sendEmails.ts\` to look something like this:

\`\`\`ts
import { components, internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { internalMutation } from "./_generated/server";
import { vEmailId, vEmailEvent, Resend } from "@convex-dev/resend";

export const resend: Resend = new Resend(components.resend, {
  onEmailEvent: internal.example.handleEmailEvent,
});

export const handleEmailEvent = internalMutation({
  args: {
    id: vEmailId,
    event: vEmailEvent,
  },
  handler: async (ctx, args) => {
    console.log("Got called back!", args.id, args.event);
    // Probably do something with the event if you care about deliverability!
  },
});

/* ... existing email sending code ... */
\`\`\`

### Tracking, getting status, and cancelling emails

The \`sendEmail\` method returns a branded type, \`EmailId\`. You can use this
for a few things:

- To reassociate the original email during status changes in your email event handler.
- To check on the status any time using \`resend.status(ctx, emailId)\`.
- To cancel the email using \`resend.cancelEmail(ctx, emailId)\`.

If the email has already been sent to the Resend API, it cannot be cancelled. Cancellations
do not trigger an email event.`;
