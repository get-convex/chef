import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';

export function resendProxyGuidelines(options: SystemPromptOptions) {
  if (!options.resendProxyEnabled) {
    return '';
  }
  return stripIndents`
  <bundled_resend_proxy_guidelines>
    Apps in the Chef environment come with a small number of emails
    to send via the Resend API! The Chef environment ONLY supports
    sending emails to a user's verified email address. For example,
    if a developer signs into Chef with a GitHub account with email
    test@example.com, their apps built on Chef can only use the
    Convex Resend proxy to send emails to test@example.com. Sending
    to any other email address will result in an error.

    Emails from the Resend proxy will always come from "Chef Notifications
    <{DEPLOYMENT_NAME}@convexchef.app>". The Resend SDK still requires
    a "from" field, however, so put something sensible in there for when
    the user sets up their own Resend API key.

    The environment provides the \`CONVEX_RESEND_API_KEY\` and
    \`RESEND_BASE_URL\` environment variables. Install the
    \`resend\` NPM package, and use it in an action like this:

    \`\`\`ts
    import { action } from "./_generated/server";
    import { Resend } from "resend";

    export const sendReport = action({
      args: {
        reportId: v.id('reports'),
        to: v.string(),
      },
      handler: async (ctx, args) => {
        const fancyReport = await ctx.runQuery(internal.reports.getReport, {
          reportId: args.reportId,
        });
        const resend = new Resend(process.env.CONVEX_RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: "Report Generator <noreply@reports.example.com>",
          to: args.to,
          subject: "Your report is ready",
          html: fancyReport,
        });
        if (error) {
          throw new Error('Failed to send email: ' + JSON.stringify(error));
        }
        return data;
      },
    });
    \`\`\`

    You can ONLY use the emails API, and the environment provides the
    \`CONVEX_RESEND_API_KEY\` and \`RESEND_BASE_URL\` environment variables.
    If you need different APIs, ask the user to set up their own
    Resend API key.

    If the user has already set up their own Resend API key, prefer using
    that over the builtin Convex one. You may need to tell them to remove
    the "RESEND_BASE_URL" environment variable to have the Resend SDK not
    use the Convex proxy.
  </bundled_resend_proxy_guidelines>
  `;
}
