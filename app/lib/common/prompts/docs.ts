import { stripIndents } from '~/utils/stripIndent';

export function docs() {
  return stripIndents`
  Here are the Convex docs. These include the API reference, guides, and other documentation:

  # Debugging Authentication

You have followed one of our authentication guides but something is not working.
You have double checked that you followed all the steps, and that you used the
correct secrets, but you are still stuck.

## Frequently encountered issues [​](https://docs.convex.dev/auth/debug\\#frequently-encountered-issues \"Direct link to Frequently encountered issues\")

### \`ctx.auth.getUserIdentity()\` returns \`null\` in a query [​](https://docs.convex.dev/auth/debug\\#ctxauthgetuseridentity-returns-null-in-a-query \"Direct link to ctxauthgetuseridentity-returns-null-in-a-query\")

This often happens when subscribing to queries via \`useQuery\` in React, without
waiting for the client to be authenticated. Even if the user has been logged-in
previously, it takes some time for the client to authenticate with the Convex
backend. Therefore on page load, \`ctx.auth.getUserIdentity()\` called within a
query returns \`null\`.

To handle this, you can either:

1. Use the \`Authenticated\` component from \`convex/react\` to wrap the component
that includes the \`useQuery\` call (see the last two steps in the
[Clerk guide](https://docs.convex.dev/auth/clerk#get-started))
2. Or return \`null\` or some other \"sentinel\" value from the query and handle it
on the client

If you are using \`fetchQuery\` for
[Next.js Server Rendering](https://docs.convex.dev/client/react/nextjs/server-rendering),
make sure you are explicitly passing in a JWT token as documented
[here](https://docs.convex.dev/client/react/nextjs/server-rendering#server-side-authentication).

If this hasn't helped, follow the steps below to resolve your issue.

## Step 1: Check whether authentication works on the backend [​](https://docs.convex.dev/auth/debug\\#step-1-check-whether-authentication-works-on-the-backend \"Direct link to Step 1: Check whether authentication works on the backend\")

1. Add the following code to the _beginning_ of your function (query, mutation,
action or http action):

\`\`\`codeBlockLines_zEuJ
console.log(\"server identity\", await ctx.auth.getUserIdentity());

\`\`\`

2. Then call this function from whichever client you're using to talk to Convex.

3. Open the
[logs page on your dashboard](https://dashboard.convex.dev/deployment/logs).

4. What do you see on the logs page?

**Answer: I don't see anything**:


   - Potential cause: You don't have the right dashboard open. Confirm that the
     Deployment URL on _Settings_ \\> _URL and Deploy Key_ page matches how your
     client is configured.
   - Potential cause: Your client is not connected to Convex. Check your client
     logs (browser logs) for errors. Reload the page / restart the client.
   - Potential cause: The code has not been pushed. For dev deployments make
     sure you have \`npx convex dev\` running. For prod deployments make sure you
     successfully pushed via \`npx convex deploy\`. Go to the _Functions_ page on
     the dashboard and check that the code shown there includes the
     \`console.log\` line you added.

When you resolved the cause you should see the log appear.

**Answer: I see a log with \`'server identity' null\`**:

   - Potential cause: The client is not supplying an auth token.
   - Potential cause: Your deployment is misconfigured.
   - Potential cause: Your client is misconfigured.

Proceed to
[step 2](https://docs.convex.dev/auth/debug#step-2-check-whether-authentication-works-on-the-frontend).

**Answer: I see a log with \`'server identity' { tokenIdentifier: '... } \`**

Great, you are all set!

## Step 2: Check whether authentication works on the frontend [​](https://docs.convex.dev/auth/debug\\#step-2-check-whether-authentication-works-on-the-frontend \"Direct link to Step 2: Check whether authentication works on the frontend\")

No matter which client you use, it must pass a JWT token to your backend for
authentication to work.

The most bullet-proof way of ensuring your client is passing the token to the
backend, is to inspect the traffic between them.

1. If you're using a client from the web browser, open the _Network_ tab in your
browser's developer tools.

2. Check the token
   - For Websocket-based clients ( \`ConvexReactClient\` and \`ConvexClient\`),
     filter for the \`sync\` name and select \`WS\` as the type of traffic. Check
     the \`sync\` items. After the client is initialized (commonly after loading
     the page), it will send a message (check the _Messages_ tab) with
     \`type: \"Authenticate\"\`, and \`value\` will be the authentication token.

     ![Network tab inspecting Websocket messages](https://docs.convex.dev/screenshots/auth-ws.png)

   - For HTTP based clients ( \`ConvexHTTPClient\` and the
     [HTTP API](https://docs.convex.dev/http-api/)), select \`Fetch/XHR\` as the type of
     traffic. You should see an individual network request for each function
     call, with an \`Authorization\` header with value \`Bearer \` followed by the
     authentication token.

     ![Network tab inspecting HTTP headers](https://docs.convex.dev/screenshots/auth-http.png)
3. Do you see the authentication token in the traffic?

**Answer: No**:


   - Potential cause: The Convex client is not configured to get/fetch a JWT
     token. You're not using
     \`ConvexProviderWithClerk\`/ \`ConvexProviderWithAuth0\`/ \`ConvexProviderWithAuth\`
     with the \`ConvexReactClient\` or you forgot to call \`setAuth\` on
     \`ConvexHTTPClient\` or \`ConvexClient\`.

   - Potential cause: You are not signed in, so the token is \`null\` or
     \`undefined\` and the \`ConvexReactClient\` skipped authentication altogether.
     Verify that you are signed in via \`console.log\` ing the token from whichever
     auth provider you are using:


     - Clerk:





       \`\`\`codeBlockLines_zEuJ
       // import { useAuth } from \"@clerk/nextjs\"; // for Next.js
       import { useAuth } from \"@clerk/clerk-react\";

       const { getToken } = useAuth();
       console.log(getToken({ template: \"convex\" }));

       \`\`\`

     - Auth0:





       \`\`\`codeBlockLines_zEuJ
       import { useAuth0 } from \"@auth0/auth0-react\";

       const { getAccessTokenSilently } = useAuth0();
       const response = await getAccessTokenSilently({
         detailedResponse: true,
       });
       const token = response.id_token;
       console.log(token);

       \`\`\`

     - Custom: However you implemented \`useAuthFromProviderX\`


If you don't see a long string that looks like a token, check the browser
logs for errors from your auth provider. If there are none, check the
Network tab to see whether requests to your provider are failing. Perhaps
the auth provider is misconfigured. Double check the auth provider
configuration (in the corresponding React provider or however your auth
provider is configured for the client). Try clearing your cookies in the
browser (in dev tools _Application_ \\> _Cookies_ \\> _Clear all cookies_
button).

**Answer: Yes, I see a long string that looks like a JWT**:

Great, copy the whole token (there can be \`.\` s in it, so make sure you're not
copying just a portion of it).

4. Open [https://jwt.io/](https://jwt.io/), scroll down and paste the token in the Encoded textarea
on the left of the page. On the right you should see:


   - In _HEADER_, \`\"typ\": \"JWT\"\`
   - in _PAYLOAD_, a valid JSON with at least \`\"aud\"\`, \`\"iss\"\` and \`\"sub\"\`
     fields. If you see gibberish in the payload you probably didn't copy the
     token correctly or it's not a valid JWT token.

If you see a valid JWT token, repeat
[step 1](https://docs.convex.dev/auth/debug#step-1-check-whether-authentication-works-on-the-backend). If you
still don't see correct identity, proceed to step 3.

## Step 3: Check that backend configuration matches frontend configuration [​](https://docs.convex.dev/auth/debug\\#step-3-check-that-backend-configuration-matches-frontend-configuration \"Direct link to Step 3: Check that backend configuration matches frontend configuration\")

You have a valid JWT token on the frontend, and you know that it is being passed
to the backend, but the backend is not validating it.

1. Open the _Settings_ \\> _Authentication_ on your dashboard. What do you see?

**Answer: I see**
**\`This deployment has no configured authentication providers\`**:


   - Cause: You do not have an \`auth.config.ts\` (or \`auth.config.js\`) file in
     your \`convex\` directory, or you haven't pushed your code. Follow the
     authentication guide to create a valid auth config file. For dev
     deployments make sure you have \`npx convex dev\` running. For prod
     deployments make sure you successfully pushed via \`npx convex deploy\`.

\\*\\*Answer: I see one or more _Domain_ and _Application ID_ pairs.

Great, let's check they match the JWT token.

2. Look at the \`iss\` field in the JWT token payload at [https://jwt.io/](https://jwt.io/). Does it
match a _Domain_ on the _Authentication_ page?

**Answer: No, I don't see the \`iss\` URL on the Convex dashboard**:


   - Potential cause: You copied the wrong value into your
      \`auth.config.ts\`
     's \`domain\`, or into the environment variable that is used there. Go back
     to the authentication guide and make sure you have the right URL from your
     auth provider.

   - Potential cause: Your client is misconfigured:
     - Clerk: You have the wrong \`publishableKey\` configured. The key must
       belong to the Clerk instance that you used to configure your

       \`auth.config.ts\`.
       - Also make sure that the JWT token in Clerk is called \`convex\`, as
         that's the name \`ConvexProviderWithClerk\` uses to fetch the token!
     - Auth0: You have the wrong \`domain\` configured (on the client!). The
       domain must belong to the Auth0 instance that you used to configure your
       \`auth.config.ts\`.

     - Custom: Make sure that your client is correctly configured to match your
       \`auth.config.ts\`.

**Answer: Yes, I do see the \`iss\` URL**:

Great, let's move one.

3. Look at the \`aud\` field in the JWT token payload at [https://jwt.io/](https://jwt.io/). Does it
match the _Application ID_ under the correct _Domain_ on the _Authentication_
page?

**Answer: No, I don't see the \`aud\` value in the _Application ID_ field**:


   - Potential cause: You copied the wrong value into your \`auth.config.ts\`'s \`applicationID\`, or into the environment variable that is used there. Go
     back to the authentication guide and make sure you have the right value
     from your auth provider.
   - Potential cause: Your client is misconfigured:
     - Clerk: You have the wrong \`publishableKey\` configured.The key must belong
       to the Clerk instance that you used to configure your
       \`auth.config.ts\`.
     - Auth0: You have the wrong \`clientId\` configured. Make sure you're using
       the right \`clientId\` for the Auth0 instance that you used to configure
       your \`auth.config.ts\`.
     - Custom: Make sure that your client is correctly configured to match your
       \`auth.config.ts\`.

**Answer: Yes, I do see the \`aud\` value in the _Application ID_ field**:

Great, repeat
[step 1](https://docs.convex.dev/auth/debug#step-1-check-whether-authentication-works-on-the-backend) and you
should be all set!

- [Frequently encountered issues](https://docs.convex.dev/auth/debug#frequently-encountered-issues)
  - [\`ctx.auth.getUserIdentity()\` returns \`null\` in a query](https://docs.convex.dev/auth/debug#ctxauthgetuseridentity-returns-null-in-a-query)
- [Step 1: Check whether authentication works on the backend](https://docs.convex.dev/auth/debug#step-1-check-whether-authentication-works-on-the-backend)
- [Step 2: Check whether authentication works on the frontend](https://docs.convex.dev/auth/debug#step-2-check-whether-authentication-works-on-the-frontend)
- [Step 3: Check that backend configuration matches frontend configuration](https://docs.convex.dev/auth/debug#step-3-check-that-backend-configuration-matches-frontend-configuration)



[Skip to main content](https://docs.convex.dev/production/hosting/vercel#docusaurus_skipToContent_fallback)

On this page

Hosting your Convex app on Vercel allows you to automatically re-deploy both
your backend and your frontend whenever you push your code.

## Deploying to Vercel [​](https://docs.convex.dev/production/hosting/vercel\\#deploying-to-vercel \"Direct link to Deploying to Vercel\")

This guide assumes you already have a working React app with Convex. If not
follow the [Convex React Quickstart](https://docs.convex.dev/quickstart/react) first. Then:

1. Create a Vercel account



If you haven't done so, create a [Vercel](https://vercel.com/) account. This is
free for small projects and should take less than a minute to set up.

2. Link your project on Vercel



Create a Vercel project at [https://vercel.com/new](https://vercel.com/new) and link it to the
source code repository for your project on GitHub or other Git platform.







![Vercel import project](https://docs.convex.dev/assets/images/vercel_import-ea7ec18cd8c5e5575158bcf032698bc7.png)

3. Override the Build command



Override the \"Build command\" to be
\`npx convex deploy --cmd 'npm run build'\`.



If your project lives in a subdirectory of your repository you'll
also need to change _Root Directory_ above accordingly.







![Vercel build settings](https://docs.convex.dev/assets/images/vercel_build_command-236a66a2e7e2091d610883c56954dcb9.png)

4. Set up the CONVEX\\_DEPLOY\\_KEY environment variable



On your [Convex Dashboard](https://dashboard.convex.dev/)
go to your project's _Settings_ page. Click the _Generate Production Deploy Key_ button to generate a **Production** deploy key.
Then click the copy button to copy the key.



In Vercel, click _Environment Variables_.
Create an environment variable named \`CONVEX_DEPLOY_KEY\` and paste
in your deploy key. Under _Environment_, uncheck all except _Production_ and click _Save_.







![Vercel environment variable CONVEX_DEPLOY_KEY](https://docs.convex.dev/assets/images/vercel_prod_deploy_key-df730e5f65427ae68f68b48af225995b.png)

5. Deploy your site



Now click the _Deploy_ button and your work here is done!


Vercel will automatically publish your site to an URL like
\`https://<site-name>.vercel.app\`, shown on the page after deploying. Every time
you push to your Git repository, Vercel will automatically deploy your Convex
functions and publish your site changes.

Using a Custom Domain?

If you're using a custom domain to serve your Convex functions, you'll need
additional configuration. See [Custom\\\\
Domains](https://docs.convex.dev/production/hosting/custom#hosting-with-a-custom-domain) for
more information.

### How it works [​](https://docs.convex.dev/production/hosting/vercel\\#how-it-works \"Direct link to How it works\")

In Vercel, we overrode the _Build Command_ to be
\`npx convex deploy --cmd 'npm run build'\`.

\`npx convex deploy\` will read \`CONVEX_DEPLOY_KEY\` from the environment and use
it to set the \`CONVEX_URL\` (or similarly named) environment variable to point to
your **production** deployment.

Your frontend framework of choice invoked by \`npm run build\` will read the
\`CONVEX_URL\` (or similarly named) environment variable to point your deployed
site (via \`ConvexReactClient\`) at your **production** deployment.

Finally, \`npx convex deploy\` will push your Convex functions to your production
deployment.

Now, your production deployment has your newest functions and your app is
configured to connect to it.

You can use \`--cmd-url-env-var-name\` to customize the variable name used by your
frontend code if the \`deploy\` command cannot infer it, like

\`\`\`codeBlockLines_zEuJ
npx convex deploy --cmd-url-env-var-name CUSTOM_CONVEX_URL --cmd 'npm run build'

\`\`\`

### Authentication [​](https://docs.convex.dev/production/hosting/vercel\\#authentication \"Direct link to Authentication\")

You will want to configure your [authentication](https://docs.convex.dev/auth) provider
(Clerk, Auth0 or other) to accept your production URL. Note that Clerk does not
support \`https://<site-name>.vercel.app\`, so you'll have to configure a custom
domain.

## Preview Deployments [​](https://docs.convex.dev/production/hosting/vercel\\#preview-deployments \"Direct link to Preview Deployments\")

Vercel Preview Deployments allow you to preview changes to your app before
they're merged in. In order to preview both changes to frontend code and Convex
functions, you can set up
[Convex preview deployments](https://docs.convex.dev/production/hosting/preview-deployments).

This will create a fresh Convex backend for each preview and leave your
production and development deployments unaffected.

This assumes you have already followed the steps in
[Deploying to Vercel](https://docs.convex.dev/production/hosting/vercel#deploying-to-vercel) above.

1. Set up the CONVEX\\_DEPLOY\\_KEY environment variable



On your [Convex Dashboard](https://dashboard.convex.dev/)
go to your project's _Settings_ page. Click the _Generate Preview Deploy Key_ button to generate a **Preview** deploy key.
Then click the copy button to copy the key.



In Vercel, click _Environment Variables_.
Create an environment variable named \`CONVEX_DEPLOY_KEY\` and paste
in your deploy key. Under _Environment_, uncheck all except _Preview_ and click _Save_.









![Vercel environment variable CONVEX_DEPLOY_KEY](https://docs.convex.dev/assets/images/vercel_preview_deploy_key-bb1badeb35323ef9c06516982aa5c8c7.png)

2. (optional) Set up default environment variables



If your app depends on certain Convex environment variables, you can set up [default\\\\
environment variables](https://docs.convex.dev/production/environment-variables#project-environment-variable-defaults) for preview and development deployments in your project.









![Project Default Environment Variables](https://docs.convex.dev/assets/images/project_default_environment_variables-94be77c692d0a3c9564cb7f642b6cb64.png)

3. (optional) Run a function to set up initial data



Vercel Preview Deployments run against fresh Convex backends, which do not share data
with development or production Convex deployments. You can call a Convex
function to set up data by adding \`--preview-run 'functionName'\` to the \`npx   convex deploy\` command. This function will only be run for preview deployments, and will be ignored
when deploying to production.









Vercel > Settings > Build & Development settings > Build Command





\`\`\`codeBlockLines_zEuJ
npx convex deploy --cmd 'npm run build' --preview-run 'functionName'

\`\`\`

4. Now test out creating a PR and generating a Preview Deployment!



You can find the Convex deployment for your branch in the Convex dashboard.









![Preview Deployment in Deployment Picker](https://docs.convex.dev/assets/images/preview_deployment_deployment_picker-bc5b5e7cd3ac7e0e44ec7ed4c8b40c1c.png)


### How it works [​](https://docs.convex.dev/production/hosting/vercel\\#how-it-works-1 \"Direct link to How it works\")

For Preview Deployments, \`npx convex deploy\` will read \`CONVEX_DEPLOY_KEY\` from
the environment, and use it to create a Convex deployment associated with the
Git branch name for the Vercel Preview Deployment. It will set the \`CONVEX_URL\`
(or similarly named) environment variable to point to the new Convex deployment.

Your frontend framework of choice invoked by \`npm run build\` will read the
\`CONVEX_URL\` environment variable and point your deployed site (via
\`ConvexReactClient\`) at the Convex preview deployment.

Finally, \`npx convex deploy\` will push your Convex functions to the preview
deployment and run the \`--preview-run\` function (if provided). This deployment
has separate functions, data, crons and all other configuration from any other
deployments.

\`npx convex deploy\` will infer the Git branch name for Vercel, Netlify, GitHub,
and GitLab environments, but the \`--preview-create\` option can be used to
customize the name associated with the newly created deployment.

Production deployments will work exactly the same as before.

- [Deploying to Vercel](https://docs.convex.dev/production/hosting/vercel#deploying-to-vercel)
  - [How it works](https://docs.convex.dev/production/hosting/vercel#how-it-works)
  - [Authentication](https://docs.convex.dev/production/hosting/vercel#authentication)
- [Preview Deployments](https://docs.convex.dev/production/hosting/vercel#preview-deployments)
  - [How it works](https://docs.convex.dev/production/hosting/vercel#how-it-works-1)



[Skip to main content](https://docs.convex.dev/functions#docusaurus_skipToContent_fallback)

Functions run on the backend and are written in JavaScript (or TypeScript). They
are automatically available as APIs accessed through
[client libraries](https://docs.convex.dev/client/react). Everything you do in the Convex
backend starts from functions.

There are three types of functions:

- [Queries](https://docs.convex.dev/functions/query-functions) read data from your Convex
database and are automatically cached and subscribable (realtime, reactive).
- [Mutations](https://docs.convex.dev/functions/mutation-functions) write data to the database and
run as a transaction.
- [Actions](https://docs.convex.dev/functions/actions) can call OpenAI, Stripe, Twilio, or any
other service or API you need to make your app work.

You can also build [HTTP actions](https://docs.convex.dev/functions/http-actions) when you
want to call your functions from a webhook or a custom client.

Here's an overview of the three different types of Convex functions and what
they can do:

|  | Queries | Mutations | Actions |
| --- | --- | --- | --- |
| Database access | Yes | Yes | No |
| Transactional | Yes | Yes | No |
| Cached | Yes | No | No |
| Real-time Updates | Yes | No | No |
| External API Calls (fetch) | No | No | Yes |



[Skip to main content](https://docs.convex.dev/generated-api/api#docusaurus_skipToContent_fallback)

On this page

This code is generated

These exports are not directly available in the \`convex\` package!

Instead you need to run \`npx convex dev\` to create \`convex/_generated/api.js\`
and \`convex/_generated/api.d.ts\`.

These types require running code generation because they are specific to the
Convex functions you define for your app.

If you aren't using code generation, you can use
[\`makeFunctionReference\`](https://docs.convex.dev/api/modules/server#makefunctionreference) instead.

### api [​](https://docs.convex.dev/generated-api/api\\#api \"Direct link to api\")

An object of type \`API\` describing your app's public Convex API.

Its \`API\` type includes information about the arguments and return types of your
app's Convex functions.

The api object is used by client-side React hooks and Convex functions that run
or schedule other functions.

src/App.jsx

\`\`\`codeBlockLines_zEuJ
import { api } from \"../convex/_generated/api\";
import { useQuery } from \"convex/react\";

const data = useQuery(api.messages.list);

\`\`\`

### internal [​](https://docs.convex.dev/generated-api/api\\#internal \"Direct link to internal\")

Another object of type \`API\` describing your app's internal Convex API.

convex/upgrade.js

\`\`\`codeBlockLines_zEuJ
import { action } from \"../_generated/server\";
import { internal } from \"../_generated/api\";

export default action(async ({ runMutation }, { planId, ... }) => {
  // Call out to payment provider (e.g. Stripe) to charge customer
  const response = await fetch(...);
  if (response.ok) {
    // Mark the plan as \"professional\" in the Convex DB
    await runMutation(internal.plans.markPlanAsProfessional, { planId });
  }
});

\`\`\`

- [api](https://docs.convex.dev/generated-api/api#api)
- [internal](https://docs.convex.dev/generated-api/api#internal)



[Skip to main content](https://docs.convex.dev/client/react-native#docusaurus_skipToContent_fallback)

To use Convex in [React Native](https://reactnative.dev/) use the
[Convex React client library](https://docs.convex.dev/client/react).

Follow the [React Native Quickstart](https://docs.convex.dev/quickstart/react-native) for the
different configuration needed specifically for React Native.

You can also clone a working
[Convex React Native demo](https://github.com/get-convex/convex-demos/tree/main/react-native).



[Skip to main content](https://docs.convex.dev/testing/ci#docusaurus_skipToContent_fallback)

On this page

Continuous integration allows your team to move fast by combining changes from
all team members and automatically testing them on a remote machine.

## Testing in GitHub Actions [​](https://docs.convex.dev/testing/ci\\#testing-in-github-actions \"Direct link to Testing in GitHub Actions\")

It's easy if you're using [GitHub](https://docs.github.com/en/actions) to set up
[CI](https://docs.github.com/en/actions/automating-builds-and-tests/about-continuous-integration)
workflow for running your test suite:

.github/workflows/test.yml

\`\`\`codeBlockLines_zEuJ
name: Run Tests

on: [pull_request, push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test

\`\`\`

After you commit and push this file to your repository, GitHub will run
\`npm run test\` every time you create a pull request or push a new commit.

- [Testing in GitHub Actions](https://docs.convex.dev/testing/ci#testing-in-github-actions)


[Skip to main content](https://docs.convex.dev/functions/validation#docusaurus_skipToContent_fallback)

On this page

Argument and return value validators ensure that
[queries](https://docs.convex.dev/functions/query-functions), [mutations](https://docs.convex.dev/functions/mutation-functions), and
[actions](https://docs.convex.dev/functions/actions) are called with the correct types of arguments and
return the expected types of return values.

**This is important for security!** Without argument validation, a malicious
user can call your public functions with unexpected arguments and cause
surprising results. [TypeScript](https://docs.convex.dev/understanding/best-practices/typescript) alone
won't help because TypeScript types aren't present at runtime. We recommend
adding argument validation for all public functions in production apps. For
non-public functions that are not called by clients, we recommend
[internal functions](https://docs.convex.dev/functions/internal-functions) and optionally
validation.

**Example:** [Argument Validation](https://github.com/get-convex/convex-demos/tree/main/args-validation)

## Adding validators [​](https://docs.convex.dev/functions/validation\\#adding-validators \"Direct link to Adding validators\")

To add argument validation to your functions, pass an object with \`args\` and
\`handler\` properties to the \`query\`, \`mutation\` or \`action\` constructor. To add
return value validation, use the \`returns\` property in this object:

convex/message.ts

TS

\`\`\`codeBlockLines_zEuJ
import { mutation, query } from \"./_generated/server\";
import { v } from \"convex/values\";

export const send = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { body, author } = args;
    await ctx.db.insert(\"messages\", { body, author });
  },
});

\`\`\`

If you define your function with an argument validator, there is no need to
include [TypeScript](https://docs.convex.dev/understanding/best-practices/typescript) type
annotations! The type of your function will be inferred automatically.
Similarly, if you define a return value validator, the return type of your
function will be inferred from the validator, and TypeScript will check that it
matches the inferred return type of the \`handler\` function.

Unlike TypeScript, validation for an object will throw if the object contains
properties that are not declared in the validator.

If the client supplies arguments not declared in \`args\`, or if the function
returns a value that does not match the validator declared in \`returns\`. This is
helpful to prevent bugs caused by mistyped names of arguments or returning more
data than intended to a client.

Even \`args: {}\` is a helpful use of validators because TypeScript will show an
error on the client if you try to pass any arguments to the function which
doesn't expect them.

## Supported types [​](https://docs.convex.dev/functions/validation\\#supported-types \"Direct link to Supported types\")

All functions, both public and internal, can accept and return the following
data types. Each type has a corresponding validator that can be accessed on the
[\`v\`](https://docs.convex.dev/api/modules/values#v) object imported from \`\"convex/values\"\`.

The [database](https://docs.convex.dev/database) can store the exact same set of
[data types](https://docs.convex.dev/database/types).

Additionally you can also express type unions, literals, \`any\` types, and
optional fields.

### Convex values [​](https://docs.convex.dev/functions/validation\\#convex-values \"Direct link to Convex values\")

Convex supports the following types of values:

| Convex Type | TS/JS Type | Example Usage | Validator for [Argument Validation](https://docs.convex.dev/functions/validation) and [Schemas](https://docs.convex.dev/database/schemas) | \`json\` Format for [Export](https://docs.convex.dev/database/import-export) | Notes |
| --- | --- | --- | --- | --- | --- |
| Id | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type) | \`doc._id\` | \`v.id(tableName)\` | string | See [Document IDs](https://docs.convex.dev/database/document-ids). |
| Null | [null](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#null_type) | \`null\` | \`v.null()\` | null | JavaScript's \`undefined\` is not a valid Convex value. Functions the return \`undefined\` or do not return will return \`null\` when called from a client. Use \`null\` instead. |
| Int64 | [bigint](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#bigint_type) | \`3n\` | \`v.int64()\` | string (base10) | Int64s only support BigInts between -2^63 and 2^63-1. Convex supports \`bigint\` s in [most modern browsers](https://caniuse.com/bigint). |
| Float64 | [number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type) | \`3.1\` | \`v.number()\` | number / string | Convex supports all IEEE-754 double-precision floating point numbers (such as NaNs). Inf and NaN are JSON serialized as strings. |
| Boolean | [boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type) | \`true\` | \`v.boolean()\` | bool |  |
| String | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type) | \`\"abc\"\` | \`v.string()\` | string | Strings are stored as UTF-8 and must be valid Unicode sequences. Strings must be smaller than the 1MB total size limit when encoded as UTF-8. |
| Bytes | [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) | \`new ArrayBuffer(8)\` | \`v.bytes()\` | string (base64) | Convex supports first class bytestrings, passed in as \`ArrayBuffer\` s. Bytestrings must be smaller than the 1MB total size limit for Convex types. |
| Array | [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) | \`[1, 3.2, \"abc\"]\` | \`v.array(values)\` | array | Arrays can have at most 8192 values. |
| Object | [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#objects) | \`{a: \"abc\"}\` | \`v.object({property: value})\` | object | Convex only supports \"plain old JavaScript objects\" (objects that do not have a custom prototype). Convex includes all [enumerable properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties). Objects can have at most 1024 entries. Field names must be nonempty and not start with \"$\" or \"\\_\". |
| Record | [Record](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type) | \`{\"a\": \"1\", \"b\": \"2\"}\` | \`v.record(keys, values)\` | object | Records are objects at runtime, but can have dynamic keys. Keys must be only ASCII characters, nonempty, and not start with \"$\" or \"\\_\". |

### Unions [​](https://docs.convex.dev/functions/validation\\#unions \"Direct link to Unions\")

You can describe fields that could be one of multiple types using \`v.union\`:

\`\`\`codeBlockLines_zEuJ
import { mutation } from \"./_generated/server\";
import { v } from \"convex/values\";

export default mutation({
  args: {
    stringOrNumber: v.union(v.string(), v.number()),
  },
  handler: async ({ db }, { stringOrNumber }) => {
    //...
  },
});

\`\`\`

### Literals [​](https://docs.convex.dev/functions/validation\\#literals \"Direct link to Literals\")

Fields that are a constant can be expressed with \`v.literal\`. This is especially
useful when combined with unions:

\`\`\`codeBlockLines_zEuJ
import { mutation } from \"./_generated/server\";
import { v } from \"convex/values\";

export default mutation({
  args: {
    oneTwoOrThree: v.union(
      v.literal(\"one\"),
      v.literal(\"two\"),
      v.literal(\"three\"),
    ),
  },
  handler: async ({ db }, { oneTwoOrThree }) => {
    //...
  },
});

\`\`\`

### Record objects [​](https://docs.convex.dev/functions/validation\\#record-objects \"Direct link to Record objects\")

You can describe objects that map arbitrary keys to values with \`v.record\`:

\`\`\`codeBlockLines_zEuJ
import { mutation } from \"./_generated/server\";
import { v } from \"convex/values\";

export default mutation({
  args: {
    simpleMapping: v.record(v.string(), v.boolean()),
  },
  handler: async ({ db }, { simpleMapping }) => {
    //...
  },
});

\`\`\`

You can use other types of string validators for the keys:

\`\`\`codeBlockLines_zEuJ
defineTable({
  userIdToValue: v.record(v.id(\"users\"), v.boolean()),
});

\`\`\`

Notes:

- This type corresponds to the
[Record<K,V>](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
type in TypeScript
- You cannot use string literals as a \`record\` key
- Using \`v.string()\` as a \`record\` key validator will only allow ASCII
characters

### Any [​](https://docs.convex.dev/functions/validation\\#any \"Direct link to Any\")

Fields that could take on any value can be represented with \`v.any()\`:

\`\`\`codeBlockLines_zEuJ
import { mutation } from \"./_generated/server\";
import { v } from \"convex/values\";

export default mutation({
  args: {
    anyValue: v.any(),
  },
  handler: async ({ db }, { anyValue }) => {
    //...
  },
});

\`\`\`

This corresponds to the \`any\` type in TypeScript.

### Optional fields [​](https://docs.convex.dev/functions/validation\\#optional-fields \"Direct link to Optional fields\")

You can describe optional fields by wrapping their type with \`v.optional(...)\`:

\`\`\`codeBlockLines_zEuJ
import { mutation } from \"./_generated/server\";
import { v } from \"convex/values\";

export default mutation({
  args: {
    optionalString: v.optional(v.string()),
    optionalNumber: v.optional(v.number()),
  },
  handler: async ({ db }, { optionalString, optionalNumber }) => {
    //...
  },
});

\`\`\`

This corresponds to marking fields as optional with \`?\` in TypeScript.

## Extracting TypeScript types [​](https://docs.convex.dev/functions/validation\\#extracting-typescript-types \"Direct link to Extracting TypeScript types\")

The [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) type allows you to turn validator calls
into TypeScript types. This can be useful to remove duplication between your
validators and TypeScript types:

\`\`\`codeBlockLines_zEuJ
import { mutation } from \"./_generated/server\";
import { Infer, v } from \"convex/values\";

const nestedObject = v.object({
  property: v.string(),
});

// Resolves to \`{property: string}\`.
export type NestedObject = Infer<typeof nestedObject>;

export default mutation({
  args: {
    nested: nestedObject,
  },
  handler: async ({ db }, { nested }) => {
    //...
  },
});

\`\`\`

- [Adding validators](https://docs.convex.dev/functions/validation#adding-validators)
- [Supported types](https://docs.convex.dev/functions/validation#supported-types)
  - [Convex values](https://docs.convex.dev/functions/validation#convex-values)
  - [Unions](https://docs.convex.dev/functions/validation#unions)
  - [Literals](https://docs.convex.dev/functions/validation#literals)
  - [Record objects](https://docs.convex.dev/functions/validation#record-objects)
  - [Any](https://docs.convex.dev/functions/validation#any)
  - [Optional fields](https://docs.convex.dev/functions/validation#optional-fields)
- [Extracting TypeScript types](https://docs.convex.dev/functions/validation#extracting-typescript-types)

[Skip to main content](https://docs.convex.dev/home#docusaurus_skipToContent_fallback)

Convex is an all-in-one backend platform with thoughtful, product-centric
APIs.

Use [TypeScript](https://docs.convex.dev/understanding/best-practices/typescript) to write [queries as\\\\
code](https://docs.convex.dev/functions/query-functions) that are [automatically\\\\
cached](https://docs.convex.dev/realtime#automatic-caching) and [realtime](https://docs.convex.dev/realtime), with an acid
compliant [relational database](https://docs.convex.dev/database).
[**Learn Convex by creating a chat app** \\\\
\\\\
Convex provides you with a fully featured backend with cloud functions,](https://docs.convex.dev/tutorial)

## Quickstarts [​](https://docs.convex.dev/home\\#quickstarts \"Direct link to Quickstarts\")

Quickly get up and running with your favorite frontend tooling or language:

[React Logo\\\\
**React**](https://docs.convex.dev/quickstart/react) [**Next.js**](https://docs.convex.dev/quickstart/nextjs) [**Remix**](https://docs.convex.dev/quickstart/remix) [**TanStack Start**](https://docs.convex.dev/quickstart/tanstack-start) [**React Native**](https://docs.convex.dev/quickstart/react-native) [**Vue**](https://docs.convex.dev/quickstart/vue) [**Svelte**](https://docs.convex.dev/quickstart/svelte) [**Node.js**](https://docs.convex.dev/quickstart/nodejs) [Bun Logo\\\\
**Bun**](https://docs.convex.dev/quickstart/bun) [HTML5 Logo\\\\
**Script tag**](https://docs.convex.dev/quickstart/script-tag) [**Python**](https://docs.convex.dev/quickstart/python) [**iOS Swift**](https://docs.convex.dev/quickstart/swift) [**Android Kotlin**](https://docs.convex.dev/quickstart/android) [**Rust**](https://docs.convex.dev/quickstart/rust)

## Why Convex? [​](https://docs.convex.dev/home\\#why-convex \"Direct link to Why Convex?\")

YouTube

## Backends Should be Designed for Product Developers

Intro to Convex - YouTube

Convex

2.07K subscribers

[Intro to Convex](https://www.youtube.com/watch?v=UVvd7BF99-4)

Convex

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=UVvd7BF99-4 \"Watch on YouTube\")

## Intro to Convex

Supercharge your Application with a Reactive Database - YouTube

Convex

2.07K subscribers

[Supercharge your Application with a Reactive Database](https://www.youtube.com/watch?v=V6En7UO4Ui0)

Convex

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=V6En7UO4Ui0 \"Watch on YouTube\")

## Supercharging your app with a reactive backend

Why I use Convex over Supabase as my BaaS - YouTube

Web Dev Cody

246K subscribers

[Why I use Convex over Supabase as my BaaS](https://www.youtube.com/watch?v=O_HXVAMPEbc)

Web Dev Cody

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=O_HXVAMPEbc \"Watch on YouTube\")

## Why I use Convex over Supabase as my BaaS

Read the team's Perspectives on [Stack](https://stack.convex.dev/):

[**Convex vs Relational Databases**](https://stack.convex.dev/convex-vs-relational-databases) [**Convex vs Firebase**](https://stack.convex.dev/convex-vs-firebase) [**It's not you, it's SQL**](https://stack.convex.dev/not-sql) [**How Convex Works**](https://stack.convex.dev/how-convex-works) [**The Software-Defined Database**](https://stack.convex.dev/the-software-defined-database) [**Convex Perspectives**](https://stack.convex.dev/tag/Perspectives)

## Learn Convex [​](https://docs.convex.dev/home\\#learn-convex \"Direct link to Learn Convex\")

A quick start guide for using Convex with Next.js - YouTube

Web Dev Cody

246K subscribers

[A quick start guide for using Convex with Next.js](https://www.youtube.com/watch?v=vaQZYRSiimI)

Web Dev Cody

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=vaQZYRSiimI \"Watch on YouTube\")

## A quick start guide for using Convex with Next.js

Fullstack Notion Clone: Next.js 13, React, Convex, Tailwind \\| Full Course 2023 - YouTube

Code With Antonio

371K subscribers

[Fullstack Notion Clone: Next.js 13, React, Convex, Tailwind \\| Full Course 2023](https://www.youtube.com/watch?v=0OaDyjB9Ib8)

Code With Antonio

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=0OaDyjB9Ib8 \"Watch on YouTube\")

## Fullstack Notion Clone: Next.js 13, React, Convex, Tailwind

Build and Deploy a Saas Podcast Platform in Next.js - YouTube

JavaScript Mastery

1.03M subscribers

[Build and Deploy a Saas Podcast Platform in Next.js](https://www.youtube.com/watch?v=zfAb95tJvZQ)

JavaScript Mastery

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=zfAb95tJvZQ \"Watch on YouTube\")

## Build and Deploy a Saas Podcast Platform in Next.js

Building a Subscription Based SaaS with my Favorite Tech Stack (Next.js, Stripe, Convex, Clerk) - YouTube

Web Dev Cody

246K subscribers

[Building a Subscription Based SaaS with my Favorite Tech Stack (Next.js, Stripe, Convex, Clerk)](https://www.youtube.com/watch?v=Vjtn9pWAZDI)

Web Dev Cody

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=Vjtn9pWAZDI \"Watch on YouTube\")

## Building a Subscription Based SaaS with Stripe

See more walkthroughs and patterns on [Stack](https://stack.convex.dev/)

[**Build AI Apps**](https://stack.convex.dev/tag/AI) [**Convex Patterns**](https://stack.convex.dev/tag/Patterns) [**Convex Walkthroughs**](https://stack.convex.dev/tag/Walkthroughs)

reCAPTCHA

Recaptcha requires verification.

[Privacy](https://www.google.com/intl/en/policies/privacy/) \\- [Terms](https://www.google.com/intl/en/policies/terms/)

protected by **reCAPTCHA**

[Privacy](https://www.google.com/intl/en/policies/privacy/) \\- [Terms](https://www.google.com/intl/en/policies/terms/)[Skip to main content](https://docs.convex.dev/scheduling/scheduled-functions#docusaurus_skipToContent_fallback)

On this page

Convex allows you to schedule functions to run in the future. This allows you to
build powerful durable workflows without the need to set up and maintain queues
or other infrastructure.

Scheduled functions are stored in the database. This means you can schedule
functions minutes, days, and even months in the future. Scheduling is resilient
against unexpected downtime or system restarts.

**Example:** [Scheduling](https://github.com/get-convex/convex-demos/tree/main/scheduling)

## Scheduling functions [​](https://docs.convex.dev/scheduling/scheduled-functions\\#scheduling-functions \"Direct link to Scheduling functions\")

You can schedule public functions and
[internal functions](https://docs.convex.dev/functions/internal-functions) from mutations and
actions via the [scheduler](https://docs.convex.dev/api/interfaces/server.Scheduler) provided in the
respective function context.

- [runAfter](https://docs.convex.dev/api/interfaces/server.Scheduler#runafter) schedules a function to
run after a delay (measured in milliseconds).
- [runAt](https://docs.convex.dev/api/interfaces/server.Scheduler#runat) schedules a function run at a
date or timestamp (measured in milliseconds elapsed since the epoch).

The rest of the arguments are the path to the function and its arguments,
similar to invoking a function from the client. For example, here is how to send
a message that self-destructs in five seconds.

convex/messages.ts

TS

\`\`\`codeBlockLines_zEuJ
import { mutation, internalMutation } from \"./_generated/server\";
import { internal } from \"./_generated/api\";
import { v } from \"convex/values\";

export const sendExpiringMessage = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, args) => {
    const { body, author } = args;
    const id = await ctx.db.insert(\"messages\", { body, author });
    await ctx.scheduler.runAfter(5000, internal.messages.destruct, {
      messageId: id,
    });
  },
});

export const destruct = internalMutation({
  args: {
    messageId: v.id(\"messages\"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.messageId);
  },
});

\`\`\`

A single function can schedule up to 1000 functions with total argument size of
8MB.

### Scheduling from mutations [​](https://docs.convex.dev/scheduling/scheduled-functions\\#scheduling-from-mutations \"Direct link to Scheduling from mutations\")

Scheduling functions from
[mutations](https://docs.convex.dev/functions/mutation-functions#transactions) is atomic with
the rest of the mutation. This means that if the mutation succeeds, the
scheduled function is guaranteed to be scheduled. On the other hand, if the
mutations fails, no function will be scheduled, even if the function fails after
the scheduling call.

### Scheduling from actions [​](https://docs.convex.dev/scheduling/scheduled-functions\\#scheduling-from-actions \"Direct link to Scheduling from actions\")

Unlike mutations, [actions](https://docs.convex.dev/functions/actions) don't execute as a
single database transaction and can have side effects. Thus, scheduling from
actions does not depend on the outcome of the function. This means that an
action might succeed to schedule some functions and later fail due to transient
error or a timeout. The scheduled functions will still be executed.

### Scheduling immediately [​](https://docs.convex.dev/scheduling/scheduled-functions\\#scheduling-immediately \"Direct link to Scheduling immediately\")

Using \`runAfter()\` with delay set to 0 is used to immediately add a function to
the event queue. This usage may be familiar to you if you're used to calling
\`setTimeout(fn, 0)\`.

As noted above, actions are not atomic and are meant to cause side effects.
Scheduling immediately becomes useful when you specifically want to trigger an
action from a mutation that is conditional on the mutation succeeding.
[This post](https://stack.convex.dev/pinecone-and-embeddings#kick-off-a-background-action)
goes over a direct example of this in action, where the application depends on
an external service to fill in information to the database.

## Retrieving scheduled function status [​](https://docs.convex.dev/scheduling/scheduled-functions\\#retrieving-scheduled-function-status \"Direct link to Retrieving scheduled function status\")

Every scheduled function is reflected as a document in the
\`\"_scheduled_functions\"\` system table. \`runAfter()\` and \`runAt()\` return the id
of scheduled function. You can read data from system tables using the
\`db.system.get\` and \`db.system.query\` methods, which work the same as the
standard \`db.get\` and \`db.query\` methods.

convex/messages.ts

TS

\`\`\`codeBlockLines_zEuJ
export const listScheduledMessages = query({
  args: {},
  handler: async (ctx, args) => {
    return await ctx.db.system.query(\"_scheduled_functions\").collect();
  },
});

export const getScheduledMessage = query({
  args: {
    id: v.id(\"_scheduled_functions\"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.system.get(args.id);
  },
});

\`\`\`

This is an example of the returned document:

\`\`\`codeBlockLines_zEuJ
{
  \"_creationTime\": 1699931054642.111,
  \"_id\": \"3ep33196167235462543626ss0scq09aj4gqn9kdxrdr\",
  \"args\": [{}],
  \"completedTime\": 1699931054690.366,
  \"name\": \"messages.js:destruct\",
  \"scheduledTime\": 1699931054657,
  \"state\": { \"kind\": \"success\" }
}

\`\`\`

The returned document has the following fields:

- \`name\`: the path of the scheduled function
- \`args\`: the arguments passed to the scheduled function
- \`scheduledTime\`: the timestamp of when the function is scheduled to run
(measured in milliseconds elapsed since the epoch)
- \`completedTime\`: the timestamp of when the function finished running, if it
has completed (measured in milliseconds elapsed since the epoch)
- \`state\`: the status of the scheduled function. Here are the possible states a
scheduled function can be in:
  - \`Pending\`: the function has not been started yet
  - \`InProgress\`: the function has started running is not completed yet (only
    applies to actions)
  - \`Success\`: the function finished running successfully with no errors
  - \`Failed\`: the function hit an error while running, which can either be a
    user error or an internal server error
  - \`Canceled\`: the function was canceled via the dashboard,
    \`ctx.scheduler.cancel\`, or recursively by a parent scheduled function that
    was canceled while in progress

Scheduled function results are available for 7 days after they have completed.

## Canceling scheduled functions [​](https://docs.convex.dev/scheduling/scheduled-functions\\#canceling-scheduled-functions \"Direct link to Canceling scheduled functions\")

You can cancel a previously scheduled function with
[\`cancel\`](https://docs.convex.dev/api/interfaces/server.Scheduler#cancel) via the
[scheduler](https://docs.convex.dev/api/interfaces/server.Scheduler) provided in the respective
function context.

convex/messages.ts

TS

\`\`\`codeBlockLines_zEuJ
export const cancelMessage = mutation({
  args: {
    id: v.id(\"_scheduled_functions\"),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.cancel(args.id);
  },
});

\`\`\`

What \`cancel\` does depends on the state of the scheduled function:

- If it hasn't started running, it won't run.
- If it already started, it will continue to run, but any functions it schedules
will not run.

## Debugging [​](https://docs.convex.dev/scheduling/scheduled-functions\\#debugging \"Direct link to Debugging\")

You can view logs from previously executed scheduled functions in the Convex
dashboard [Logs view](https://docs.convex.dev/dashboard#logs-view). You can view and cancel yet
to be executed functions in the
[Functions view](https://docs.convex.dev/dashboard#functions-view).

## Error handling [​](https://docs.convex.dev/scheduling/scheduled-functions\\#error-handling \"Direct link to Error handling\")

Once scheduled, mutations are guaranteed to be executed exactly once. Convex
will automatically retry any internal Convex errors, and only fail on developer
errors. See [Error Handling](https://docs.convex.dev/functions/error-handling/)
for more details on different error types.

Since actions may have side effects, they are not automatically retried by
Convex. Thus, actions will be executed at most once, and permanently fail if
there are transient errors while executing them. Developers can retry those
manually by scheduling a mutation that checks if the desired outcome has been
achieved and if not schedule the action again.

## Auth [​](https://docs.convex.dev/scheduling/scheduled-functions\\#auth \"Direct link to Auth\")

The auth is not propagated from the scheduling to the scheduled function. If you
want to authenticate or check authorization, you'll have to pass the requisite
user information in as a parameter.

- [Scheduling functions](https://docs.convex.dev/scheduling/scheduled-functions#scheduling-functions)
  - [Scheduling from mutations](https://docs.convex.dev/scheduling/scheduled-functions#scheduling-from-mutations)
  - [Scheduling from actions](https://docs.convex.dev/scheduling/scheduled-functions#scheduling-from-actions)
  - [Scheduling immediately](https://docs.convex.dev/scheduling/scheduled-functions#scheduling-immediately)
- [Retrieving scheduled function status](https://docs.convex.dev/scheduling/scheduled-functions#retrieving-scheduled-function-status)
- [Canceling scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions#canceling-scheduled-functions)
- [Debugging](https://docs.convex.dev/scheduling/scheduled-functions#debugging)
- [Error handling](https://docs.convex.dev/scheduling/scheduled-functions#error-handling)
- [Auth](https://docs.convex.dev/scheduling/scheduled-functions#auth)



[Skip to main content](https://docs.convex.dev/search/text-search#docusaurus_skipToContent_fallback)

On this page

Full text search allows you to find Convex documents that approximately match a
search query.

Unlike normal
[document queries](https://docs.convex.dev/database/reading-data/#querying-documents),
search queries look _within_ a string field to find the keywords. Search queries
are useful for building features like searching for messages that contain
certain words.

Search queries are automatically reactive, consistent, transactional, and work
seamlessly with pagination. They even include new documents created with a
mutation!

**Example:** [Search App](https://github.com/get-convex/convex-demos/tree/main/search)

To use full text search you need to:

1. Define a search index.
2. Run a search query.

Search indexes are built and queried using Convex's multi-segment search
algorithm on top of [Tantivy](https://github.com/quickwit-oss/tantivy), a
powerful, open-source, full-text search library written in Rust.

Search is in beta

Searchis currently a [beta\\\\
feature](https://docs.convex.dev/production/state/#beta-features). If you have feedback or feature
requests, [let us know on Discord](https://convex.dev/community)!

## Defining search indexes [​](https://docs.convex.dev/search/text-search\\#defining-search-indexes \"Direct link to Defining search indexes\")

Like [database indexes](https://docs.convex.dev/database/reading-data/indexes/), search
indexes are a data structure that is built in advance to enable efficient
querying. Search indexes are defined as part of your Convex
[schema](https://docs.convex.dev/database/schemas).

Every search index definition consists of:

1. A name.
   - Must be unique per table.
2. A \`searchField\`
   - This is the field which will be indexed for full text search.
   - It must be of type \`string\`.
3. \\[Optional\\] A list of \`filterField\` s
   - These are additional fields that are indexed for fast equality filtering
     within your search index.

To add a search index onto a table, use the
[\`searchIndex\`](https://docs.convex.dev/api/classes/server.TableDefinition#searchindex) method on your
table's schema. For example, if you want an index which can search for messages
matching a keyword in a channel, your schema could look like:

convex/schema.ts

\`\`\`codeBlockLines_zEuJ
import { defineSchema, defineTable } from \"convex/server\";
import { v } from \"convex/values\";

export default defineSchema({
  messages: defineTable({
    body: v.string(),
    channel: v.string(),
  }).searchIndex(\"search_body\", {
    searchField: \"body\",
    filterFields: [\"channel\"],
  }),
});

\`\`\`

You can specify search and filter fields on nested documents by using a
dot-separated path like \`properties.name\`.

## Running search queries [​](https://docs.convex.dev/search/text-search\\#running-search-queries \"Direct link to Running search queries\")

A query for \"10 messages in channel '#general' that best match the query 'hello
hi' in their body\" would look like:

\`\`\`codeBlockLines_zEuJ
const messages = await ctx.db
  .query(\"messages\")
  .withSearchIndex(\"search_body\", (q) =>
    q.search(\"body\", \"hello hi\").eq(\"channel\", \"#general\"),
  )
  .take(10);

\`\`\`

This is just a normal
[database read](https://docs.convex.dev/database/reading-data/) that begins by
querying the search index!

The
[\`.withSearchIndex\`](https://docs.convex.dev/api/interfaces/server.QueryInitializer#withsearchindex)
method defines which search index to query and how Convex will use that search
index to select documents. The first argument is the name of the index and the
second is a _search filter expression_. A search filter expression is a
description of which documents Convex should consider when running the query.

A search filter expression is always a chained list of:

1. 1 search expression against the index's search field defined with
[\`.search\`](https://docs.convex.dev/api/interfaces/server.SearchFilterBuilder#search).
2. 0 or more equality expressions against the index's filter fields defined with
[\`.eq\`](https://docs.convex.dev/api/interfaces/server.SearchFilterFinalizer#eq).

### Search expressions [​](https://docs.convex.dev/search/text-search\\#search-expressions \"Direct link to Search expressions\")

Search expressions are issued against a search index, filtering and ranking
documents by their relevance to the search expression's query. Internally,
Convex will break up the query into separate words (called _terms_) and
approximately rank documents matching these terms.

In the example above, the expression \`search(\"body\", \"hello hi\")\` would
internally be split into \`\"hi\"\` and \`\"hello\"\` and matched against words in your
document (ignoring case and punctuation).

The behavior of search incorporates [prefix matching rules](https://docs.convex.dev/search/text-search#search-behavior).

### Equality expressions [​](https://docs.convex.dev/search/text-search\\#equality-expressions \"Direct link to Equality expressions\")

Unlike search expressions, equality expressions will filter to only documents
that have an exact match in the given field. In the example above,
\`eq(\"channel\", \"#general\")\` will only match documents that have exactly
\`\"#general\"\` in their \`channel\` field.

Equality expressions support fields of any type (not just text).

To filter to documents that are missing a field, use
\`q.eq(\"fieldName\", undefined)\`.

### Other filtering [​](https://docs.convex.dev/search/text-search\\#other-filtering \"Direct link to Other filtering\")

Because search queries are normal database queries, you can also
[filter results](https://docs.convex.dev/database/reading-data/#filtering) using
the [\`.filter\` method](https://docs.convex.dev/api/interfaces/server.Query#filter)!

Here's a query for \"messages containing 'hi' sent in the last 10 minutes\":

\`\`\`codeBlockLines_zEuJ
const messages = await ctx.db
  .query(\"messages\")
  .withSearchIndex(\"search_body\", (q) => q.search(\"body\", \"hi\"))
  .filter((q) => q.gt(q.field(\"_creationTime\", Date.now() - 10 * 60000)))
  .take(10);

\`\`\`

**For performance, always put as many of your filters as possible into**
**\`.withSearchIndex\`.**

Every search query is executed by:

1. First, querying the search index using the search filter expression in
\`withSearchIndex\`.
2. Then, filtering the results one-by-one using any additional \`filter\`
expressions.

Having a very specific search filter expression will make your query faster and
less likely to hit Convex's limits because Convex will use the search index to
efficiently cut down on the number of results to consider.

### Retrieving results and paginating [​](https://docs.convex.dev/search/text-search\\#retrieving-results-and-paginating \"Direct link to Retrieving results and paginating\")

Just like ordinary database queries, you can
[retrieve the results](https://docs.convex.dev/database/reading-data/#retrieving-results)
using [\`.collect()\`](https://docs.convex.dev/api/interfaces/server.Query#collect),
[\`.take(n)\`](https://docs.convex.dev/api/interfaces/server.Query#take),
[\`.first()\`](https://docs.convex.dev/api/interfaces/server.Query#first), and
[\`.unique()\`](https://docs.convex.dev/api/interfaces/server.Query#unique).

Additionally, search results can be [paginated](https://docs.convex.dev/database/pagination)
using
[\`.paginate(paginationOpts)\`](https://docs.convex.dev/api/interfaces/server.OrderedQuery#paginate).

Note that \`collect()\` will throw an exception if it attempts to collect more
than the limit of 1024 documents. It is often better to pick a smaller limit and
use \`take(n)\` or paginate the results.

### Ordering [​](https://docs.convex.dev/search/text-search\\#ordering \"Direct link to Ordering\")

Search queries always return results in [relevance order](https://docs.convex.dev/search/text-search#relevance-order)
based on how well the document matches the search query. Different ordering of
results are not supported.

## Search Behavior [​](https://docs.convex.dev/search/text-search\\#search-behavior \"Direct link to Search Behavior\")

### Typeahead Search [​](https://docs.convex.dev/search/text-search\\#typeahead-search \"Direct link to Typeahead Search\")

Convex full-text search is designed to power as-you-type search experiences. In
your search queries, the final search term has _prefix search_ enabled, matching
any term that is a prefix of the original term. For example, the expression
\`search(\"body\", \"r\")\` would match the documents:

- \`\"rabbit\"\`
- \`\"send request\"\`

Fuzzy search matches are deprecated. After January 15, 2025, search results will
not include \`\"snake\"\` for a typo like \`\"stake\"\`.

### Relevance order [​](https://docs.convex.dev/search/text-search\\#relevance-order \"Direct link to Relevance order\")

**Relevance order is subject to change.** The relevance of search results and
the exact typo-tolerance rules Convex applies is subject to change to improve
the quality of search results.

Search queries return results in relevance order. Internally, Convex ranks the
relevance of a document based on a combination of its
[BM25 score](https://en.wikipedia.org/wiki/Okapi_BM25) and several other
criteria such as the number of typos of matched terms in the document, the
proximity of matches, the number of exact matches, and more. The BM25 score
takes into account:

- How many words in the search query appear in the field?
- How many times do they appear?
- How long is the text field?

If multiple documents have the same score, the newest documents are returned
first.

## Limits [​](https://docs.convex.dev/search/text-search\\#limits \"Direct link to Limits\")

Search indexes work best with English or other Latin-script languages. Text is
tokenized using Tantivy's
[\`SimpleTokenizer\`](https://docs.rs/tantivy/latest/tantivy/tokenizer/struct.SimpleTokenizer.html),
which splits on whitespace and punctuation. We also limit terms to 32 characters
in length and lowercase them.

Search indexes must have:

- Exactly 1 search field.
- Up to 16 filter fields.

Search indexes count against the
[limit of 32 indexes per table](https://docs.convex.dev/database/reading-data/indexes/#limits).

Search queries can have:

- Up to 16 terms (words) in the search expression.
- Up to 8 filter expressions.

Additionally, search queries can scan up to 1024 results from the search index.

The source of truth for these limits is our
[source code](https://github.com/get-convex/convex-backend/blob/main/crates/search/src/constants.rs).

For information on other limits, see [here](https://docs.convex.dev/production/state/limits).

- [Defining search indexes](https://docs.convex.dev/search/text-search#defining-search-indexes)
- [Running search queries](https://docs.convex.dev/search/text-search#running-search-queries)
  - [Search expressions](https://docs.convex.dev/search/text-search#search-expressions)
  - [Equality expressions](https://docs.convex.dev/search/text-search#equality-expressions)
  - [Other filtering](https://docs.convex.dev/search/text-search#other-filtering)
  - [Retrieving results and paginating](https://docs.convex.dev/search/text-search#retrieving-results-and-paginating)
  - [Ordering](https://docs.convex.dev/search/text-search#ordering)
- [Search Behavior](https://docs.convex.dev/search/text-search#search-behavior)
  - [Typeahead Search](https://docs.convex.dev/search/text-search#typeahead-search)
  - [Relevance order](https://docs.convex.dev/search/text-search#relevance-order)
- [Limits](https://docs.convex.dev/search/text-search#limits)



[Skip to main content](https://docs.convex.dev/realtime#docusaurus_skipToContent_fallback)

On this page

Turns out Convex is automatically realtime! You don't have to do anything
special if you are already using [query functions](https://docs.convex.dev/functions/query-functions),
[database](https://docs.convex.dev/database), and [client libraries](https://docs.convex.dev/client/react/) in your app.
Convex tracks the dependencies to your query functions, including database
changes, and triggers the subscription in the client libraries.

![Convex is automatically reactive and realtime](https://docs.convex.dev/assets/images/realtime-3197272a21b075792f6ac922af228378.gif)

Aside from building a highly interactive app with ease, there are other benefits
to the realtime architecture of Convex:

## Automatic caching [​](https://docs.convex.dev/realtime\\#automatic-caching \"Direct link to Automatic caching\")

Convex automatically caches the result of your query functions so that future
calls just read from the cache. The cache is updated if the data ever changes.
You don't get charged for database bandwidth for cached reads.

This requires no work or bookkeeping from you.

## Consistent data across your app [​](https://docs.convex.dev/realtime\\#consistent-data-across-your-app \"Direct link to Consistent data across your app\")

Every client subscription gets updated simultaneously to the same snapshot of
the database. Your app always displays the most consistent view of your data.

This avoids bugs like increasing the number of items in the shopping cart and
not showing that an item is sold out.

## Learn more [​](https://docs.convex.dev/realtime\\#learn-more \"Direct link to Learn more\")

Learn how to work with realtime and reactive queries in Convex on
[Stack](https://stack.convex.dev/tag/Reactivity).

Related posts from [![Stack](https://docs.convex.dev/img/stack-logo-dark.svg)![Stack](https://docs.convex.dev/img/stack-logo-light.svg)](https://stack.convex.dev/)

- [Automatic caching](https://docs.convex.dev/realtime#automatic-caching)
- [Consistent data across your app](https://docs.convex.dev/realtime#consistent-data-across-your-app)
- [Learn more](https://docs.convex.dev/realtime#learn-more)



[Skip to main content](https://docs.convex.dev/client/javascript#docusaurus_skipToContent_fallback)

On this page

# Convex JavaScript Clients

Convex applications can be accessed from Node.js or any JavaScript runtime that
implements [\`fetch\`](https://developer.mozilla.org/en-US/docs/Web/API/fetch) or
[\`WebSocket\`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket). The
reactive [Convex Client](https://docs.convex.dev/api/classes/browser.ConvexClient) allows web
applications and long-running Node.js servers to subscribe to updates on Convex
queries, while the [Convex HTTP client](https://docs.convex.dev/api/classes/browser.ConvexHttpClient)
is typically used for server-side rendering, migrations, administrative scripts,
and serverless functions to run queries at a single point in time.

If you're using React, see the dedicated
[\`ConvexReactClient\`](https://docs.convex.dev/api/classes/browser.ConvexClient) described in
[React](https://docs.convex.dev/client/react).

## Convex Client [​](https://docs.convex.dev/client/javascript\\#convex-client \"Direct link to Convex Client\")

The [\`ConvexClient\`](https://docs.convex.dev/api/classes/browser.ConvexClient) provides subscriptions
to queries in Node.js and any JavaScript environment that supports WebSockets.

script.ts

TS

\`\`\`codeBlockLines_zEuJ
import { ConvexClient } from \"convex/browser\";
import { api } from \"../convex/_generated/api\";

const client = new ConvexClient(process.env.CONVEX_URL!);

// subscribe to query results
client.onUpdate(api.messages.listAll, {}, (messages) =>
  console.log(messages.map((msg) => msg.body)),
);

// execute a mutation
function hello() {
  client.mutation(api.messages.sendAnon, {
    body: \`hello at ${new Date()}\`,
  });
}

\`\`\`

The Convex client is open source and available on
[GitHub](https://github.com/get-convex/convex-js).

See the [Script Tag Quickstart](https://docs.convex.dev/quickstart/script-tag) to get started.

## HTTP client [​](https://docs.convex.dev/client/javascript\\#http-client \"Direct link to HTTP client\")

The [\`ConvexHttpClient\`](https://docs.convex.dev/api/classes/browser.ConvexHttpClient) works in the
browser, Node.js, and any JavaScript environment with \`fetch\`.

See the [Node.js Quickstart](https://docs.convex.dev/quickstart/nodejs).

script.ts

TS

\`\`\`codeBlockLines_zEuJ
import { ConvexHttpClient } from \"convex/browser\";
import { api } from \"./convex/_generated/api\";

const client = new ConvexHttpClient(process.env[\"CONVEX_URL\"]);

// either this
const count = await client.query(api.counter.get);
// or this
client.query(api.counter.get).then((count) => console.log(count));

\`\`\`

## Using Convex without generated \`convex/_generated/api.js\` [​](https://docs.convex.dev/client/javascript\\#using-convex-without-generated-convex_generatedapijs \"Direct link to using-convex-without-generated-convex_generatedapijs\")

If the source code for your Convex function isn't located in the same project or
in the same monorepos you can use the untyped \`api\` object called \`anyApi\`.

script.ts

TS

\`\`\`codeBlockLines_zEuJ
import { ConvexClient } from \"convex/browser\";
import { anyApi } from \"convex/server\";

const CONVEX_URL = \"http://happy-otter-123\";
const client = new ConvexClient(CONVEX_URL);
client.onUpdate(anyApi.messages.list, {}, (messages) =>
  console.log(messages.map((msg) => msg.body)),
);
setInterval(
  () =>
    client.mutation(anyApi.messages.send, {
      body: \`hello at ${new Date()}\`,
      author: \"me\",
    }),
  5000,
);

\`\`\`

- [Convex Client](https://docs.convex.dev/client/javascript#convex-client)
- [HTTP client](https://docs.convex.dev/client/javascript#http-client)
- [Using Convex without generated \`convex/_generated/api.js\`](https://docs.convex.dev/client/javascript#using-convex-without-generated-convex_generatedapijs)



[Skip to main content](https://docs.convex.dev/functions/actions#docusaurus_skipToContent_fallback)

On this page

Actions can call third party services to do things such as processing a payment
with [Stripe](https://stripe.com/). They can be run in Convex's JavaScript
environment or in Node.js. They can interact with the database indirectly by
calling [queries](https://docs.convex.dev/functions/query-functions) and
[mutations](https://docs.convex.dev/functions/mutation-functions).

**Example:** [GIPHY Action](https://github.com/get-convex/convex-demos/tree/main/giphy-action)

## Action names [​](https://docs.convex.dev/functions/actions\\#action-names \"Direct link to Action names\")

Actions follow the same naming rules as queries, see
[Query names](https://docs.convex.dev/functions/query-functions#query-names).

## The \`action\` constructor [​](https://docs.convex.dev/functions/actions\\#the-action-constructor \"Direct link to the-action-constructor\")

To declare an action in Convex you use the action constructor function. Pass it
an object with a \`handler\` function, which performs the action:

convex/myFunctions.ts

TS

\`\`\`codeBlockLines_zEuJ
import { action } from \"./_generated/server\";

export const doSomething = action({
  handler: () => {
    // implementation goes here

    // optionally return a value
    return \"success\";
  },
});

\`\`\`

Unlike a query, an action can but does not have to return a value.

### Action arguments and responses [​](https://docs.convex.dev/functions/actions\\#action-arguments-and-responses \"Direct link to Action arguments and responses\")

Action arguments and responses follow the same rules as
[mutations](https://docs.convex.dev/functions/mutation-functions#mutation-arguments-and_responses):

convex/myFunctions.ts

TS

\`\`\`codeBlockLines_zEuJ
import { action } from \"./_generated/server\";
import { v } from \"convex/values\";

export const doSomething = action({
  args: { a: v.number(), b: v.number() },
  handler: (_, args) => {
    // do something with \`args.a\` and \`args.b\`

    // optionally return a value
    return \"success\";
  },
});

\`\`\`

The first argument to the handler function is reserved for the action context.

### Action context [​](https://docs.convex.dev/functions/actions\\#action-context \"Direct link to Action context\")

The \`action\` constructor enables interacting with the database, and other Convex
features by passing an [ActionCtx](https://docs.convex.dev/api/interfaces/server.GenericActionCtx)
object to the handler function as the first argument:

convex/myFunctions.ts

TS

\`\`\`codeBlockLines_zEuJ
import { action } from \"./_generated/server\";
import { v } from \"convex/values\";

export const doSomething = action({
  args: { a: v.number(), b: v.number() },
  handler: (ctx, args) => {
    // do something with \`ctx\`
  },
});

\`\`\`

Which part of that action context is used depends on what your action needs to
do:

- To read data from the database use the \`runQuery\` field, and call a query that
performs the read:







convex/myFunctions.ts







TS

















\`\`\`codeBlockLines_zEuJ
import { action, internalQuery } from \"./_generated/server\";
import { internal } from \"./_generated/api\";
import { v } from \"convex/values\";

export const doSomething = action({
    args: { a: v.number() },
    handler: async (ctx, args) => {
      const data = await ctx.runQuery(internal.myFunctions.readData, {
        a: args.a,
      });
      // do something with \`data\`
    },
});

export const readData = internalQuery({
    args: { a: v.number() },
    handler: async (ctx, args) => {
      // read from \`ctx.db\` here
    },
});

\`\`\`









Here \`readData\` is an [internal query](https://docs.convex.dev/functions/internal-functions)
because we don't want to expose it to the client directly. Actions, mutations
and queries can be defined in the same file.

- To write data to the database use the \`runMutation\` field, and call a mutation
that performs the write:







convex/myFunctions.ts







TS









\`\`\`codeBlockLines_zEuJ
import { v } from \"convex/values\";
import { action } from \"./_generated/server\";
import { internal } from \"./_generated/api\";

export const doSomething = action({
    args: { a: v.number() },
    handler: async (ctx, args) => {
      const data = await ctx.runMutation(internal.myMutations.writeData, {
        a: args.a,
      });
      // do something else, optionally use \`data\`
    },
});

\`\`\`









Use an [internal mutation](https://docs.convex.dev/functions/internal-functions) when you
want to prevent users from calling the mutation directly.

As with queries, it's often convenient to define actions and mutations in the
same file.

- To generate upload URLs for storing files use the \`storage\` field. Read on
about [File Storage](https://docs.convex.dev/file-storage).

- To check user authentication use the \`auth\` field. Auth is propagated
automatically when calling queries and mutations from the action. Read on
about [Authentication](https://docs.convex.dev/auth).

- To schedule functions to run in the future, use the \`scheduler\` field. Read on
about [Scheduled Functions](https://docs.convex.dev/scheduling/scheduled-functions).

- To search a vector index, use the \`vectorSearch\` field. Read on about
[Vector Search](https://docs.convex.dev/search/vector-search).


#### Dealing with circular type inference [​](https://docs.convex.dev/functions/actions\\#dealing-with-circular-type-inference \"Direct link to Dealing with circular type inference\")

Working around the TypeScript error: some action \`implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.\`

When the return value of an action depends on the result of calling
\`ctx.runQuery\` or \`ctx.runMutation\`, TypeScript will complain that it cannot
infer the return type of the action. This is a minimal example of the issue:

convex/myFunctions.ts

\`\`\`codeBlockLines_zEuJ
// TypeScript reports an error on \`myAction\`
export const myAction = action({
  args: {},
  handler: async (ctx) => {
    return await ctx.runQuery(api.myFunctions.getSomething);
  },
});

export const getSomething = query({
  args: {},
  handler: () => {
    return null;
  },
});

\`\`\`

To work around this, you should store the result of the \`ctx.runQuery\` or
\`ctx.runMutation\` call in a variable with a type annotation:

convex/myFunctions.ts

\`\`\`codeBlockLines_zEuJ
export const myAction = action({
  args: {},
  handler: async (ctx) => {
    const result: null = await ctx.runQuery(api.myFunctions.getSomething);
    return result;
  },
});

\`\`\`

TypeScript will check that the type annotation matches what the called query or
mutation returns, so you don't lose any type safety.

In this trivial example the return type of the query was \`null\`. See the
[TypeScript](https://docs.convex.dev/understanding/best-practices/typescript#type-annotating-server-side-helpers)
page for other types which might be helpful when annotating the result.

## Choosing the runtime (\"use node\") [​](https://docs.convex.dev/functions/actions\\#choosing-the-runtime-use-node \"Direct link to Choosing the runtime (\\\"use node\\\")\")

Actions can run in Convex's custom JavaScript environment or in Node.js.

By default, actions run in Convex's environment. This environment supports
\`fetch\`, so actions that simply want to call a third-party API using \`fetch\` can
be run in this environment:

convex/myFunctions.ts

TS

\`\`\`codeBlockLines_zEuJ
import { action } from \"./_generated/server\";

export const doSomething = action({
  args: {},
  handler: async () => {
    const data = await fetch(\"https://api.thirdpartyservice.com\");
    // do something with data
  },
});

\`\`\`

Actions running in Convex's environment are faster compared to Node.js, since
they don't require extra time to start up before running your action (cold
starts). They can also be defined in the same file as other Convex functions.
Like queries and mutations they can import NPM packages, but not all are
supported.

Actions needing unsupported NPM packages or Node.js APIs can be configured to
run in Node.js by adding the \`\"use node\"\` directive at the top of the file. Note
that other Convex functions cannot be defined in files with the \`\"use node\";\`
directive.

convex/myAction.ts

TS

\`\`\`codeBlockLines_zEuJ
\"use node\";

import { action } from \"./_generated/server\";
import SomeNpmPackage from \"some-npm-package\";

export const doSomething = action({
  args: {},
  handler: () => {
    // do something with SomeNpmPackage
  },
});

\`\`\`

Learn more about the two [Convex Runtimes](https://docs.convex.dev/functions/runtimes).

## Splitting up action code via helpers [​](https://docs.convex.dev/functions/actions\\#splitting-up-action-code-via-helpers \"Direct link to Splitting up action code via helpers\")

Just like with [queries](https://docs.convex.dev/functions/query-functions#splitting-up-query-code-via-helpers)
and [mutations](https://docs.convex.dev/functions/mutation-functions#splitting-up-query-code-via-helpers)
you can define and call helper

TypeScript

functions to split up the code in your actions or
reuse logic across multiple Convex functions.

But note that the [ActionCtx](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) only has
the \`auth\` field in common with
[QueryCtx](https://docs.convex.dev/generated-api/server#queryctx) and
[MutationCtx](https://docs.convex.dev/generated-api/server#mutationctx).

## Calling actions from clients [​](https://docs.convex.dev/functions/actions\\#calling-actions-from-clients \"Direct link to Calling actions from clients\")

To call an action from [React](https://docs.convex.dev/client/react) use the
[\`useAction\`](https://docs.convex.dev/api/modules/react#useaction) hook along with the generated
[\`api\`](https://docs.convex.dev/generated-api/api) object.

src/myApp.tsx

TS

\`\`\`codeBlockLines_zEuJ
import { useAction } from \"convex/react\";
import { api } from \"../convex/_generated/api\";

export function MyApp() {
  const performMyAction = useAction(api.myFunctions.doSomething);
  const handleClick = () => {
    performMyAction({ a: 1 });
  };
  // pass \`handleClick\` to a button
  // ...
}

\`\`\`

Unlike
[mutations](https://docs.convex.dev/client/react),
actions from a single client are parallelized. Each action will be executed as
soon as it reaches the server (even if other actions and mutations from the same
client are running). If your app relies on actions running after other actions
or mutations, make sure to only trigger the action after the relevant previous
function completes.

**Note:** In most cases calling an action directly from a client **is an**
**anti-pattern**. Instead, have the client call a
[mutation](https://docs.convex.dev/functions/mutation-functions) which captures the user
intent by writing into the database and then
[schedules](https://docs.convex.dev/scheduling/scheduled-functions) an action:

convex/myFunctions.ts

TS

\`\`\`codeBlockLines_zEuJ
import { v } from \"convex/values\";
import { internal } from \"./_generated/api\";
import { internalAction, mutation } from \"./_generated/server\";

export const mutationThatSchedulesAction = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const taskId = await ctx.db.insert(\"tasks\", { text });
    await ctx.scheduler.runAfter(0, internal.myFunctions.actionThatCallsAPI, {
      taskId,
      text,
    });
  },
});

export const actionThatCallsAPI = internalAction({
  args: { taskId: v.id(\"tasks\"), text: v.string() },
  handler: (_, args): void => {
    // do something with \`taskId\` and \`text\`, like call an API
    // then run another mutation to store the result
  },
});

\`\`\`

This way the mutation can enforce invariants, such as preventing the user from
executing the same action twice.

## Limits [​](https://docs.convex.dev/functions/actions\\#limits \"Direct link to Limits\")

Actions time out after 10 minutes.
[Node.js](https://docs.convex.dev/functions/runtimes#nodejs-runtime) and
[Convex runtime](https://docs.convex.dev/functions/runtimes#default-convex-runtime) have 512MB
and 64MB memory limit respectively. Please
[contact us](https://docs.convex.dev/production/contact) if you have a use case that requires
configuring higher limits.

Actions can do up to 1000 concurrent operations, such as executing queries,
mutations or performing fetch requests.

For information on other limits, see [here](https://docs.convex.dev/functions/runtimes#nodejs-runtime).

## Error handling [​](https://docs.convex.dev/functions/actions\\#error-handling \"Direct link to Error handling\")

Unlike queries and mutations, actions may have side-effects and therefore can't
be automatically retried by Convex when errors occur. For example, say your
action calls Stripe to send a customer invoice. If the HTTP request fails,
Convex has no way of knowing if the invoice was already sent. Like in normal
backend code, it is the responsibility of the caller to handle errors raised by
actions and retry the action call if appropriate.

## Dangling promises [​](https://docs.convex.dev/functions/actions\\#error-handling \"Direct link to Error handling\")

Make sure to await all promises created within an action. Async tasks still
running when the function returns might or might not complete. In addition,
since the Node.js execution environment might be reused between action calls,
dangling promises might result in errors in subsequent action invocations.

## Best practices [​](https://docs.convex.dev/functions/actions\\#dangling-promises \"Direct link to Dangling promises\")

### \`await ctx.runAction\` should only be used for crossing JS runtimes [​](https://docs.convex.dev/functions/actions\\#await-ctxrunaction-should-only-be-used-for-crossing-js-runtimes \"Direct link to await-ctxrunaction-should-only-be-used-for-crossing-js-runtimes\")

**Why?** \`await ctx.runAction\` incurs to overhead of another Convex server
function. It counts as an extra function call, it allocates it's own system
resources, and while you're awaiting this call the parent action call is frozen
holding all it's resources. If you pile enough of these calls on top of each
other, your app may slow down significantly.

**Fix:** The reason this api exists is to let you run code in the
[Node.js environment](https://docs.convex.dev/functions/runtimes). If you want to call an
action from another action that's in the same runtime, which is the normal case,
the best way to do this is to pull the code you want to call into a TypeScript
[helper function](https://docs.convex.dev/understanding/best-practices/#use-helper-functions-to-write-shared-code)
and call the helper instead.

### Avoid \`await ctx.runMutation\` / \`await ctx.runQuery\` [​](https://docs.convex.dev/functions/actions\\#avoid-await-ctxrunmutation--await-ctxrunquery \"Direct link to avoid-await-ctxrunmutation--await-ctxrunquery\")

\`\`\`codeBlockLines_zEuJ
// ❌
const foo = await ctx.runQuery(...)
const bar = await ctx.runQuery(...)

// ✅
const fooAndBar = await ctx.runQuery(...)

\`\`\`

**Why?** Multiple runQuery / runMutations execute in separate transactions and
aren't guaranteed to be consistent with each other (e.g. foo and bar could read
the same document and return two different results), while a single runQuery /
runMutation will always be consistent. Additionally, you're paying for multiple
function calls when you don't have to.

**Fix:** Make a new internal query / mutation that does both things. Refactoring
the code for the two functions into helpers will make it easy to create a new
internal function that does both things while still keeping around the original
functions. Potentially try and refactor your action code to "batch" all the
database access.

Caveats: Separate runQuery / runMutation calls are valid when intentionally
trying to process more data than fits in a single transaction (e.g. running a
migration, doing a live aggregate).

- [Action names](https://docs.convex.dev/functions/actions#action-names)
- [The \`action\` constructor](https://docs.convex.dev/functions/actions#the-action-constructor)
  - [Action arguments and responses](https://docs.convex.dev/functions/actions#action-arguments-and-responses)
  - [Action context](https://docs.convex.dev/functions/actions#action-context)
- [Choosing the runtime (\"use node\")](https://docs.convex.dev/functions/actions#choosing-the-runtime-use-node)
- [Splitting up action code via helpers](https://docs.convex.dev/functions/actions#splitting-up-action-code-via-helpers)
- [Calling actions from clients](https://docs.convex.dev/functions/actions#calling-actions-from-clients)
- [Limits](https://docs.convex.dev/functions/actions#limits)
- [Error handling](https://docs.convex.dev/functions/actions#error-handling)
- [Dangling promises](https://docs.convex.dev/functions/actions#dangling-promises)
- [Best practices](https://docs.convex.dev/functions/actions#best-practices)
  - [\`await ctx.runAction\` should only be used for crossing JS runtimes](https://docs.convex.dev/functions/actions#await-ctxrunaction-should-only-be-used-for-crossing-js-runtimes)
  - [Avoid \`await ctx.runMutation\` / \`await ctx.runQuery\`](https://docs.convex.dev/functions/actions#avoid-await-ctxrunmutation--await-ctxrunquery)



[Skip to main content](https://docs.convex.dev/home#docusaurus_skipToContent_fallback)

Convex is an all-in-one backend platform with thoughtful, product-centric
APIs.

Use [TypeScript](https://docs.convex.dev/understanding/best-practices/typescript) to write [queries as\\\\
code](https://docs.convex.dev/functions/query-functions) that are [automatically\\\\
cached](https://docs.convex.dev/realtime#automatic-caching) and [realtime](https://docs.convex.dev/realtime), with an acid
compliant [relational database](https://docs.convex.dev/database).
[**Learn Convex by creating a chat app** \\\\
\\\\
Convex provides you with a fully featured backend with cloud functions,](https://docs.convex.dev/tutorial)

## Quickstarts [​](https://docs.convex.dev/home\\#quickstarts \"Direct link to Quickstarts\")

Quickly get up and running with your favorite frontend tooling or language:

[React Logo\\\\
**React**](https://docs.convex.dev/quickstart/react) [**Next.js**](https://docs.convex.dev/quickstart/nextjs) [**Remix**](https://docs.convex.dev/quickstart/remix) [**TanStack Start**](https://docs.convex.dev/quickstart/tanstack-start) [**React Native**](https://docs.convex.dev/quickstart/react-native) [**Vue**](https://docs.convex.dev/quickstart/vue) [**Svelte**](https://docs.convex.dev/quickstart/svelte) [**Node.js**](https://docs.convex.dev/quickstart/nodejs) [Bun Logo\\\\
**Bun**](https://docs.convex.dev/quickstart/bun) [HTML5 Logo\\\\
**Script tag**](https://docs.convex.dev/quickstart/script-tag) [**Python**](https://docs.convex.dev/quickstart/python) [**iOS Swift**](https://docs.convex.dev/quickstart/swift) [**Android Kotlin**](https://docs.convex.dev/quickstart/android) [**Rust**](https://docs.convex.dev/quickstart/rust)

## Why Convex? [​](https://docs.convex.dev/home\\#why-convex \"Direct link to Why Convex?\")

## Backends Should be Designed for Product Developers

YouTube

## Intro to Convex

Supercharge your Application with a Reactive Database - YouTube

Convex

2.07K subscribers

[Supercharge your Application with a Reactive Database](https://www.youtube.com/watch?v=V6En7UO4Ui0)

Convex

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=V6En7UO4Ui0 \"Watch on YouTube\")

## Supercharging your app with a reactive backend

Why I use Convex over Supabase as my BaaS - YouTube

Web Dev Cody

246K subscribers

[Why I use Convex over Supabase as my BaaS](https://www.youtube.com/watch?v=O_HXVAMPEbc)

Web Dev Cody

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=O_HXVAMPEbc \"Watch on YouTube\")

## Why I use Convex over Supabase as my BaaS

Read the team's Perspectives on [Stack](https://stack.convex.dev/):

[**Convex vs Relational Databases**](https://stack.convex.dev/convex-vs-relational-databases) [**Convex vs Firebase**](https://stack.convex.dev/convex-vs-firebase) [**It's not you, it's SQL**](https://stack.convex.dev/not-sql) [**How Convex Works**](https://stack.convex.dev/how-convex-works) [**The Software-Defined Database**](https://stack.convex.dev/the-software-defined-database) [**Convex Perspectives**](https://stack.convex.dev/tag/Perspectives)

## Learn Convex [​](https://docs.convex.dev/home\\#learn-convex \"Direct link to Learn Convex\")

A quick start guide for using Convex with Next.js - YouTube

Web Dev Cody

246K subscribers

[A quick start guide for using Convex with Next.js](https://www.youtube.com/watch?v=vaQZYRSiimI)

Web Dev Cody

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=vaQZYRSiimI \"Watch on YouTube\")

## A quick start guide for using Convex with Next.js

Fullstack Notion Clone: Next.js 13, React, Convex, Tailwind \\| Full Course 2023 - YouTube

Code With Antonio

371K subscribers

[Fullstack Notion Clone: Next.js 13, React, Convex, Tailwind \\| Full Course 2023](https://www.youtube.com/watch?v=0OaDyjB9Ib8)

Code With Antonio

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=0OaDyjB9Ib8 \"Watch on YouTube\")

## Fullstack Notion Clone: Next.js 13, React, Convex, Tailwind

Build and Deploy a Saas Podcast Platform in Next.js - YouTube

JavaScript Mastery

1.03M subscribers

[Build and Deploy a Saas Podcast Platform in Next.js](https://www.youtube.com/watch?v=zfAb95tJvZQ)

JavaScript Mastery

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=zfAb95tJvZQ \"Watch on YouTube\")

## Build and Deploy a Saas Podcast Platform in Next.js

Building a Subscription Based SaaS with my Favorite Tech Stack (Next.js, Stripe, Convex, Clerk) - YouTube

Web Dev Cody

246K subscribers

[Building a Subscription Based SaaS with my Favorite Tech Stack (Next.js, Stripe, Convex, Clerk)](https://www.youtube.com/watch?v=Vjtn9pWAZDI)

Web Dev Cody

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

0:00

/ •Live

•

[Watch on YouTube](https://www.youtube.com/watch?v=Vjtn9pWAZDI \"Watch on YouTube\")

## Building a Subscription Based SaaS with Stripe

See more walkthroughs and patterns on [Stack](https://stack.convex.dev/)

[**Build AI Apps**](https://stack.convex.dev/tag/AI) [**Convex Patterns**](https://stack.convex.dev/tag/Patterns) [**Convex Walkthroughs**](https://stack.convex.dev/tag/Walkthroughs)

reCAPTCHA

Recaptcha requires verification.

[Privacy](https://www.google.com/intl/en/policies/privacy/) \\- [Terms](https://www.google.com/intl/en/policies/terms/)

protected by **reCAPTCHA**

[Privacy](https://www.google.com/intl/en/policies/privacy/) \\- [Terms](https://www.google.com/intl/en/policies/terms/)[Skip to main content](https://docs.convex.dev/understanding/best-practices#docusaurus_skipToContent_fallback)

On this page

This is a list of best practices and common anti-patterns around using Convex.
We recommend going through this list before broadly releasing your app to
production. You may choose to try using all of these best practices from the
start, or you may wait until you've gotten major parts of your app working
before going through and adopting the best practices here.

## Await all Promises [​](https://docs.convex.dev/understanding/best-practices\\#await-all-promises \"Direct link to Await all Promises\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why \"Direct link to Why?\")

Convex functions use async / await. If you don't await all your promises (e.g.
\`await ctx.scheduler.runAfter\`, \`await ctx.db.patch\`), you may run into
unexpected behavior (e.g. failing to schedule a function) or miss handling
errors.

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how \"Direct link to How?\")

We recommend the
[no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/)
eslint rule with TypeScript.

## Avoid \`.filter\` on database queries [​](https://docs.convex.dev/understanding/best-practices\\#avoid-filter-on-database-queries \"Direct link to avoid-filter-on-database-queries\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-1 \"Direct link to Why?\")

Filtering in code instead of using the \`.filter\` syntax has the same
performance, and is generally easier code to write. Conditions in \`.withIndex\`
or \`.withSearchIndex\` are more efficient than \`.filter\` or filtering in code, so
almost all uses of \`.filter\` should either be replaced with a \`.withIndex\` or
\`.withSearchIndex\` condition, or written as TypeScript code.

Read through the
[indexes documentation](https://docs.convex.dev/database/reading-data/indexes/indexes-and-query-perf)
for an overview of how to define indexes and how they work.

### Examples [​](https://docs.convex.dev/understanding/best-practices\\#examples \"Direct link to Examples\")

convex/messages.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌
const tomsMessages = ctx.db
  .query(\"messages\")
  .filter((q) => q.eq(q.field(\"author\"), \"Tom\"))
  .collect();

// ✅
// Option 1: Use an index
const tomsMessages = await ctx.db
  .query(\"messages\")
  .withIndex(\"by_author\", (q) => q.eq(\"author\", \"Tom\"))
  .collect();

// Option 2: Filter in code
const allMessages = await ctx.db.query(\"messages\").collect();
const tomsMessages = allMessages.filter((m) => m.author === \"Tom\");

\`\`\`

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-1 \"Direct link to How?\")

Search for \`.filter\` in your Convex codebase — a regex like \`\\.filter\\(\\(?q\`
will probably find all the ones on database queries.

Decide whether they should be replaced with a \`.withIndex\` condition — per
[this section](https://docs.convex.dev/understanding/best-practices/#only-use-collect-with-a-small-number-of-results),
if you are filtering over a large (1000+) or potentially unbounded number of
documents, you should use an index. If not using a \`.withIndex\` /
\`.withSearchIndex\` condition, consider replacing them with a filter in code for
more readability and flexibility.

See [this article](https://stack.convex.dev/complex-filters-in-convex) for more
strategies for filtering.

### Exceptions [​](https://docs.convex.dev/understanding/best-practices\\#exceptions \"Direct link to Exceptions\")

Using \`.filter\` on a paginated query ( \`.paginate\`) has advantages over filtering
in code. The paginated query will return the number of documents requested,
including the \`.filter\` condition, so filtering in code afterwards can result in
a smaller page or even an empty page. Using \`.withIndex\` on a paginated query
will still be more efficient than a \`.filter\`.

## Only use \`.collect\` with a small number of results [​](https://docs.convex.dev/understanding/best-practices\\#only-use-collect-with-a-small-number-of-results \"Direct link to only-use-collect-with-a-small-number-of-results\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-2 \"Direct link to Why?\")

All results returned from \`.collect\` count towards database bandwidth (even ones
filtered out by \`.filter\`). It also means that if any document in the result
changes, the query will re-run or the mutation will hit a conflict.

If there's a chance the number of results is large (say 1000+ documents), you
should use an index to filter the results further before calling \`.collect\`, or
find some other way to avoid loading all the documents such as using pagination,
denormalizing data, or changing the product feature.

### Example [​](https://docs.convex.dev/understanding/best-practices\\#example \"Direct link to Example\")

**Using an index:**

convex/movies.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- potentially unbounded
const allMovies = await ctx.db.query(\"movies\").collect();
const moviesByDirector = allMovies.filter(
  (m) => m.director === \"Steven Spielberg\",
);

// ✅ -- small number of results, so \`collect\` is fine
const moviesByDirector = await ctx.db
  .query(\"movies\")
  .withIndex(\"by_director\", (q) => q.eq(\"director\", \"Steven Spielberg\"))
  .collect();

\`\`\`

**Using pagination:**

convex/movies.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- potentially unbounded
const watchedMovies = await ctx.db
  .query(\"watchedMovies\")
  .withIndex(\"by_user\", (q) => q.eq(\"user\", \"Tom\"))
  .collect();

// ✅ -- using pagination, showing recently watched movies first
const watchedMovies = await ctx.db
  .query(\"watchedMovies\")
  .withIndex(\"by_user\", (q) => q.eq(\"user\", \"Tom\"))
  .order(\"desc\")
  .paginate(paginationOptions);

\`\`\`

**Using a limit or denormalizing:**

convex/movies.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- potentially unbounded
const watchedMovies = await ctx.db
  .query(\"watchedMovies\")
  .withIndex(\"by_user\", (q) => q.eq(\"user\", \"Tom\"))
  .collect();
const numberOfWatchedMovies = watchedMovies.length;

// ✅ -- Show \"99+\" instead of needing to load all documents
const watchedMovies = await ctx.db
  .query(\"watchedMovies\")
  .withIndex(\"by_user\", (q) => q.eq(\"user\", \"Tom\"))
  .take(100);
const numberOfWatchedMovies =
  watchedMovies.length === 100 ? \"99+\" : watchedMovies.length.toString();

// ✅ -- Denormalize the number of watched movies in a separate table
const watchedMoviesCount = await ctx.db
  .query(\"watchedMoviesCount\")
  .withIndex(\"by_user\", (q) => q.eq(\"user\", \"Tom\"))
  .unique();

\`\`\`

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-2 \"Direct link to How?\")

Search for \`.collect\` in your Convex codebase (a regex like \`\\.collect\\(\` will
probably find these). And think through whether the number of results is small.
This function health page in the dashboard can also help surface these.

The [aggregate component](https://www.npmjs.com/package/@convex-dev/aggregate)
or [database triggers](https://stack.convex.dev/triggers) can be helpful
patterns for denormalizing data.

### Exceptions [​](https://docs.convex.dev/understanding/best-practices\\#exceptions-1 \"Direct link to Exceptions\")

If you're doing something that requires loading a large number of documents
(e.g. performing a migration, making a summary), you may want to use an action
to load them in batches via separate queries / mutations.

## Check for redundant indexes [​](https://docs.convex.dev/understanding/best-practices\\#check-for-redundant-indexes \"Direct link to Check for redundant indexes\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-3 \"Direct link to Why?\")

Indexes like \`by_foo\` and \`by_foo_and_bar\` are usually redundant (you only need
\`by_foo_and_bar\`). Reducing the number of indexes saves on database storage and
reduces the overhead of writing to the table.

convex/teams.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌
const allTeamMembers = await ctx.db
  .query(\"teamMembers\")
  .withIndex(\"by_team\", (q) => q.eq(\"team\", teamId))
  .collect();
const currentUserId = /* get current user id from \`ctx.auth\` */
const currentTeamMember = await ctx.db
  .query(\"teamMembers\")
  .withIndex(\"by_team_and_user\", (q) =>
    q.eq(\"team\", teamId).eq(\"user\", currentUserId),
  )
  .unique();

// ✅
// Just don't include a condition on \`user\` when querying for results on \`team\`
const allTeamMembers = await ctx.db
  .query(\"teamMembers\")
  .withIndex(\"by_team_and_user\", (q) => q.eq(\"team\", teamId))
  .collect();
const currentUserId = /* get current user id from \`ctx.auth\` */
const currentTeamMember = await ctx.db
  .query(\"teamMembers\")
  .withIndex(\"by_team_and_user\", (q) =>
    q.eq(\"team\", teamId).eq(\"user\", currentUserId),
  )
  .unique();

\`\`\`

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-3 \"Direct link to How?\")

Look through your indexes, either in your \`schema.ts\` file or in the dashboard,
and look for any indexes where one is a prefix of another.

### Exceptions [​](https://docs.convex.dev/understanding/best-practices\\#exceptions-2 \"Direct link to Exceptions\")

\`.index(\"by_foo\", [\"foo\"])\` is really an index on the properties \`foo\` and
\`_creationTime\`, while \`.index(\"by_foo_and_bar\", [\"foo\", \"bar\"])\` is an index on
the properties \`foo\`, \`bar\`, and \`_creationTime\`. If you have queries that need
to be sorted by \`foo\` and then \`_creationTime\`, then you need both indexes.

For example, \`.index(\"by_channel\", [\"channel\"])\` on a table of messages can be
used to query for the most recent messages in a channel, but
\`.index(\"by_channel_and_author\", [\"channel\", \"author\"])\` could not be used for
this since it would first sort the messages by \`author\`.

## Use argument validators for all public functions [​](https://docs.convex.dev/understanding/best-practices\\#use-argument-validators-for-all-public-functions \"Direct link to Use argument validators for all public functions\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-4 \"Direct link to Why?\")

Public functions can be called by anyone, including potentially malicious
attackers trying to break your app.
[Argument validators](https://docs.convex.dev/functions/validation) (as well as return value
validators) help ensure you're getting the traffic you expect.

### Example [​](https://docs.convex.dev/understanding/best-practices\\#example-1 \"Direct link to Example\")

convex/messages.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- could be used to update any document (not just \`messages\`)
export const updateMessage = mutation({
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the \`body\` and \`author\` fields
export const updateMessage = mutation({
  args: {
    id: v.id(\"messages\"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

\`\`\`

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-4 \"Direct link to How?\")

Search for \`query\`, \`mutation\`, and \`action\` in your Convex codebase, and ensure
that all of them have argument validators (and optionally return value
validators). If you have \`httpAction\` s, you may want to use something like \`zod\`
to validate that the HTTP request is the shape you expect.

## Use some form of access control for all public functions [​](https://docs.convex.dev/understanding/best-practices\\#use-some-form-of-access-control-for-all-public-functions \"Direct link to Use some form of access control for all public functions\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-5 \"Direct link to Why?\")

Public functions can be called by anyone, including potentially malicious
attackers trying to break your app. If portions of your app should only be
accessible when the user is signed in, make sure all these Convex functions
check that \`ctx.auth.getUserIdentity()\` is set.

You may also have specific checks, like only loading messages that were sent to
or from the current user, which you'll want to apply in every relevant public
function.

Favoring more granular functions like \`setTeamOwner\` over \`updateTeam\` allows
more granular checks for which users can do what.

Access control checks should either use \`ctx.auth.getUserIdentity()\` or a
function argument that is unguessable (e.g. a UUID, or a Convex ID, provided
that this ID is never exposed to any client but the one user). In particular,
don't use a function argument which could be spoofed (e.g. email) for access
control checks.

### Example [​](https://docs.convex.dev/understanding/best-practices\\#example-2 \"Direct link to Example\")

convex/teams.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam = mutation({
  args: {
    id: v.id(\"teams\"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id(\"users\")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses \`email\` which could be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id(\"teams\"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id(\"users\")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error(\"Unauthorized\");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses \`ctx.auth\`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id(\"teams\"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id(\"users\")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error(\"Unauthorized\");
    }
    const isTeamMember = /* check if user is a member of the team */
    if (!isTeamMember) {
      throw new Error(\"Unauthorized\");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id(\"teams\"),
    owner: v.id(\"users\"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error(\"Unauthorized\");
    }
    const isTeamOwner = /* check if user is the owner of the team */
    if (!isTeamOwner) {
      throw new Error(\"Unauthorized\");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id(\"teams\"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error(\"Unauthorized\");
    }
    const isTeamMember = /* check if user is a member of the team */
    if (!isTeamMember) {
      throw new Error(\"Unauthorized\");
    }
    await ctx.db.patch(id, { name: name });
  },
});

\`\`\`

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-5 \"Direct link to How?\")

Search for \`query\`, \`mutation\`, \`action\`, and \`httpAction\` in your Convex
codebase, and ensure that all of them have some form of access control.
[Custom functions](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#custom-functions)
like
[\`authenticatedQuery\`](https://stack.convex.dev/custom-functions#modifying-the-ctx-argument-to-a-server-function-for-user-auth)
can be helpful.

Some apps use Row Level Security (RLS) to check access to each document
automatically whenever it's loaded, as described in
[this article](https://stack.convex.dev/row-level-security). Alternatively, you
can check access in each Convex function instead of checking access for each
document.

Helper functions for common checks and common operations can also be useful --
e.g. \`isTeamMember\`, \`isTeamAdmin\`, \`loadTeam\` (which throws if the current user
does not have access to the team).

## Only schedule and \`ctx.run*\` internal functions [​](https://docs.convex.dev/understanding/best-practices\\#only-schedule-and-ctxrun-internal-functions \"Direct link to only-schedule-and-ctxrun-internal-functions\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-6 \"Direct link to Why?\")

Public functions can be called by anyone, including potentially malicious
attackers trying to break your app, and should be carefully audited to ensure
they can't be used maliciously. Functions that are only called within Convex can
be marked as internal, and relax these checks since Convex will ensure that
internal functions can only be called within Convex.

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-6 \"Direct link to How?\")

Search for \`ctx.runQuery\`, \`ctx.runMutation\`, and \`ctx.runAction\` in your Convex
codebase. Also search for \`ctx.scheduler\` and check the \`crons.ts\` file. Ensure
all of these use \`internal.foo.bar\` functions instead of \`api.foo.bar\`
functions.

If you have code you want to share between a public Convex function and an
internal Convex function, create a helper function that can be called from both.
The public function will likely have additional access control checks.

Alternatively, make sure that \`api\` from \`_generated/api.ts\` is never used in
your Convex functions directory.

### Examples [​](https://docs.convex.dev/understanding/best-practices\\#examples-1 \"Direct link to Examples\")

convex/teams.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- using \`api\`
export const sendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  \"send daily reminder\",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: \"System\", body: \"Share your daily update!\" },
);

// ✅ Using \`internal\`
import { MutationCtx } from './_generated/server';
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error(\"Unauthorized\");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? \"Anonymous\" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about \`author\` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  \"send daily reminder\",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: \"System\", body: \"Share your daily update!\" },
);

\`\`\`

## Use helper functions to write shared code [​](https://docs.convex.dev/understanding/best-practices\\#use-helper-functions-to-write-shared-code \"Direct link to Use helper functions to write shared code\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-7 \"Direct link to Why?\")

Most logic should be written as plain TypeScript functions, with the \`query\`,
\`mutation\`, and \`action\` wrapper functions being a thin wrapper around one or
more helper function.

Concretely, most of your code should live in a directory like \`convex/model\`,
and your public API, which is defined with \`query\`, \`mutation\`, and \`action\`,
should have very short functions that mostly just call into \`convex/model\`.

Organizing your code this way makes several of the refactors mentioned in this
list easier to do.

See the [TypeScript page](https://docs.convex.dev/understanding/best-practices/typescript) for
useful types.

### Example [​](https://docs.convex.dev/understanding/best-practices\\#example-3 \"Direct link to Example\")

**❌** This example overuses \`ctx.runQuery\` and \`ctx.runMutation\`, which is
discussed more in the
[Avoid sequential \`ctx.runMutation\` / \`ctx.runQuery\` from actions](https://docs.convex.dev/understanding/best-practices/#avoid-sequential-ctx-runmutation-ctx-runquery-from-actions)
section.

convex/users.ts

TS

\`\`\`codeBlockLines_zEuJ
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new Error(\"Unauthorized\");
    }
    const user = /* query ctx.db to load the user */
    const userSettings = /* load other documents related to the user */
    return { user, settings: userSettings };
  },
});

\`\`\`

convex/conversations.ts

TS

\`\`\`codeBlockLines_zEuJ
export const listMessages = query({
  args: {
    conversationId: v.id(\"conversations\"),
  },
  handler: async (ctx, { conversationId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null || !conversation.members.includes(user._id)) {
      throw new Error(\"Unauthorized\");
    }
    const messages = /* query ctx.db to load the messages */
    return messages;
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id(\"conversations\"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    });
    const summary = /* call some external service to summarize the conversation */
    await ctx.runMutation(api.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});

\`\`\`

**✅** Most of the code here is now in the \`convex/model\` directory. The API for
this application is in \`convex/conversations.ts\`, which contains very little
code itself.

convex/model/users.ts

TS

\`\`\`codeBlockLines_zEuJ
import { QueryCtx } from '../_generated/server';

export async function getCurrentUser(ctx: QueryCtx) {
  const userIdentity = await ctx.auth.getUserIdentity();
  if (userIdentity === null) {
    throw new Error(\"Unauthorized\");
  }
  const user = /* query ctx.db to load the user */
  const userSettings = /* load other documents related to the user */
  return { user, settings: userSettings };
}

\`\`\`

convex/model/conversations.ts

TS

\`\`\`codeBlockLines_zEuJ
import { QueryCtx, MutationCtx } from '../_generated/server';
import * as Users from './users';

export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<\"conversations\"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error(\"Unauthorized\");
  }
  return conversation;
}

export async function listMessages(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<\"conversations\"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */
  return messages;
}

export async function addSummary(
  ctx: MutationCtx,
  {
    conversationId,
    summary,
  }: { conversationId: Id<\"conversations\">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch(conversationId, { summary });
}

export async function generateSummary(
  messages: Doc<\"messages\">[],
  conversationId: Id<\"conversations\">,
) {
  const summary = /* call some external service to summarize the conversation */
  return summary;
}

\`\`\`

convex/conversations.ts

TS

\`\`\`codeBlockLines_zEuJ
import * as Conversations from './model/conversations';

export const addSummary = internalMutation({
  args: {
    conversationId: v.id(\"conversations\"),
    summary: v.string(),
  },
  handler: async (ctx, { conversationId, summary }) => {
    await Conversations.addSummary(ctx, { conversationId, summary });
  },
});

export const listMessages = internalQuery({
  args: {
    conversationId: v.id(\"conversations\"),
  },
  handler: async (ctx, { conversationId }) => {
    return Conversations.listMessages(ctx, { conversationId });
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id(\"conversations\"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(internal.conversations.listMessages, {
      conversationId,
    });
    const summary = await Conversations.generateSummary(
      messages,
      conversationId,
    );
    await ctx.runMutation(internal.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});

\`\`\`

## Use \`runAction\` only when using a different runtime [​](https://docs.convex.dev/understanding/best-practices\\#use-runaction-only-when-using-a-different-runtime \"Direct link to use-runaction-only-when-using-a-different-runtime\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-8 \"Direct link to Why?\")

Calling \`runAction\` has more overhead than calling a plain TypeScript function.
It counts as an extra function call with its own memory and CPU usage, while the
parent action is doing nothing except waiting for the result. Therefore,
\`runAction\` should almost always be replaced with calling a plain TypeScript
function. However, if you want to call code that requires Node.js from a
function in the Convex runtime (e.g. using a library that requires Node.js),
then you can use \`runAction\` to call the Node.js code.

### Example [​](https://docs.convex.dev/understanding/best-practices\\#example-4 \"Direct link to Example\")

convex/scrape.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- using \`runAction\`
export const scrapeWebsite = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});

\`\`\`

convex/model/scrape.ts

TS

\`\`\`codeBlockLines_zEuJ
import { ActionCtx } from '../_generated/server';

// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}

\`\`\`

convex/scrape.ts

TS

\`\`\`codeBlockLines_zEuJ
import * as Scrape from './model/scrape';

export const scrapeWebsite = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});

\`\`\`

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-7 \"Direct link to How?\")

Search for \`runAction\` in your Convex codebase, and see if the function it calls
uses the same runtime as the parent function. If so, replace the \`runAction\`
with a plain TypeScript function. You may want to structure your functions so
the Node.js functions are in a separate directory so it's easier to spot these.

## Avoid sequential \`ctx.runMutation\` / \`ctx.runQuery\` calls from actions [​](https://docs.convex.dev/understanding/best-practices\\#avoid-sequential-ctxrunmutation--ctxrunquery-calls-from-actions \"Direct link to avoid-sequential-ctxrunmutation--ctxrunquery-calls-from-actions\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-9 \"Direct link to Why?\")

Each \`ctx.runMutation\` or \`ctx.runQuery\` runs in its own transaction, which
means if they're called separately, they may not be consistent with each other.
If instead we call a single \`ctx.runQuery\` or \`ctx.runMutation\`, we're
guaranteed that the results we get are consistent.

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-8 \"Direct link to How?\")

Audit your calls to \`ctx.runQuery\` and \`ctx.runMutation\` in actions. If you see
multiple in a row with no other code between them, replace them with a single
\`ctx.runQuery\` or \`ctx.runMutation\` that handles both things. Refactoring your
code to use helper functions will make this easier.

### Example: Queries [​](https://docs.convex.dev/understanding/best-practices\\#example-queries \"Direct link to Example: Queries\")

convex/teams.ts

TS

\`\`\`codeBlockLines_zEuJ
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);

\`\`\`

convex/teams.ts

TS

\`\`\`codeBlockLines_zEuJ
import * as Teams from './model/teams';
import * as Users from './model/users';

export const sendBillingReminder = action({
  args: {
    teamId: v.id(\"teams\"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id(\"teams\"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});

\`\`\`

### Example: Loops [​](https://docs.convex.dev/understanding/best-practices\\#example-loops \"Direct link to Example: Loops\")

convex/teams.ts

TS

\`\`\`codeBlockLines_zEuJ
import * as Users from './model/users';

export const importTeams = action({
  args: {
    teamId: v.id(\"teams\"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});

\`\`\`

convex/teams.ts

TS

\`\`\`codeBlockLines_zEuJ
import * as Users from './model/users';

export const importTeams = action({
  args: {
    teamId: v.id(\"teams\"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});

\`\`\`

### Exceptions [​](https://docs.convex.dev/understanding/best-practices\\#exceptions-3 \"Direct link to Exceptions\")

If you're intentionally trying to process more data than fits in a single
transaction, like running a migration or aggregating data, then it makes sense
to have multiple sequential \`ctx.runMutation\` / \`ctx.runQuery\` calls.

Multiple \`ctx.runQuery\` / \`ctx.runMutation\` calls are often necessary because
the action does a side effect in between them. For example, reading some data,
feeding it to an external service, and then writing the result back to the
database.

## Use \`ctx.runQuery\` and \`ctx.runMutation\` sparingly in queries and mutations [​](https://docs.convex.dev/understanding/best-practices\\#use-ctxrunquery-and-ctxrunmutation-sparingly-in-queries-and-mutations \"Direct link to use-ctxrunquery-and-ctxrunmutation-sparingly-in-queries-and-mutations\")

### Why? [​](https://docs.convex.dev/understanding/best-practices\\#why-10 \"Direct link to Why?\")

While these queries and mutations run in the same transaction, and will give
consistent results, they have extra overhead compared to plain TypeScript
functions. Wanting a TypeScript helper function is much more common than needing
\`ctx.runQuery\` or \`ctx.runMutation\`.

### How? [​](https://docs.convex.dev/understanding/best-practices\\#how-9 \"Direct link to How?\")

Audit your calls to \`ctx.runQuery\` and \`ctx.runMutation\` in queries and
mutations. Unless one of the exceptions below applies, replace them with a plain
TypeScript function.

### Exceptions [​](https://docs.convex.dev/understanding/best-practices\\#exceptions-4 \"Direct link to Exceptions\")

- If you're using components, these require \`ctx.runQuery\` or \`ctx.runMutation\`.
- If you want partial rollback on an error, you will want \`ctx.runMutation\`
instead of a plain TypeScript function.

convex/messages.ts

TS

\`\`\`codeBlockLines_zEuJ
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (error) {
      // Record the failure, but rollback any writes from \`sendMessage\`
      await ctx.db.insert(\"failures\", {
        kind: \"MessageFailed\",
        body,
        author,
        error: \`Error: \${error}\`,
      });
    }
  },
});

\`\`\`

- [Await all Promises](https://docs.convex.dev/understanding/best-practices#await-all-promises)
- [Avoid \`.filter\` on database queries](https://docs.convex.dev/understanding/best-practices#avoid-filter-on-database-queries)
- [Only use \`.collect\` with a small number of results](https://docs.convex.dev/understanding/best-practices#only-use-collect-with-a-small-number-of-results)
- [Check for redundant indexes](https://docs.convex.dev/understanding/best-practices#check-for-redundant-indexes)
- [Use argument validators for all public functions](https://docs.convex.dev/understanding/best-practices#use-argument-validators-for-all-public-functions)
- [Use some form of access control for all public functions](https://docs.convex.dev/understanding/best-practices#use-some-form-of-access-control-for-all-public-functions)
- [Only schedule and \`ctx.run*\` internal functions](https://docs.convex.dev/understanding/best-practices#only-schedule-and-ctxrun-internal-functions)
- [Use helper functions to write shared code](https://docs.convex.dev/understanding/best-practices#use-helper-functions-to-write-shared-code)
- [Use \`runAction\` only when using a different runtime](https://docs.convex.dev/understanding/best-practices#use-runaction-only-when-using-a-different-runtime)
- [Avoid sequential \`ctx.runMutation\` / \`ctx.runQuery\` calls from actions](https://docs.convex.dev/understanding/best-practices#avoid-sequential-ctxrunmutation--ctxrunquery-calls-from-actions)
- [Use \`ctx.runQuery\` and \`ctx.runMutation\` sparingly in queries and mutations](https://docs.convex.dev/understanding/best-practices#use-ctxrunquery-and-ctxrunmutation-sparingly-in-queries-and-mutations)



[Skip to main content](https://docs.convex.dev/client/android#docusaurus_skipToContent_fallback)

On this page

Convex Android client library enables your Android application to interact with
your Convex backend. It allows your frontend code to:

1. Call
your [queries](https://docs.convex.dev/functions/query-functions), [mutations](https://docs.convex.dev/functions/mutation-functions) and [actions](https://docs.convex.dev/functions/actions)
2. Authenticate users using [Auth0](https://docs.convex.dev/auth/auth0)

The library is open source and
[available on GitHub](https://github.com/get-convex/convex-mobile/tree/main/android).

Follow the [Android Quickstart](https://docs.convex.dev/quickstart/android) to get started.

## Installation [​](https://docs.convex.dev/client/android\\#installation \"Direct link to Installation\")

You'll need to make the following changes to your app's \`build.gradle[.kts]\`
file.

\`\`\`codeBlockLines_zEuJ
plugins {
    // ... existing plugins
    kotlin(\"plugin.serialization\") version \"1.9.0\"
}

dependencies {
    // ... existing dependencies
    implementation(\"dev.convex:android-convexmobile:0.4.1@aar\") {
        isTransitive = true
    }
    implementation(\"org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3\")
}

\`\`\`

After that, sync Gradle to pick up those changes. Your app will now have access
to the Convex for Android library as well as Kotlin's JSON serialization which
is used to communicate between your code and the Convex backend.

## Connecting to a backend [​](https://docs.convex.dev/client/android\\#connecting-to-a-backend \"Direct link to Connecting to a backend\")

The \`ConvexClient\` is used to establish and maintain a connect between your
application and the Convex backend. First you need to create an instance of the
client by giving it your backend deployment URL:

\`\`\`codeBlockLines_zEuJ
package com.example.convexapp

import dev.convex.android.ConvexClient

val convex = ConvexClient(\"https://<your domain here>.convex.cloud\")

\`\`\`

You should create and use one instance of the \`ConvexClient\` for the lifetime of
your application process. It can be convenient to create a custom Android
[\`Application\`](https://developer.android.com/reference/android/app/Application)
subclass and initialize it there:

\`\`\`codeBlockLines_zEuJ
package com.example.convexapp

import android.app.Application
import dev.convex.android.ConvexClient

class MyApplication : Application() {
    lateinit var convex: ConvexClient

    override fun onCreate() {
        super.onCreate()
        convex = ConvexClient(\"https://<your domain here>.convex.cloud\")
    }
}

\`\`\`

Once you've done that, you can access the client from a Jetpack Compose
\`@Composable\` function like this:

\`\`\`codeBlockLines_zEuJ
val convex = (application as MyApplication).convex

\`\`\`

## Fetching data [​](https://docs.convex.dev/client/android\\#fetching-data \"Direct link to Fetching data\")

Convex for Android gives you access to the Convex
[reactor](https://docs.convex.dev/tutorial/reactor), which enables real-time
_subscriptions_ to query results. You subscribe to queries with the \`subscribe\`
method on \`ConvexClient\` which returns a \`Flow\`. The contents of the \`Flow\` will
change over time as the underlying data backing the query changes.

All methods on \`ConvexClient\` suspend, and need to be called from a
\`CoroutineScope\` or another \`suspend\` function. A simple way to consume a query
that returns a list of strings from a \`@Composable\` is to use a combination of
mutable state containing a list and \`LaunchedEffect\`:

\`\`\`codeBlockLines_zEuJ
var workouts: List<String> by remember { mutableStateOf(listOf()) }
LaunchedEffect(\"onLaunch\") {
    client.subscribe<List<String>>(\"workouts:get\").collect { result ->
        result.onSuccess { receivedWorkouts ->
            workouts = receivedWorkouts
        }
    }
}

\`\`\`

Any time the data that powers the backend \`\"workouts:get\"\` query changes, a new
\`Result<List<String>>\` will be emitted into the \`Flow\` and the \`workouts\` list
will refresh with the new data. Any UI that uses \`workouts\` will then rebuild,
giving you a fully reactive UI.

Note: you may prefer to put the subscription logic wrapped a Repository as
described in the
[Android architecture patterns](https://developer.android.com/topic/architecture/data-layer).

### Query arguments [​](https://docs.convex.dev/client/android\\#query-arguments \"Direct link to Query arguments\")

You can pass arguments to \`subscribe\` and they will be supplied to the
associated backend \`query\` function. The arguments are typed as
\`Map<String, Any?>\`. The values in the map must be primitive values or other
maps and lists.

\`\`\`codeBlockLines_zEuJ
val favoriteColors = mapOf(\"favoriteColors\" to listOf(\"blue\", \"red\"))
client.subscribe<List<String>>(\"users:list\", args = favoriteColors)

\`\`\`

Assuming a backend query that accepts a \`favoriteColors\` argument, the value can
be received and used to perform logic in the query function.

tip

Use serializable [Kotlin Data classes](https://docs.convex.dev/client/android/data-types#custom-data-types)
to automatically convert Convex objects to Kotlin model classes.

caution

- There are important gotchas when
[sending and receiving numbers](https://docs.convex.dev/client/android/data-types#numerical-types)
between Kotlin and Convex.
- \`_\` is a used to signify private fields in Kotlin. If you want to use a
\`_creationTime\` and \`_id\` Convex fields directly without warnings you'll have
to
[convert the field name in Kotlin](https://docs.convex.dev/client/android/data-types#field-name-conversion).
- Depending on your backend functions, you may need to deal with
[reserved Kotlin keywords](https://docs.convex.dev/client/android/data-types#field-name-conversion).

### Subscription lifetime [​](https://docs.convex.dev/client/android\\#subscription-lifetime \"Direct link to Subscription lifetime\")

The \`Flow\` returned from \`subscribe\` will persist as long as something is
waiting to consume results from it. When a \`@Composable\` or \`ViewModel\` with a
subscription goes out of scope, the underlying query subscription to Convex will
be canceled.

## Editing data [​](https://docs.convex.dev/client/android\\#editing-data \"Direct link to Editing data\")

You can use the \`mutation\` method on \`ConvexClient\` to trigger a backend
[mutation](https://docs.convex.dev/functions/mutation-functions).

You'll need to use it in another \`suspend\` function or a \`CoroutineScope\`.
Mutations can return a value or not. If you expect a type in the response,
indicate it in the call signature.

Mutations can also receive arguments, just like queries. Here's an example of
returning a type from a mutation with arguments:

\`\`\`codeBlockLines_zEuJ
val recordsDeleted = convex.mutation<@ConvexNum Int>(
  \"messages:cleanup\",
  args = mapOf(\"keepLatest\" to 100)
)

\`\`\`

If an error occurs during a call to \`mutation\`, it will throw an exception.
Typically you may want to catch
[\`ConvexError\`](https://docs.convex.dev/functions/error-handling/application-errors)
and \`ServerError\` and handle them however is appropriate in your application.
See documentation on
[error handling](https://docs.convex.dev/functions/error-handling/) for more
details.

## Calling third-party APIs [​](https://docs.convex.dev/client/android\\#calling-third-party-apis \"Direct link to Calling third-party APIs\")

You can use the \`action\` method on \`ConvexClient\` to trigger a backend
[action](https://docs.convex.dev/functions/actions).

Calls to \`action\` can accept arguments, return values and throw exceptions just
like calls to \`mutation\`.

Even though you can call actions from Android, it's not always the right choice.
See the action docs for tips on
[calling actions from clients](https://docs.convex.dev/functions/actions#calling-actions-from-clients).

## Authentication with Auth0 [​](https://docs.convex.dev/client/android\\#authentication-with-auth0 \"Direct link to Authentication with Auth0\")

You can use \`ConvexClientWithAuth\` in place of \`ConvexClient\` to configure
authentication with [Auth0](https://auth0.com/). You'll need the
\`convex-android-auth0\` library to do that, as well as an Auth0 account and
application configuration.

See the
[README](https://github.com/get-convex/convex-android-auth0/blob/main/README.md)
in the \`convex-android-auth0\` repo for more detailed setup instructions, and the
[Workout example app](https://github.com/get-convex/android-convex-workout)
which is configured for Auth0. The overall
[Convex authentication docs](https://docs.convex.dev/auth) are a good resource
as well.

It should also be possible to integrate other similar OpenID Connect
authentication providers. See the
[\`AuthProvider\`](https://github.com/get-convex/convex-mobile/blob/5babd583631a7ff6d739e1a2ab542039fd532548/android/convexmobile/src/main/java/dev/convex/android/ConvexClient.kt#L291)
interface in the \`convex-mobile\` repo for more info.

## Production and dev deployments [​](https://docs.convex.dev/client/android\\#production-and-dev-deployments \"Direct link to Production and dev deployments\")

When you're ready to move toward
[production](https://docs.convex.dev/production) for your app, you can setup
your Android build system to point different builds or flavors of your
application to different Convex deployments. One fairly simple way to do it is
by passing different values (e.g. deployment URL) to different build targets or
flavors.

Here's a simple example that shows using different deployment URLs for release
and debug builds:

\`\`\`codeBlockLines_zEuJ
// In the android section of build.gradle.kts:
buildTypes {
    release {
        // Snip various other config like ProGuard ...
        resValue(\"string\", \"convex_url\", \"YOUR_PROD.convex.cloud\")
    }

    debug {
        resValue(\"string\", \"convex_url\", \"YOUR_DEV.convex.cloud\")
    }
}

\`\`\`

Then you can build your \`ConvexClient\` using a single resource in code, and it
will get the right value at compile time.

\`\`\`codeBlockLines_zEuJ
val convex = ConvexClient(context.getString(R.string.convex_url))

\`\`\`

tip

You may not want these urls checked into your repository. One pattern is to
create a custom \`my_app.properties\` file that is configured to be ignored in
your \`.gitignore\` file. You can then read this file in your \`build.gradle.kts\`
file. You can see this pattern in use in the
[workout sample app](https://github.com/get-convex/android-convex-workout?tab=readme-ov-file#configuration).

## Structuring your application [​](https://docs.convex.dev/client/android\\#structuring-your-application \"Direct link to Structuring your application\")

The examples shown in this guide are intended to be brief, and don't provide
guidance on how to structure a whole application.

The official
[Android application architecture](https://developer.android.com/topic/architecture/intro)
docs cover best practices for building applications, and Convex also has a
[sample open source application](https://github.com/get-convex/android-convex-workout/tree/main)
that attempts to demonstrate what a small multi-screen application might look
like.

In general, do the following:

1. Embrace Flows and
[unidirectional data flow](https://developer.android.com/develop/ui/compose/architecture#udf)
2. Have a clear
[data layer](https://developer.android.com/topic/architecture/data-layer)
(use Repository classes with \`ConvexClient\` as your data source)
3. Hold UI state in a
[ViewModel](https://developer.android.com/topic/architecture/recommendations#viewmodel)

## Testing [​](https://docs.convex.dev/client/android\\#testing \"Direct link to Testing\")

\`ConvexClient\` is an \`open\` class so it can be mocked or faked in unit tests. If
you want to use more of the real client, you can pass a fake
\`MobileConvexClientInterface\` in to the \`ConvexClient\` constructor. Just be
aware that you'll need to provide JSON in Convex's undocumented
[JSON format](https://github.com/get-convex/convex-mobile/blob/5babd583631a7ff6d739e1a2ab542039fd532548/android/convexmobile/src/main/java/dev/convex/android/jsonhelpers.kt#L47).

You can also use the full \`ConvexClient\` in Android instrumentation tests. You
can setup a special backend instance for testing or run a local Convex server
and run full integration tests.

## Under the hood [​](https://docs.convex.dev/client/android\\#under-the-hood \"Direct link to Under the hood\")

Convex for Android is built on top of the official
[Convex Rust client](https://docs.convex.dev/client/rust). It handles
maintaining a WebSocket connection with the Convex backend and implements the
full Convex protocol.

All method calls on \`ConvexClient\` are handled via a Tokio async runtime on the
Rust side and are safe to call from the application's main thread.

\`ConvexClient\` also makes heavy use of
[Kotlin's serialization framework](https://github.com/Kotlin/kotlinx.serialization/blob/master/docs/serialization-guide.md),
and most of the functionality in that framework is available for you to use in
your applications. Internally, \`ConvexClient\` enables the JSON
[\`ignoreUnknownKeys\`](https://github.com/Kotlin/kotlinx.serialization/blob/master/docs/json.md#ignoring-unknown-keys)
and
[\`allowSpecialFloatingPointValues\`](https://github.com/Kotlin/kotlinx.serialization/blob/master/docs/json.md#allowing-special-floating-point-values)
features.

- [Installation](https://docs.convex.dev/client/android#installation)
- [Connecting to a backend](https://docs.convex.dev/client/android#connecting-to-a-backend)
- [Fetching data](https://docs.convex.dev/client/android#fetching-data)
  - [Query arguments](https://docs.convex.dev/client/android#query-arguments)
  - [Subscription lifetime](https://docs.convex.dev/client/android#subscription-lifetime)
- [Editing data](https://docs.convex.dev/client/android#editing-data)
- [Calling third-party APIs](https://docs.convex.dev/client/android#calling-third-party-apis)
- [Authentication with Auth0](https://docs.convex.dev/client/android#authentication-with-auth0)
- [Production and dev deployments](https://docs.convex.dev/client/android#production-and-dev-deployments)
- [Structuring your application](https://docs.convex.dev/client/android#structuring-your-application)
- [Testing](https://docs.convex.dev/client/android#testing)
- [Under the hood](https://docs.convex.dev/client/android#under-the-hood)



[Skip to main content](https://docs.convex.dev/database/backup-restore#docusaurus_skipToContent_fallback)

On this page

Convex supports Backup & Restore of data via the
[dashboard](https://dashboard.convex.dev/deployment/settings/backups).

![Backups Page](https://docs.convex.dev/assets/images/backups-7e17da1541fc3eb26194a96ab33414ea.png)

# Backups

A backup is a consistent snapshot of your table data and file storage made at
the time of your request.

Take a backup by pressing the \"Backup Now\" button. This may take a few seconds
to a few hours, depending on how much data is in your deployment.

Backups are stored for 7 days. You can download or delete backups via this page.

Deployment configuration and other data (code, environment variables, scheduled
functions, etc.) will not be included.

### Periodic Backups [​](https://docs.convex.dev/database/backup-restore\\#periodic-backups \"Direct link to Periodic Backups\")

Schedule a periodic daily backup by checking the \"Backup automatically\" box. You
can select what time of day to have the backup occur.

Periodic backups require a Convex Pro plan.

Periodic backupsrequire a Convex Pro plan. [Learn\\\\
more](https://convex.dev/pricing) about our plans or
[upgrade](https://dashboard.convex.dev/team/settings/billing).

### Restoring from backup [​](https://docs.convex.dev/database/backup-restore\\#restoring-from-backup \"Direct link to Restoring from backup\")

Restore from a backup by selecting restore from the submenu of an individual.
You can restore from backups in the same deployment or from other deployments on
the same team by using the deployment selector on the backups page. Restores may
take a few seconds to a few hours depending on how much data is in your backup.

Note that restoring is a destructive operation that wipes your existing data and
replaces it with that from the backup. It's recommended that you generate an
additional backup before doing a restore.

### Restoring in an emergency [​](https://docs.convex.dev/database/backup-restore\\#restoring-in-an-emergency \"Direct link to Restoring in an emergency\")

If your production deployment ends up in a bad state, you may want to consider
doing a restore to return to a good state. Note that getting your data to a good
state may not be enough. Consider whether you may need each of the following
actions. Depending on the nature of your emergency, these may be required.

- Take an additional backup prior to restore, since restores are destructive
- Do a restore from a good backup - to restore data
- Use \`npx convex dev\` to push a known version of good code.
- Use \`npx convex env\` or the dashboard to restore to a good set of env vars
- Use the dashboard to make any manual fixes to the database for your app.
- Write mutations to make required (more programmatic) manual fixes to the
database for your app.

# Downloading a backup

You can download your manual and periodic backups from the dashboard via the
download button in the menu.

Alternatively, you can generate an export in the same format with the
[command line](https://docs.convex.dev/cli#export-data-to-a-file):

\`\`\`codeBlockLines_zEuJ
npx convex export --path ~/Downloads

\`\`\`

The backup comes as a generated a ZIP file with all documents in all Convex
tables in your deployment.

The ZIP file's name has the format \`snapshot_{ts}.zip\` where \`ts\` is a UNIX
timestamp of the snapshot in nanoseconds. The export ZIP file contains documents
for each table at \`<table_name>/documents.jsonl\`, with one document per line.

Exported ZIP files also contain data from [file storage](https://docs.convex.dev/file-storage) in a
\`_storage\` folder, with metadata like IDs and checksums in
\`_storage/documents.jsonl\` and each file as \`_storage/<id>\`.

### Using the downloaded backup. [​](https://docs.convex.dev/database/backup-restore\\#using-the-downloaded-backup \"Direct link to Using the downloaded backup.\")

Downloaded ZIP files can be imported into the same deployment or a different
deployment with the
[CLI](https://docs.convex.dev/database/import-export/import#import-data-from-a-snapshot-zip-file).

## FAQ [​](https://docs.convex.dev/database/backup-restore\\#faq \"Direct link to FAQ\")

### Are there any limitations? [​](https://docs.convex.dev/database/backup-restore\\#are-there-any-limitations \"Direct link to Are there any limitations?\")

Each backup is accessible for up to 7 days.

On the Starter plan, up to two backups can stored per deployment at a time. Paid
plan deployments can have many backups with standard usage based pricing.

### How are they priced? [​](https://docs.convex.dev/database/backup-restore\\#how-are-they-priced \"Direct link to How are they priced?\")

Backups uses database bandwidth to read all documents, and file bandwidth to
include user files. The generation and storage of the backup itself is billed
with the same bandwidth and storage pricing as user file storage. You can
observe this bandwidth and storage cost in the
[usage dashboard](https://dashboard.convex.dev/team/settings/usage). Check the
[limits docs](https://docs.convex.dev/production/state/limits#database) for pricing details.

### What does the backup not contain? [​](https://docs.convex.dev/database/backup-restore\\#what-does-the-backup-not-contain \"Direct link to What does the backup not contain?\")

The backup only contains the documents for your tables and files in file
storage. In particular it lacks:

1. Your deployment's code and configuration. Convex functions, crons.ts,
auth.config.js, schema.ts, etc. are configured in your source code.
2. Pending scheduled functions. You can access pending scheduled functions in
the [\`_scheduled_functions\`](https://docs.convex.dev/database/advanced/system-tables)
system table.
3. Environment variables. Environment variables can be copied from Settings in
the Convex dashboard.

- [Periodic Backups](https://docs.convex.dev/database/backup-restore#periodic-backups)
- [Restoring from backup](https://docs.convex.dev/database/backup-restore#restoring-from-backup)
- [Restoring in an emergency](https://docs.convex.dev/database/backup-restore#restoring-in-an-emergency)
- [Using the downloaded backup.](https://docs.convex.dev/database/backup-restore#using-the-downloaded-backup)
- [FAQ](https://docs.convex.dev/database/backup-restore#faq)
  - [Are there any limitations?](https://docs.convex.dev/database/backup-restore#are-there-any-limitations)
  - [How are they priced?](https://docs.convex.dev/database/backup-restore#how-are-they-priced)
  - [What does the backup not contain?](https://docs.convex.dev/database/backup-restore#what-does-the-backup-not-contain)



[Skip to main content](https://docs.convex.dev/production/contact#docusaurus_skipToContent_fallback)

On this page

Convex is a rapidly developing platform and we're always eager to hear your
feedback.

## Feedback and Support [​](https://docs.convex.dev/production/contact\\#feedback-and-support \"Direct link to Feedback and Support\")

Please share any general questions, feature requests, or product feedback in our
[Convex Discord Community](https://convex.dev/community). We're particularly
excited to see what you build on Convex!

Any specific support questions that aren't able to be adequately addressed on
our Discord channel can be directed to
[support@convex.dev](mailto:support@convex.dev).

## Following Convex [​](https://docs.convex.dev/production/contact\\#following-convex \"Direct link to Following Convex\")

Release notes are shared on [Convex News](https://news.convex.dev/tag/releases)
and the [Convex Discord Community](https://convex.dev/community).

Product announcements, articles and demos are posted on
[Stack](https://stack.convex.dev/), [News](https://news.convex.dev/),
[our YouTube channel](https://www.youtube.com/channel/UCoC_9mdiPwIu1sDxDtGQggQ),
and [X (fka Twitter)](https://x.com/convex_dev).

## Vulnerability Disclosure [​](https://docs.convex.dev/production/contact\\#vulnerability-disclosure \"Direct link to Vulnerability Disclosure\")

If you believe you've discovered a bug in Convex's security, please get in touch
at [security@convex.dev](mailto:security@convex.dev) and we'll get back to you
within 24 hours. We request that you not publicly disclose the issue until we
have had a chance to address it.

- [Feedback and Support](https://docs.convex.dev/production/contact#feedback-and-support)
- [Following Convex](https://docs.convex.dev/production/contact#following-convex)
- [Vulnerability Disclosure](https://docs.convex.dev/production/contact#vulnerability-disclosure)



[Skip to main content](https://docs.convex.dev/database/types#docusaurus_skipToContent_fallback)

On this page

All Convex documents are defined as Javascript objects. These objects can have
field values of any of the types below.

You can codify the shape of documents within your tables by
[defining a schema](https://docs.convex.dev/database/schemas).

## Convex values [​](https://docs.convex.dev/database/types\\#convex-values \"Direct link to Convex values\")

Convex supports the following types of values:

| Convex Type | TS/JS Type | Example Usage | Validator for [Argument Validation](https://docs.convex.dev/functions/validation) and [Schemas](https://docs.convex.dev/database/schemas) | \`json\` Format for [Export](https://docs.convex.dev/database/import-export) | Notes |
| --- | --- | --- | --- | --- | --- |
| Id | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type) | \`doc._id\` | \`v.id(tableName)\` | string | See [Document IDs](https://docs.convex.dev/database/document-ids). |
| Null | [null](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#null_type) | \`null\` | \`v.null()\` | null | JavaScript's \`undefined\` is not a valid Convex value. Functions the return \`undefined\` or do not return will return \`null\` when called from a client. Use \`null\` instead. |
| Int64 | [bigint](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#bigint_type) | \`3n\` | \`v.int64()\` | string (base10) | Int64s only support BigInts between -2^63 and 2^63-1. Convex supports \`bigint\` s in [most modern browsers](https://caniuse.com/bigint). |
| Float64 | [number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type) | \`3.1\` | \`v.number()\` | number / string | Convex supports all IEEE-754 double-precision floating point numbers (such as NaNs). Inf and NaN are JSON serialized as strings. |
| Boolean | [boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type) | \`true\` | \`v.boolean()\` | bool |  |
| String | [string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type) | \`\"abc\"\` | \`v.string()\` | string | Strings are stored as UTF-8 and must be valid Unicode sequences. Strings must be smaller than the 1MB total size limit when encoded as UTF-8. |
| Bytes | [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) | \`new ArrayBuffer(8)\` | \`v.bytes()\` | string (base64) | Convex supports first class bytestrings, passed in as \`ArrayBuffer\` s. Bytestrings must be smaller than the 1MB total size limit for Convex types. |
| Array | [Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) | \`[1, 3.2, \"abc\"]\` | \`v.array(values)\` | array | Arrays can have at most 8192 values. |
| Object | [Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#objects) | \`{a: \"abc\"}\` | \`v.object({property: value})\` | object | Convex only supports \"plain old JavaScript objects\" (objects that do not have a custom prototype). Convex includes all [enumerable properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties). Objects can have at most 1024 entries. Field names must be nonempty and not start with \"$\" or \"\\_\". |
| Record | [Record](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type) | \`{\"a\": \"1\", \"b\": \"2\"}\` | \`v.record(keys, values)\` | object | Records are objects at runtime, but can have dynamic keys. Keys must be only ASCII characters, nonempty, and not start with \"$\" or \"\\_\". |

## System fields [​](https://docs.convex.dev/database/types\\#system-fields \"Direct link to System fields\")

Every document in Convex has two automatically-generated system fields:

- \`_id\`: The [document ID](https://docs.convex.dev/database/document-ids) of the document.
- \`_creationTime\`: The time this document was created, in milliseconds since the
Unix epoch.

## Limits [​](https://docs.convex.dev/database/types\\#limits \"Direct link to Limits\")

Convex values must be less than 1MB in total size. This is an approximate limit
for now, but if you're running into these limits and would like a more precise
method to calculate a document's size,
[reach out to us](https://convex.dev/community). Documents can have nested
values, either objects or arrays that contain other Convex types. Convex types
can have at most 16 levels of nesting, and the cumulative size of a nested tree
of values must be under the 1MB limit.

Table names may contain alphanumeric characters (\"a\" to \"z\", \"A\" to \"Z\", and \"0\"
to \"9\") and underscores (\"\\_\"), and they cannot start with an underscore.

For information on other limits, see [here](https://docs.convex.dev/production/state/limits).

If any of these limits don't work for you,
[let us know](https://convex.dev/community)!

## Working with \`undefined\` [​](https://docs.convex.dev/database/types\\#working-with-undefined \"Direct link to working-with-undefined\")

The TypeScript value \`undefined\` is not a valid Convex value, so it cannot be
used in Convex function arguments or return values, or in stored documents.

1. Objects/records with \`undefined\` values are the same as if the field were
missing: \`{a: undefined}\` is transformed into \`{}\` when passed to a function
or stored in the database. You can think of Convex function calls and the
Convex database as serializing the data with \`JSON.stringify\`, which
similarly removes \`undefined\` values.
2. Validators for object fields can use \`v.optional(...)\` to indicate that the
field might not be present.
   - If an object's field \"a\" is missing, i.e. \`const obj = {};\`, then
     \`obj.a === undefined\`. This is a property of TypeScript/JavaScript, not
     specific to Convex.
3. You can use \`undefined\` in filters and index queries, and it will match
documents that do not have the field. i.e.
\`.withIndex(\"by_a\", q=>q.eq(\"a\", undefined))\` matches document \`{}\` and
\`{b: 1}\`, but not \`{a: 1}\` or \`{a: null, b: 1}\`.
   - In Convex's ordering scheme, \`undefined < null < all other values\`, so you
     can match documents that _have_ a field via \`q.gte(\"a\", null as any)\`.
4. There is exactly one case where \`{a: undefined}\` is different from \`{}\`: when
passed to \`ctx.db.patch\`. Passing \`{a: undefined}\` removes the field \"a\" from
the document, while passing \`{}\` does not change the field \"a\". See
[Updating existing documents](https://docs.convex.dev/database/writing-data#updating-existing-documents).
5. Since \`undefined\` gets stripped from function arguments but has meaning in
\`ctx.db.patch\`, there are some tricks to pass patch's argument from the
client.
   - If the client passing \`args={}\` (or \`args={a: undefined}\` which is
     equivalent) should leave the field \"a\" unchanged, use
     \`ctx.db.patch(id, args)\`.
   - If the client passing \`args={}\` should remove the field \"a\", use
     \`ctx.db.patch(id, {a: undefined, ...args})\`.
   - If the client passing \`args={}\` should leave the field \"a\" unchanged and
     \`args={a: null}\` should remove it, you could do




     \`\`\`codeBlockLines_zEuJ
     if (args.a === null) {
       args.a = undefined;
     }
     await ctx.db.patch(id, args);

     \`\`\`
6. Functions that return a plain \`undefined\`/ \`void\` are treated as if they
returned \`null\`.
7. Arrays containing \`undefined\` values, like \`[undefined]\`, throw an error when
used as Convex values.

If you would prefer to avoid the special behaviors of \`undefined\`, you can use
\`null\` instead, which _is_ a valid Convex value.

## Working with dates and times [​](https://docs.convex.dev/database/types\\#working-with-dates-and-times \"Direct link to Working with dates and times\")

Convex does not have a special data type for working with dates and times. How
you store dates depends on the needs of your application:

1. If you only care about a point in time, you can store a
[UTC timestamp](https://en.wikipedia.org/wiki/Unix_time). We recommend
following the \`_creationTime\` field example, which stores the timestamp as a
\`number\` in milliseconds. In your functions and on the client you can create
a JavaScript \`Date\` by passing the timestamp to its constructor:
\`new Date(timeInMsSinceEpoch)\`. You can then print the date and time in the
desired time zone (such as your user's machine's configured time zone).   - To get the current UTC timestamp in your function and store it in the
        database, use \`Date.now()\`
2. If you care about a calendar date or a specific clock time, such as when
implementing a booking app, you should store the actual date and/or time as a
string. If your app supports multiple timezones you should store the timezone
as well. [ISO8601](https://en.wikipedia.org/wiki/ISO_8601) is a common format
for storing dates and times together in a single string like
\`\"2024-03-21T14:37:15Z\"\`. If your users can choose a specific time zone you
should probably store it in a separate \`string\` field, usually using the
[IANA time zone name](https://en.wikipedia.org/wiki/Tz_database#Names_of_time_zones)
(although you could concatenate the two fields with unique character like
\`\"|\"\`).

For more sophisticated printing (formatting) and manipulation of dates and times
use one of the popular JavaScript libraries: [date-fns](https://date-fns.org/),
[Day.js](https://day.js.org/), [Luxon](https://moment.github.io/luxon/) or
[Moment.js](https://momentjs.com/).

- [Convex values](https://docs.convex.dev/database/types#convex-values)
- [System fields](https://docs.convex.dev/database/types#system-fields)
- [Limits](https://docs.convex.dev/database/types#limits)
- [Working with \`undefined\`](https://docs.convex.dev/database/types#working-with-undefined)
- [Working with dates and times](https://docs.convex.dev/database/types#working-with-dates-and-times)



[Skip to main content](https://docs.convex.dev/quickstart/python#docusaurus_skipToContent_fallback)

Learn how to query data from Convex in a Python app.

1. Create a Python script folder



Create a folder for your Python script
with a virtual environment.











\`\`\`codeBlockLines_zEuJ
python3 -m venv my-app/venv

\`\`\`

2. Install the Convex client and server libraries



To get started, install the \`convex\` npm
package which enables you to write your
backend.



And also install the \`convex\` Python client
library and \`python-dotenv\` for working with \`.env\` files.











\`\`\`codeBlockLines_zEuJ
cd my-app && npm init -y && npm install convex && venv/bin/pip install convex python-dotenv

\`\`\`

3. Set up a Convex dev deployment



Next, run \`npx convex dev\`. This
will prompt you to log in with GitHub,
create a project, and save your production and deployment URLs.



It will also create a \`convex/\` folder for you
to write your backend API functions in. The \`dev\` command
will then continue running to sync your functions
with your dev deployment in the cloud.











\`\`\`codeBlockLines_zEuJ
npx convex dev

\`\`\`

4. Create sample data for your database



In a new terminal window, create a \`sampleData.jsonl\`
file with some sample data.









sampleData.jsonl





\`\`\`codeBlockLines_zEuJ
{\"text\": \"Buy groceries\", \"isCompleted\": true}
{\"text\": \"Go for a swim\", \"isCompleted\": true}
{\"text\": \"Integrate Convex\", \"isCompleted\": false}

\`\`\`

5. Add the sample data to your database



Now that your project is ready, add a \`tasks\` table
with the sample data into your Convex database with
the \`import\` command.











\`\`\`codeBlockLines_zEuJ
npx convex import --table tasks sampleData.jsonl

\`\`\`

6. Expose a database query



Add a new file \`tasks.js\` in the \`convex/\` folder
with a query function that loads the data.



Exporting a query function from this file
declares an API function named after the file
and the export name, \`\"tasks:get\"\`.









convex/tasks.js





\`\`\`codeBlockLines_zEuJ
import { query } from \"./_generated/server\";

export const get = query({
     handler: async ({ db }) => {
       return await db.query(\"tasks\").collect();
     },
});

\`\`\`

7. Create a script to load data from Convex



In a new file \`main.py\`, create a \`ConvexClient\` and use it
to fetch from your \`\"tasks:get\"\` API.









main.py





\`\`\`codeBlockLines_zEuJ
import os

from dotenv import load_dotenv

from convex import ConvexClient

load_dotenv(\".env.local\")
CONVEX_URL = os.getenv(\"CONVEX_URL\")
# or you can hardcode your deployment URL instead
# CONVEX_URL = \"https://happy-otter-123.convex.cloud\"

client = ConvexClient(CONVEX_URL)

print(client.query(\"tasks:get\"))

for tasks in client.subscribe(\"tasks:get\"):
       print(tasks)
       # this loop lasts forever, ctrl-c to exit it

\`\`\`

8. Run the script



Run the script
and see the serialized list of tasks.











\`\`\`codeBlockLines_zEuJ
venv/bin/python -m main

\`\`\`


See the [docs on PyPI](https://pypi.org/project/convex/) for more details.



[Skip to main content](https://docs.convex.dev/quickstart/react#docusaurus_skipToContent_fallback)

To get setup quickly with Convex and React run

**\`npm create convex@latest\`**

**\`\`**

or follow the guide below.

* * *

Learn how to query data from Convex in a React app using Vite
and

TypeScript

01. Create a React app



    Create a React app using the \`create vite\` command.











    \`\`\`codeBlockLines_zEuJ
    npm create vite@latest my-app -- --template react-ts

    \`\`\`

02. Install the Convex client and server library



    To get started, install the \`convex\`
    package which provides a convenient interface for working
    with Convex from a React app.



    Navigate to your app directory and install \`convex\`.











    \`\`\`codeBlockLines_zEuJ
    cd my-app && npm install convex

    \`\`\`

03. Set up a Convex dev deployment



    Next, run \`npx convex dev\`. This
    will prompt you to log in with GitHub,
    create a project, and save your production and deployment URLs.



    It will also create a \`convex/\` folder for you
    to write your backend API functions in. The \`dev\` command
    will then continue running to sync your functions
    with your dev deployment in the cloud.











    \`\`\`codeBlockLines_zEuJ
    npx convex dev

    \`\`\`

04. Create sample data for your database



    In a new terminal window, create a \`sampleData.jsonl\`
    file with some sample data.









    sampleData.jsonl





    \`\`\`codeBlockLines_zEuJ
    {\"text\": \"Buy groceries\", \"isCompleted\": true}
    {\"text\": \"Go for a swim\", \"isCompleted\": true}
    {\"text\": \"Integrate Convex\", \"isCompleted\": false}

    \`\`\`

05. Add the sample data to your database



    Now that your project is ready, add a \`tasks\` table
    with the sample data into your Convex database with
    the \`import\` command.











    \`\`\`codeBlockLines_zEuJ
    npx convex import --table tasks sampleData.jsonl

    \`\`\`

06. (optional) Define a schema



    Add a new file \`schema.ts\` in the \`convex/\` folder
    with a description of your data.



    This will declare the types of your data for optional
    typechecking with TypeScript, and it will be also
    enforced at runtime.



    Alternatively remove the line \`'plugin:@typescript-eslint/recommended-requiring-type-checking',\`
    from the \`.eslintrc.cjs\` file to lower the type checking strictness.









    convex/schema.ts





    \`\`\`codeBlockLines_zEuJ
    import { defineSchema, defineTable } from \"convex/server\";
    import { v } from \"convex/values\";

    export default defineSchema({
      tasks: defineTable({
        text: v.string(),
        isCompleted: v.boolean(),
      }),
    });

    \`\`\`

07. Expose a database query



    Add a new file \`tasks.ts\` in the \`convex/\` folder
    with a query function that loads the data.



    Exporting a query function from this file
    declares an API function named after the file
    and the export name, \`api.tasks.get\`.













    convex/tasks.ts







    TS

















    \`\`\`codeBlockLines_zEuJ
    import { query } from \"./_generated/server\";

    export const get = query({
      args: {},
      handler: async (ctx) => {
        return await ctx.db.query(\"tasks\").collect();
      },
    });

    \`\`\`

08. Connect the app to your backend



    In \`src/main.tsx\`, create a \`ConvexReactClient\` and pass it to a \`ConvexProvider\`
    wrapping your app.













    src/main.tsx







    TS

















    \`\`\`codeBlockLines_zEuJ
    import React from \"react\";
    import ReactDOM from \"react-dom/client\";
    import App from \"./App\";
    import \"./index.css\";
    import { ConvexProvider, ConvexReactClient } from \"convex/react\";

    const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

    ReactDOM.createRoot(document.getElementById(\"root\")!).render(
      <React.StrictMode>
        <ConvexProvider client={convex}>
          <App />
        </ConvexProvider>
      </React.StrictMode>,
    );

    \`\`\`

09. Display the data in your app



    In \`src/App.tsx\`, use the \`useQuery\` hook to fetch from your \`api.tasks.get\`
    API function and display the data.













    src/App.tsx







    TS

















    \`\`\`codeBlockLines_zEuJ
    import \"./App.css\";
    import { useQuery } from \"convex/react\";
    import { api } from \"../convex/_generated/api\";

    function App() {
      const tasks = useQuery(api.tasks.get);
      return (
        <div className=\"App\">
          {tasks?.map(({ _id, text }) => <div key={_id}>{text}</div>)}
        </div>
      );
    }

    export default App;



    \`\`\`

10. Start the app



    Start the app, open [http://localhost:5173/](http://localhost:5173/) in a browser,
    and see the list of tasks.











    \`\`\`codeBlockLines_zEuJ
    npm run dev

    \`\`\`


Using \`create-react-app\`? See the
[Create React App](https://docs.convex.dev/client/react/quickstart-create-react-app) version of this
guide.



[Skip to main content](https://docs.convex.dev/client/javascript/node#docusaurus_skipToContent_fallback)

On this page

Convex supports point-in-time queries (see
[HTTP client](https://docs.convex.dev/api/classes/browser.ConvexHttpClient)) and query subscriptions
(see [ConvexClient](https://docs.convex.dev/api/classes/browser.ConvexClient)) in Node.js.

If your JavaScript code uses import/export syntax, calling Convex functions
works just like in a browser.

\`\`\`codeBlockLines_zEuJ
import { ConvexHttpClient, ConvexClient } from \"convex/browser\";
import { api } from \"./convex/_generated/api.js\";

// HTTP client
const httpClient = new ConvexHttpClient(CONVEX_URL_GOES_HERE);
httpClient.query(api.messages.list).then(console.log);

// Subscription client
const client = new ConvexClient(CONVEX_URL_GOES_HERE);
client.onUpdate(api.messages.list, {}, (messages) => console.log(messages));

\`\`\`

## TypeScript [​](https://docs.convex.dev/client/javascript/node\\#typescript \"Direct link to TypeScript\")

Just like bundling for the browser, bundling TypeScript code for Node.js with
webpack, esbuild, rollup, vite, and others usually allow you import from code
that uses import/export syntax with no extra setup.

If you use TypeScript to _compile_ your code (this is rare for web projects but
more common with Node.js), add \`\"allowJs\": true\` to \`tsconfig.json\` compiler
options so that TypeScript will compile the \`api.js\` file as well.

## TypeScript without a compile step [​](https://docs.convex.dev/client/javascript/node\\#typescript-without-a-compile-step \"Direct link to TypeScript without a compile step\")

If you want to run your TypeScript script directly without a compile step,
installing [ts-node-esm](https://www.npmjs.com/package/ts-node) and running your
script with ts-node-esm should work if you use \`\"type\": \"module\"\` in your
\`package.json\`.

## JavaScript with CommonJS ( \`require()\` syntax) [​](https://docs.convex.dev/client/javascript/node\\#javascript-with-commonjs-require-syntax \"Direct link to javascript-with-commonjs-require-syntax\")

If you don't use \`\"type\": \"module\"\` in the \`package.json\` of your project you'll
need to use \`require()\` syntax and Node.js will not be able to import the
\`convex/_generated/api.js\` file directly.

In the same directory as your \`package.json\`, create or edit
[\`convex.json\`](https://docs.convex.dev/production/project-configuration#convex.json):

\`\`\`codeBlockLines_zEuJ
{
  \"generateCommonJSApi\": true
}

\`\`\`

When the \`convex dev\` command generates files in \`convex/_generated/\` a new
\`api_cjs.cjs\` file will be created which can be imported from CommonJS code.

\`\`\`codeBlockLines_zEuJ
const { ConvexHttpClient, ConvexClient } = require(\"convex/browser\");
const { api } = require(\"./convex/_generated/api_cjs.cjs\");
const httpClient = new ConvexHttpClient(CONVEX_URL_GOES_HERE);

\`\`\`

## TypeScript with CommonJS without a compile step [​](https://docs.convex.dev/client/javascript/node\\#typescript-with-commonjs-without-a-compile-step \"Direct link to TypeScript with CommonJS without a compile step\")

Follow the steps above for CommonJS and use
[\`ts-node\`](https://www.npmjs.com/package/ts-node) to run you code. Be sure your
\`tsconfig.json\` is configured for CommonJS output.

## Using Convex with Node.js without codegen [​](https://docs.convex.dev/client/javascript/node\\#using-convex-with-nodejs-without-codegen \"Direct link to Using Convex with Node.js without codegen\")

You can always use the \`anyApi\` object or strings if you don't have the Convex
functions and api file handy. An api reference like \`api.folder.file.exportName\`
becomes \`anyApi.folder.file.exportName\` or \`\"folder/file:exportName\"\`.

- [TypeScript](https://docs.convex.dev/client/javascript/node#typescript)
- [TypeScript without a compile step](https://docs.convex.dev/client/javascript/node#typescript-without-a-compile-step)
- [JavaScript with CommonJS ( \`require()\` syntax)](https://docs.convex.dev/client/javascript/node#javascript-with-commonjs-require-syntax)
- [TypeScript with CommonJS without a compile step](https://docs.convex.dev/client/javascript/node#typescript-with-commonjs-without-a-compile-step)
- [Using Convex with Node.js without codegen](https://docs.convex.dev/client/javascript/node#using-convex-with-nodejs-without-codegen)



[Skip to main content](https://docs.convex.dev/api/modules/server#docusaurus_skipToContent_fallback)

On this page

Utilities for implementing server-side Convex query and mutation functions.

## Usage [​](https://docs.convex.dev/api/modules/server\\#usage \"Direct link to Usage\")

### Code Generation [​](https://docs.convex.dev/api/modules/server\\#code-generation \"Direct link to Code Generation\")

This module is typically used alongside generated server code.

To generate the server code, run \`npx convex dev\` in your Convex project.
This will create a \`convex/_generated/server.js\` file with the following
functions, typed for your schema:

- [query](https://docs.convex.dev/generated-api/server#query)
- [mutation](https://docs.convex.dev/generated-api/server#mutation)

If you aren't using TypeScript and code generation, you can use these untyped
functions instead:

- [queryGeneric](https://docs.convex.dev/api/modules/server#querygeneric)
- [mutationGeneric](https://docs.convex.dev/api/modules/server#mutationgeneric)

### Example [​](https://docs.convex.dev/api/modules/server\\#example \"Direct link to Example\")

Convex functions are defined by using either the \`query\` or
\`mutation\` wrappers.

Queries receive a \`db\` that implements the [GenericDatabaseReader](https://docs.convex.dev/api/interfaces/server.GenericDatabaseReader) interface.

\`\`\`codeBlockLines_zEuJ
import { query } from \"./_generated/server\";

export default query({
  handler: async ({ db }, { arg1, arg2 }) => {
    // Your (read-only) code here!
  },
});

\`\`\`

If your function needs to write to the database, such as inserting, updating,
or deleting documents, use \`mutation\` instead which provides a \`db\` that
implements the [GenericDatabaseWriter](https://docs.convex.dev/api/interfaces/server.GenericDatabaseWriter) interface.

\`\`\`codeBlockLines_zEuJ
import { mutation } from \"./_generated/server\";

export default mutation({
  handler: async ({ db }, { arg1, arg2 }) => {
    // Your mutation code here!
  },
});

\`\`\`

## Classes [​](https://docs.convex.dev/api/modules/server\\#classes \"Direct link to Classes\")

- [Crons](https://docs.convex.dev/api/classes/server.Crons)
- [Expression](https://docs.convex.dev/api/classes/server.Expression)
- [IndexRange](https://docs.convex.dev/api/classes/server.IndexRange)
- [HttpRouter](https://docs.convex.dev/api/classes/server.HttpRouter)
- [TableDefinition](https://docs.convex.dev/api/classes/server.TableDefinition)
- [SchemaDefinition](https://docs.convex.dev/api/classes/server.SchemaDefinition)
- [SearchFilter](https://docs.convex.dev/api/classes/server.SearchFilter)
- [FilterExpression](https://docs.convex.dev/api/classes/server.FilterExpression)

## Interfaces [​](https://docs.convex.dev/api/modules/server\\#interfaces \"Direct link to Interfaces\")

- [UserIdentity](https://docs.convex.dev/api/interfaces/server.UserIdentity)
- [Auth](https://docs.convex.dev/api/interfaces/server.Auth)
- [CronJob](https://docs.convex.dev/api/interfaces/server.CronJob)
- [BaseTableReader](https://docs.convex.dev/api/interfaces/server.BaseTableReader)
- [GenericDatabaseReader](https://docs.convex.dev/api/interfaces/server.GenericDatabaseReader)
- [GenericDatabaseReaderWithTable](https://docs.convex.dev/api/interfaces/server.GenericDatabaseReaderWithTable)
- [GenericDatabaseWriter](https://docs.convex.dev/api/interfaces/server.GenericDatabaseWriter)
- [GenericDatabaseWriterWithTable](https://docs.convex.dev/api/interfaces/server.GenericDatabaseWriterWithTable)
- [BaseTableWriter](https://docs.convex.dev/api/interfaces/server.BaseTableWriter)
- [FilterBuilder](https://docs.convex.dev/api/interfaces/server.FilterBuilder)
- [IndexRangeBuilder](https://docs.convex.dev/api/interfaces/server.IndexRangeBuilder)
- [PaginationResult](https://docs.convex.dev/api/interfaces/server.PaginationResult)
- [PaginationOptions](https://docs.convex.dev/api/interfaces/server.PaginationOptions)
- [QueryInitializer](https://docs.convex.dev/api/interfaces/server.QueryInitializer)
- [Query](https://docs.convex.dev/api/interfaces/server.Query)
- [OrderedQuery](https://docs.convex.dev/api/interfaces/server.OrderedQuery)
- [GenericMutationCtx](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx)
- [GenericQueryCtx](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx)
- [GenericActionCtx](https://docs.convex.dev/api/interfaces/server.GenericActionCtx)
- [ValidatedFunction](https://docs.convex.dev/api/interfaces/server.ValidatedFunction)
- [Scheduler](https://docs.convex.dev/api/interfaces/server.Scheduler)
- [SearchIndexConfig](https://docs.convex.dev/api/interfaces/server.SearchIndexConfig)
- [VectorIndexConfig](https://docs.convex.dev/api/interfaces/server.VectorIndexConfig)
- [DefineSchemaOptions](https://docs.convex.dev/api/interfaces/server.DefineSchemaOptions)
- [SystemDataModel](https://docs.convex.dev/api/interfaces/server.SystemDataModel)
- [SearchFilterBuilder](https://docs.convex.dev/api/interfaces/server.SearchFilterBuilder)
- [SearchFilterFinalizer](https://docs.convex.dev/api/interfaces/server.SearchFilterFinalizer)
- [StorageReader](https://docs.convex.dev/api/interfaces/server.StorageReader)
- [StorageWriter](https://docs.convex.dev/api/interfaces/server.StorageWriter)
- [StorageActionWriter](https://docs.convex.dev/api/interfaces/server.StorageActionWriter)
- [VectorSearchQuery](https://docs.convex.dev/api/interfaces/server.VectorSearchQuery)
- [VectorFilterBuilder](https://docs.convex.dev/api/interfaces/server.VectorFilterBuilder)

## References [​](https://docs.convex.dev/api/modules/server\\#references \"Direct link to References\")

### UserIdentityAttributes [​](https://docs.convex.dev/api/modules/server\\#useridentityattributes \"Direct link to UserIdentityAttributes\")

Re-exports [UserIdentityAttributes](https://docs.convex.dev/api/modules/browser#useridentityattributes)

## Type Aliases [​](https://docs.convex.dev/api/modules/server\\#type-aliases \"Direct link to Type Aliases\")

### FunctionType [​](https://docs.convex.dev/api/modules/server\\#functiontype \"Direct link to FunctionType\")

Ƭ **FunctionType**: \`\"query\"\` \\| \`\"mutation\"\` \\| \`\"action\"\`

The type of a Convex function.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in \"Direct link to Defined in\")

[server/api.ts:19](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L19)

* * *

### FunctionReference [​](https://docs.convex.dev/api/modules/server\\#functionreference \"Direct link to FunctionReference\")

Ƭ **FunctionReference** < \`Type\`, \`Visibility\`, \`Args\`, \`ReturnType\`, \`ComponentPath\` >: \`Object\`

A reference to a registered Convex function.

You can create a [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference) using the generated \`api\` utility:

\`\`\`codeBlockLines_zEuJ
import { api } from \"../convex/_generated/api\";

const reference = api.myModule.myFunction;

\`\`\`

If you aren't using code generation, you can create references using
[anyApi](https://docs.convex.dev/api/modules/server#anyapi-1):

\`\`\`codeBlockLines_zEuJ
import { anyApi } from \"convex/server\";

const reference = anyApi.myModule.myFunction;

\`\`\`

Function references can be used to invoke functions from the client. For
example, in React you can pass references to the [useQuery](https://docs.convex.dev/api/modules/react#usequery) hook:

\`\`\`codeBlockLines_zEuJ
const result = useQuery(api.myModule.myFunction);

\`\`\`

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters \"Direct link to Type parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`Type\` | extends [\`FunctionType\`](https://docs.convex.dev/api/modules/server#functiontype) | The type of the function (\"query\", \"mutation\", or \"action\"). |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) = \`\"public\"\` | The visibility of the function (\"public\" or \"internal\"). |
| \`Args\` | extends [\`DefaultFunctionArgs\`](https://docs.convex.dev/api/modules/server#defaultfunctionargs) = \`any\` | The arguments to this function. This is an object mapping argument names to their types. |
| \`ReturnType\` | \`any\` | The return type of this function. |
| \`ComponentPath\` | \`string\` \\| \`undefined\` | - |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`_type\` | \`Type\` |
| \`_visibility\` | \`Visibility\` |
| \`_args\` | \`Args\` |
| \`_returnType\` | \`ReturnType\` |
| \`_componentPath\` | \`ComponentPath\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-1 \"Direct link to Defined in\")

[server/api.ts:52](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L52)

* * *

### ApiFromModules [​](https://docs.convex.dev/api/modules/server\\#apifrommodules \"Direct link to ApiFromModules\")

Ƭ **ApiFromModules** < \`AllModules\` >: [\`FilterApi\`](https://docs.convex.dev/api/modules/server#filterapi) < \`ApiFromModulesAllowEmptyNodes\` < \`AllModules\` >, [\`FunctionReference\`](https://docs.convex.dev/api/modules/server#functionreference) < \`any\`, \`any\`, \`any\`, \`any\` >>

Given the types of all modules in the \`convex/\` directory, construct the type
of \`api\`.

\`api\` is a utility for constructing [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference) s.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-1 \"Direct link to Type parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`AllModules\` | extends \`Record\` < \`string\`, \`object\` > | A type mapping module paths (like \`\"dir/myModule\"\`) to the types of the modules. |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-2 \"Direct link to Defined in\")

[server/api.ts:255](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L255)

* * *

### FilterApi [​](https://docs.convex.dev/api/modules/server\\#filterapi \"Direct link to FilterApi\")

Ƭ **FilterApi** < \`API\`, \`Predicate\` >: [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[mod in keyof API as API\\[mod\\] extends Predicate ? mod : API\\[mod\\] extends FunctionReference<any, any, any, any> ? never : FilterApi<API\\[mod\\], Predicate> extends Record<string, never> ? never : mod\\]: API\\[mod\\] extends Predicate ? API\\[mod\\] : FilterApi<API\\[mod\\], Predicate> }>

Filter a Convex deployment api object for functions which meet criteria,
for example all public queries.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-2 \"Direct link to Type parameters\")

| Name |
| :-- |
| \`API\` |
| \`Predicate\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-3 \"Direct link to Defined in\")

[server/api.ts:279](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L279)

* * *

### AnyApi [​](https://docs.convex.dev/api/modules/server\\#anyapi \"Direct link to AnyApi\")

Ƭ **AnyApi**: \`Record\` < \`string\`, \`Record\` < \`string\`, \`AnyModuleDirOrFunc\` >>

The type that Convex api objects extend. If you were writing an api from
scratch it should extend this type.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-4 \"Direct link to Defined in\")

[server/api.ts:393](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L393)

* * *

### PartialApi [​](https://docs.convex.dev/api/modules/server\\#partialapi \"Direct link to PartialApi\")

Ƭ **PartialApi** < \`API\` >: { \\[mod in keyof API\\]?: API\\[mod\\] extends FunctionReference<any, any, any, any> ? API\\[mod\\] : PartialApi<API\\[mod\\]> }

Recursive partial API, useful for defining a subset of an API when mocking
or building custom api objects.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-3 \"Direct link to Type parameters\")

| Name |
| :-- |
| \`API\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-5 \"Direct link to Defined in\")

[server/api.ts:401](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L401)

* * *

### FunctionArgs [​](https://docs.convex.dev/api/modules/server\\#functionargs \"Direct link to FunctionArgs\")

Ƭ **FunctionArgs** < \`FuncRef\` >: \`FuncRef\`\\[ \`\"_args\"\`\\]

Given a [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference), get the return type of the function.

This is represented as an object mapping argument names to values.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-4 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`FuncRef\` | extends \`AnyFunctionReference\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-6 \"Direct link to Defined in\")

[server/api.ts:435](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L435)

* * *

### OptionalRestArgs [​](https://docs.convex.dev/api/modules/server\\#optionalrestargs \"Direct link to OptionalRestArgs\")

Ƭ **OptionalRestArgs** < \`FuncRef\` >: \`FuncRef\`\\[ \`\"_args\"\`\\] extends \`EmptyObject\` ? \\[args?: EmptyObject\\] : \\[args: FuncRef\\[\"\\_args\"\\]\\]

A tuple type of the (maybe optional) arguments to \`FuncRef\`.

This type is used to make methods involving arguments type safe while allowing
skipping the arguments for functions that don't require arguments.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-5 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`FuncRef\` | extends \`AnyFunctionReference\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-7 \"Direct link to Defined in\")

[server/api.ts:446](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L446)

* * *

### ArgsAndOptions [​](https://docs.convex.dev/api/modules/server\\#argsandoptions \"Direct link to ArgsAndOptions\")

Ƭ **ArgsAndOptions** < \`FuncRef\`, \`Options\` >: \`FuncRef\`\\[ \`\"_args\"\`\\] extends \`EmptyObject\` ? \\[args?: EmptyObject, options?: Options\\] : \\[args: FuncRef\\[\"\\_args\"\\], options?: Options\\]

A tuple type of the (maybe optional) arguments to \`FuncRef\`, followed by an options
object of type \`Options\`.

This type is used to make methods like \`useQuery\` type-safe while allowing

1. Skipping arguments for functions that don't require arguments.
2. Skipping the options object.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-6 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`FuncRef\` | extends \`AnyFunctionReference\` |
| \`Options\` | \`Options\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-8 \"Direct link to Defined in\")

[server/api.ts:460](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L460)

* * *

### FunctionReturnType [​](https://docs.convex.dev/api/modules/server\\#functionreturntype \"Direct link to FunctionReturnType\")

Ƭ **FunctionReturnType** < \`FuncRef\` >: \`FuncRef\`\\[ \`\"_returnType\"\`\\]

Given a [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference), get the return type of the function.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-7 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`FuncRef\` | extends \`AnyFunctionReference\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-9 \"Direct link to Defined in\")

[server/api.ts:472](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L472)

* * *

### FunctionHandle [​](https://docs.convex.dev/api/modules/server\\#functionhandle \"Direct link to FunctionHandle\")

Ƭ **FunctionHandle** < \`Type\`, \`Args\`, \`ReturnType\` >: \`string\` & [\`FunctionReference\`](https://docs.convex.dev/api/modules/server#functionreference) < \`Type\`, \`\"internal\"\`, \`Args\`, \`ReturnType\` >

A serializable reference to a Convex function.
Passing a this reference to another component allows that component to call this
function during the current function execution or at any later time.
Function handles are used like \`api.folder.function\` FunctionReferences,
e.g. \`ctx.scheduler.runAfter(0, functionReference, args)\`.

A function reference is stable across code pushes but it's possible
the Convex function it refers to might no longer exist.

This is a feature of components, which are in beta.
This API is unstable and may change in subsequent releases.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-8 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Type\` | extends [\`FunctionType\`](https://docs.convex.dev/api/modules/server#functiontype) |
| \`Args\` | extends [\`DefaultFunctionArgs\`](https://docs.convex.dev/api/modules/server#defaultfunctionargs) = \`any\` |
| \`ReturnType\` | \`any\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-10 \"Direct link to Defined in\")

[server/components/index.ts:35](https://github.com/get-convex/convex-js/blob/main/src/server/components/index.ts#L35)

* * *

### ComponentDefinition [​](https://docs.convex.dev/api/modules/server\\#componentdefinition \"Direct link to ComponentDefinition\")

Ƭ **ComponentDefinition** < \`Exports\` >: \`Object\`

An object of this type should be the default export of a
convex.config.ts file in a component definition directory.

This is a feature of components, which are in beta.
This API is unstable and may change in subsequent releases.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-9 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Exports\` | extends \`ComponentExports\` = \`any\` |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-1 \"Direct link to Type declaration\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`use\` | <Definition>( \`definition\`: \`Definition\`, \`options?\`: { \`name?\`: \`string\` }) =\\> \`InstalledComponent\` < \`Definition\` > | Install a component with the given definition in this component definition. Takes a component definition and an optional name. For editor tooling this method expects a [ComponentDefinition](https://docs.convex.dev/api/modules/server#componentdefinition) but at runtime the object that is imported will be a ImportedComponentDefinition |
| \`__exports\` | \`Exports\` | Internal type-only property tracking exports provided. **\`Deprecated\`** This is a type-only property, don't use it. |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-11 \"Direct link to Defined in\")

[server/components/index.ts:84](https://github.com/get-convex/convex-js/blob/main/src/server/components/index.ts#L84)

* * *

### AnyComponents [​](https://docs.convex.dev/api/modules/server\\#anycomponents \"Direct link to AnyComponents\")

Ƭ **AnyComponents**: \`AnyChildComponents\`

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-12 \"Direct link to Defined in\")

[server/components/index.ts:442](https://github.com/get-convex/convex-js/blob/main/src/server/components/index.ts#L442)

* * *

### GenericDocument [​](https://docs.convex.dev/api/modules/server\\#genericdocument \"Direct link to GenericDocument\")

Ƭ **GenericDocument**: \`Record\` < \`string\`, [\`Value\`](https://docs.convex.dev/api/modules/values#value) >

A document stored in Convex.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-13 \"Direct link to Defined in\")

[server/data\\_model.ts:9](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L9)

* * *

### GenericFieldPaths [​](https://docs.convex.dev/api/modules/server\\#genericfieldpaths \"Direct link to GenericFieldPaths\")

Ƭ **GenericFieldPaths**: \`string\`

A type describing all of the document fields in a table.

These can either be field names (like \"name\") or references to fields on
nested objects (like \"properties.name\").

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-14 \"Direct link to Defined in\")

[server/data\\_model.ts:18](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L18)

* * *

### GenericIndexFields [​](https://docs.convex.dev/api/modules/server\\#genericindexfields \"Direct link to GenericIndexFields\")

Ƭ **GenericIndexFields**: \`string\`\\[\\]

A type describing the ordered fields in an index.

These can either be field names (like \"name\") or references to fields on
nested objects (like \"properties.name\").

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-15 \"Direct link to Defined in\")

[server/data\\_model.ts:29](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L29)

* * *

### GenericTableIndexes [​](https://docs.convex.dev/api/modules/server\\#generictableindexes \"Direct link to GenericTableIndexes\")

Ƭ **GenericTableIndexes**: \`Record\` < \`string\`, [\`GenericIndexFields\`](https://docs.convex.dev/api/modules/server#genericindexfields) >

A type describing the indexes in a table.

It's an object mapping each index name to the fields in the index.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-16 \"Direct link to Defined in\")

[server/data\\_model.ts:37](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L37)

* * *

### GenericSearchIndexConfig [​](https://docs.convex.dev/api/modules/server\\#genericsearchindexconfig \"Direct link to GenericSearchIndexConfig\")

Ƭ **GenericSearchIndexConfig**: \`Object\`

A type describing the configuration of a search index.

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-2 \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`searchField\` | \`string\` |
| \`filterFields\` | \`string\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-17 \"Direct link to Defined in\")

[server/data\\_model.ts:43](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L43)

* * *

### GenericTableSearchIndexes [​](https://docs.convex.dev/api/modules/server\\#generictablesearchindexes \"Direct link to GenericTableSearchIndexes\")

Ƭ **GenericTableSearchIndexes**: \`Record\` < \`string\`, [\`GenericSearchIndexConfig\`](https://docs.convex.dev/api/modules/server#genericsearchindexconfig) >

A type describing all of the search indexes in a table.

This is an object mapping each index name to the config for the index.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-18 \"Direct link to Defined in\")

[server/data\\_model.ts:54](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L54)

* * *

### GenericVectorIndexConfig [​](https://docs.convex.dev/api/modules/server\\#genericvectorindexconfig \"Direct link to GenericVectorIndexConfig\")

Ƭ **GenericVectorIndexConfig**: \`Object\`

A type describing the configuration of a vector index.

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-3 \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`vectorField\` | \`string\` |
| \`dimensions\` | \`number\` |
| \`filterFields\` | \`string\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-19 \"Direct link to Defined in\")

[server/data\\_model.ts:63](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L63)

* * *

### GenericTableVectorIndexes [​](https://docs.convex.dev/api/modules/server\\#generictablevectorindexes \"Direct link to GenericTableVectorIndexes\")

Ƭ **GenericTableVectorIndexes**: \`Record\` < \`string\`, [\`GenericVectorIndexConfig\`](https://docs.convex.dev/api/modules/server#genericvectorindexconfig) >

A type describing all of the vector indexes in a table.

This is an object mapping each index name to the config for the index.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-20 \"Direct link to Defined in\")

[server/data\\_model.ts:75](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L75)

* * *

### FieldTypeFromFieldPath [​](https://docs.convex.dev/api/modules/server\\#fieldtypefromfieldpath \"Direct link to FieldTypeFromFieldPath\")

Ƭ **FieldTypeFromFieldPath** < \`Document\`, \`FieldPath\` >: [\`FieldTypeFromFieldPathInner\`](https://docs.convex.dev/api/modules/server#fieldtypefromfieldpathinner) < \`Document\`, \`FieldPath\` \\> extends [\`Value\`](https://docs.convex.dev/api/modules/values#value) \\| \`undefined\` ? [\`FieldTypeFromFieldPathInner\`](https://docs.convex.dev/api/modules/server#fieldtypefromfieldpathinner) < \`Document\`, \`FieldPath\` \\> : [\`Value\`](https://docs.convex.dev/api/modules/values#value) \\| \`undefined\`

The type of a field in a document.

Note that this supports both simple fields like \"name\" and nested fields like
\"properties.name\".

If the field is not present in the document it is considered to be \`undefined\`.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-10 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Document\` | extends [\`GenericDocument\`](https://docs.convex.dev/api/modules/server#genericdocument) |
| \`FieldPath\` | extends \`string\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-21 \"Direct link to Defined in\")

[server/data\\_model.ts:104](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L104)

* * *

### FieldTypeFromFieldPathInner [​](https://docs.convex.dev/api/modules/server\\#fieldtypefromfieldpathinner \"Direct link to FieldTypeFromFieldPathInner\")

Ƭ **FieldTypeFromFieldPathInner** < \`Document\`, \`FieldPath\` >: \`ValueFromUnion\`<\`Document\`, \`FieldPath\`, \`undefined\`>

The inner type of [FieldTypeFromFieldPath](https://docs.convex.dev/api/modules/server#fieldtypefromfieldpath).

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-11 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Document\` | extends [\`GenericDocument\`](https://docs.convex.dev/api/modules/server#genericdocument) |
| \`FieldPath\` | extends \`string\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-22 \"Direct link to Defined in\")

[server/data\\_model.ts:120](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L120)

* * *

### GenericTableInfo [​](https://docs.convex.dev/api/modules/server\\#generictableinfo \"Direct link to GenericTableInfo\")

Ƭ **GenericTableInfo**: \`Object\`

A type describing the document type and indexes in a table.

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-4 \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`document\` | [\`GenericDocument\`](https://docs.convex.dev/api/modules/server#genericdocument) |
| \`fieldPaths\` | [\`GenericFieldPaths\`](https://docs.convex.dev/api/modules/server#genericfieldpaths) |
| \`indexes\` | [\`GenericTableIndexes\`](https://docs.convex.dev/api/modules/server#generictableindexes) |
| \`searchIndexes\` | [\`GenericTableSearchIndexes\`](https://docs.convex.dev/api/modules/server#generictablesearchindexes) |
| \`vectorIndexes\` | [\`GenericTableVectorIndexes\`](https://docs.convex.dev/api/modules/server#generictablevectorindexes) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-23 \"Direct link to Defined in\")

[server/data\\_model.ts:151](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L151)

* * *

### DocumentByInfo [​](https://docs.convex.dev/api/modules/server\\#documentbyinfo \"Direct link to DocumentByInfo\")

Ƭ **DocumentByInfo** < \`TableInfo\` >: \`TableInfo\`\\[ \`\"document\"\`\\]

The type of a document in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-12 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-24 \"Direct link to Defined in\")

[server/data\\_model.ts:163](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L163)

* * *

### FieldPaths [​](https://docs.convex.dev/api/modules/server\\#fieldpaths \"Direct link to FieldPaths\")

Ƭ **FieldPaths** < \`TableInfo\` >: \`TableInfo\`\\[ \`\"fieldPaths\"\`\\]

The field paths in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

These can either be field names (like \"name\") or references to fields on
nested objects (like \"properties.name\").

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-13 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-25 \"Direct link to Defined in\")

[server/data\\_model.ts:173](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L173)

* * *

### Indexes [​](https://docs.convex.dev/api/modules/server\\#indexes \"Direct link to Indexes\")

Ƭ **Indexes** < \`TableInfo\` >: \`TableInfo\`\\[ \`\"indexes\"\`\\]

The database indexes in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

This will be an object mapping index names to the fields in the index.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-14 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-26 \"Direct link to Defined in\")

[server/data\\_model.ts:182](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L182)

* * *

### IndexNames [​](https://docs.convex.dev/api/modules/server\\#indexnames \"Direct link to IndexNames\")

Ƭ **IndexNames** < \`TableInfo\` >: keyof [\`Indexes\`](https://docs.convex.dev/api/modules/server#indexes) < \`TableInfo\` >

The names of indexes in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-15 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-27 \"Direct link to Defined in\")

[server/data\\_model.ts:188](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L188)

* * *

### NamedIndex [​](https://docs.convex.dev/api/modules/server\\#namedindex \"Direct link to NamedIndex\")

Ƭ **NamedIndex** < \`TableInfo\`, \`IndexName\` >: [\`Indexes\`](https://docs.convex.dev/api/modules/server#indexes) < \`TableInfo\` >\\[ \`IndexName\`\\]

Extract the fields of an index from a [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo) by name.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-16 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |
| \`IndexName\` | extends [\`IndexNames\`](https://docs.convex.dev/api/modules/server#indexnames) < \`TableInfo\` > |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-28 \"Direct link to Defined in\")

[server/data\\_model.ts:195](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L195)

* * *

### SearchIndexes [​](https://docs.convex.dev/api/modules/server\\#searchindexes \"Direct link to SearchIndexes\")

Ƭ **SearchIndexes** < \`TableInfo\` >: \`TableInfo\`\\[ \`\"searchIndexes\"\`\\]

The search indexes in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

This will be an object mapping index names to the search index config.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-17 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-29 \"Direct link to Defined in\")

[server/data\\_model.ts:206](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L206)

* * *

### SearchIndexNames [​](https://docs.convex.dev/api/modules/server\\#searchindexnames \"Direct link to SearchIndexNames\")

Ƭ **SearchIndexNames** < \`TableInfo\` >: keyof [\`SearchIndexes\`](https://docs.convex.dev/api/modules/server#searchindexes) < \`TableInfo\` >

The names of search indexes in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-18 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-30 \"Direct link to Defined in\")

[server/data\\_model.ts:213](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L213)

* * *

### NamedSearchIndex [​](https://docs.convex.dev/api/modules/server\\#namedsearchindex \"Direct link to NamedSearchIndex\")

Ƭ **NamedSearchIndex** < \`TableInfo\`, \`IndexName\` >: [\`SearchIndexes\`](https://docs.convex.dev/api/modules/server#searchindexes) < \`TableInfo\` >\\[ \`IndexName\`\\]

Extract the config of a search index from a [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo) by name.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-19 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |
| \`IndexName\` | extends [\`SearchIndexNames\`](https://docs.convex.dev/api/modules/server#searchindexnames) < \`TableInfo\` > |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-31 \"Direct link to Defined in\")

[server/data\\_model.ts:220](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L220)

* * *

### VectorIndexes [​](https://docs.convex.dev/api/modules/server\\#vectorindexes \"Direct link to VectorIndexes\")

Ƭ **VectorIndexes** < \`TableInfo\` >: \`TableInfo\`\\[ \`\"vectorIndexes\"\`\\]

The vector indexes in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

This will be an object mapping index names to the vector index config.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-20 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-32 \"Direct link to Defined in\")

[server/data\\_model.ts:231](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L231)

* * *

### VectorIndexNames [​](https://docs.convex.dev/api/modules/server\\#vectorindexnames \"Direct link to VectorIndexNames\")

Ƭ **VectorIndexNames** < \`TableInfo\` >: keyof [\`VectorIndexes\`](https://docs.convex.dev/api/modules/server#vectorindexes) < \`TableInfo\` >

The names of vector indexes in a table for a given [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo).

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-21 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-33 \"Direct link to Defined in\")

[server/data\\_model.ts:238](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L238)

* * *

### NamedVectorIndex [​](https://docs.convex.dev/api/modules/server\\#namedvectorindex \"Direct link to NamedVectorIndex\")

Ƭ **NamedVectorIndex** < \`TableInfo\`, \`IndexName\` >: [\`VectorIndexes\`](https://docs.convex.dev/api/modules/server#vectorindexes) < \`TableInfo\` >\\[ \`IndexName\`\\]

Extract the config of a vector index from a [GenericTableInfo](https://docs.convex.dev/api/modules/server#generictableinfo) by name.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-22 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableInfo\` | extends [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) |
| \`IndexName\` | extends [\`VectorIndexNames\`](https://docs.convex.dev/api/modules/server#vectorindexnames) < \`TableInfo\` > |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-34 \"Direct link to Defined in\")

[server/data\\_model.ts:245](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L245)

* * *

### GenericDataModel [​](https://docs.convex.dev/api/modules/server\\#genericdatamodel \"Direct link to GenericDataModel\")

Ƭ **GenericDataModel**: \`Record\` < \`string\`, [\`GenericTableInfo\`](https://docs.convex.dev/api/modules/server#generictableinfo) >

A type describing the tables in a Convex project.

This is designed to be code generated with \`npx convex dev\`.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-35 \"Direct link to Defined in\")

[server/data\\_model.ts:258](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L258)

* * *

### AnyDataModel [​](https://docs.convex.dev/api/modules/server\\#anydatamodel \"Direct link to AnyDataModel\")

Ƭ **AnyDataModel**: \`Object\`

A [GenericDataModel](https://docs.convex.dev/api/modules/server#genericdatamodel) that considers documents to be \`any\` and does not
support indexes.

This is the default before a schema is defined.

#### Index signature [​](https://docs.convex.dev/api/modules/server\\#index-signature \"Direct link to Index signature\")

▪ \\[tableName: \`string\`\\]: { \`document\`: \`any\` ; \`fieldPaths\`: [\`GenericFieldPaths\`](https://docs.convex.dev/api/modules/server#genericfieldpaths) ; \`indexes\`:  ; \`searchIndexes\`:  ; \`vectorIndexes\`:  }

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-36 \"Direct link to Defined in\")

[server/data\\_model.ts:267](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L267)

* * *

### TableNamesInDataModel [​](https://docs.convex.dev/api/modules/server\\#tablenamesindatamodel \"Direct link to TableNamesInDataModel\")

Ƭ **TableNamesInDataModel** < \`DataModel\` >: keyof \`DataModel\` & \`string\`

A type of all of the table names defined in a [GenericDataModel](https://docs.convex.dev/api/modules/server#genericdatamodel).

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-23 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-37 \"Direct link to Defined in\")

[server/data\\_model.ts:281](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L281)

* * *

### NamedTableInfo [​](https://docs.convex.dev/api/modules/server\\#namedtableinfo \"Direct link to NamedTableInfo\")

Ƭ **NamedTableInfo** < \`DataModel\`, \`TableName\` >: \`DataModel\`\\[ \`TableName\`\\]

Extract the \`TableInfo\` for a table in a [GenericDataModel](https://docs.convex.dev/api/modules/server#genericdatamodel) by table
name.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-24 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`TableName\` | extends keyof \`DataModel\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-38 \"Direct link to Defined in\")

[server/data\\_model.ts:290](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L290)

* * *

### DocumentByName [​](https://docs.convex.dev/api/modules/server\\#documentbyname \"Direct link to DocumentByName\")

Ƭ **DocumentByName** < \`DataModel\`, \`TableName\` >: \`DataModel\`\\[ \`TableName\`\\]\\[ \`\"document\"\`\\]

The type of a document in a [GenericDataModel](https://docs.convex.dev/api/modules/server#genericdatamodel) by table name.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-25 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`TableName\` | extends [\`TableNamesInDataModel\`](https://docs.convex.dev/api/modules/server#tablenamesindatamodel) < \`DataModel\` > |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-39 \"Direct link to Defined in\")

[server/data\\_model.ts:299](https://github.com/get-convex/convex-js/blob/main/src/server/data_model.ts#L299)

* * *

### ExpressionOrValue [​](https://docs.convex.dev/api/modules/server\\#expressionorvalue \"Direct link to ExpressionOrValue\")

Ƭ **ExpressionOrValue** < \`T\` >: [\`Expression\`](https://docs.convex.dev/api/classes/server.Expression) < \`T\` \\> \\| \`T\`

An [Expression](https://docs.convex.dev/api/classes/server.Expression) or a constant [Value](https://docs.convex.dev/api/modules/values#value)

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-26 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`T\` | extends [\`Value\`](https://docs.convex.dev/api/modules/values#value) \\| \`undefined\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-40 \"Direct link to Defined in\")

[server/filter\\_builder.ts:38](https://github.com/get-convex/convex-js/blob/main/src/server/filter_builder.ts#L38)

* * *

### Cursor [​](https://docs.convex.dev/api/modules/server\\#cursor \"Direct link to Cursor\")

Ƭ **Cursor**: \`string\`

An opaque identifier used for paginating a database query.

Cursors are returned from [paginate](https://docs.convex.dev/api/interfaces/server.OrderedQuery#paginate) and represent the
point of the query where the page of results ended.

To continue paginating, pass the cursor back into
[paginate](https://docs.convex.dev/api/interfaces/server.OrderedQuery#paginate) in the [PaginationOptions](https://docs.convex.dev/api/interfaces/server.PaginationOptions) object to
fetch another page of results.

Note: Cursors can only be passed to _exactly_ the same database query that
they were generated from. You may not reuse a cursor between different
database queries.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-41 \"Direct link to Defined in\")

[server/pagination.ts:19](https://github.com/get-convex/convex-js/blob/main/src/server/pagination.ts#L19)

* * *

### GenericMutationCtxWithTable [​](https://docs.convex.dev/api/modules/server\\#genericmutationctxwithtable \"Direct link to GenericMutationCtxWithTable\")

Ƭ **GenericMutationCtxWithTable** < \`DataModel\` >: \`Omit\` < [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`DataModel\` >, \`\"db\"\` \\> & { \`db\`: [\`GenericDatabaseWriterWithTable\`](https://docs.convex.dev/api/interfaces/server.GenericDatabaseWriterWithTable) < \`DataModel\` \\> }

A set of services for use within Convex mutation functions.

The mutation context is passed as the first argument to any Convex mutation
function run on the server.

If you're using code generation, use the \`MutationCtx\` type in
\`convex/_generated/server.d.ts\` which is typed for your data model.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-27 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-42 \"Direct link to Defined in\")

[server/registration.ts:109](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L109)

* * *

### GenericQueryCtxWithTable [​](https://docs.convex.dev/api/modules/server\\#genericqueryctxwithtable \"Direct link to GenericQueryCtxWithTable\")

Ƭ **GenericQueryCtxWithTable** < \`DataModel\` >: \`Omit\` < [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`DataModel\` >, \`\"db\"\` \\> & { \`db\`: [\`GenericDatabaseReaderWithTable\`](https://docs.convex.dev/api/interfaces/server.GenericDatabaseReaderWithTable) < \`DataModel\` \\> }

A set of services for use within Convex query functions.

The query context is passed as the first argument to any Convex query
function run on the server.

This differs from the MutationCtx because all of the services are
read-only.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-28 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-43 \"Direct link to Defined in\")

[server/registration.ts:167](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L167)

* * *

### DefaultFunctionArgs [​](https://docs.convex.dev/api/modules/server\\#defaultfunctionargs \"Direct link to DefaultFunctionArgs\")

Ƭ **DefaultFunctionArgs**: \`Record\` < \`string\`, \`unknown\` >

The default arguments type for a Convex query, mutation, or action function.

Convex functions always take an arguments object that maps the argument
names to their values.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-44 \"Direct link to Defined in\")

[server/registration.ts:278](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L278)

* * *

### ArgsArray [​](https://docs.convex.dev/api/modules/server\\#argsarray \"Direct link to ArgsArray\")

Ƭ **ArgsArray**: \`OneArgArray\` \\| \`NoArgsArray\`

An array of arguments to a Convex function.

Convex functions can take either a single [DefaultFunctionArgs](https://docs.convex.dev/api/modules/server#defaultfunctionargs) object or no
args at all.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-45 \"Direct link to Defined in\")

[server/registration.ts:301](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L301)

* * *

### ArgsArrayToObject [​](https://docs.convex.dev/api/modules/server\\#argsarraytoobject \"Direct link to ArgsArrayToObject\")

Ƭ **ArgsArrayToObject** < \`Args\` >: \`Args\` extends \`OneArgArray\` <infer ArgsObject> ? \`ArgsObject\` : \`EmptyObject\`

Convert an [ArgsArray](https://docs.convex.dev/api/modules/server#argsarray) into a single object type.

Empty arguments arrays are converted to EmptyObject.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-29 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Args\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-46 \"Direct link to Defined in\")

[server/registration.ts:316](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L316)

* * *

### FunctionVisibility [​](https://docs.convex.dev/api/modules/server\\#functionvisibility \"Direct link to FunctionVisibility\")

Ƭ **FunctionVisibility**: \`\"public\"\` \\| \`\"internal\"\`

A type representing the visibility of a Convex function.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-47 \"Direct link to Defined in\")

[server/registration.ts:324](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L324)

* * *

### RegisteredMutation [​](https://docs.convex.dev/api/modules/server\\#registeredmutation \"Direct link to RegisteredMutation\")

Ƭ **RegisteredMutation** < \`Visibility\`, \`Args\`, \`Returns\` >: ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`any\` >, \`args\`: \`Args\`) =\\> \`Returns\` & \`VisibilityProperties\` < \`Visibility\` >

A mutation function that is part of this app.

You can create a mutation by wrapping your function in
[mutationGeneric](https://docs.convex.dev/api/modules/server#mutationgeneric) or [internalMutationGeneric](https://docs.convex.dev/api/modules/server#internalmutationgeneric) and exporting it.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-30 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |
| \`Args\` | extends [\`DefaultFunctionArgs\`](https://docs.convex.dev/api/modules/server#defaultfunctionargs) |
| \`Returns\` | \`Returns\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-48 \"Direct link to Defined in\")

[server/registration.ts:347](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L347)

* * *

### RegisteredQuery [​](https://docs.convex.dev/api/modules/server\\#registeredquery \"Direct link to RegisteredQuery\")

Ƭ **RegisteredQuery** < \`Visibility\`, \`Args\`, \`Returns\` >: ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`any\` >, \`args\`: \`Args\`) =\\> \`Returns\` & \`VisibilityProperties\` < \`Visibility\` >

A query function that is part of this app.

You can create a query by wrapping your function in
[queryGeneric](https://docs.convex.dev/api/modules/server#querygeneric) or [internalQueryGeneric](https://docs.convex.dev/api/modules/server#internalquerygeneric) and exporting it.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-31 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |
| \`Args\` | extends [\`DefaultFunctionArgs\`](https://docs.convex.dev/api/modules/server#defaultfunctionargs) |
| \`Returns\` | \`Returns\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-49 \"Direct link to Defined in\")

[server/registration.ts:378](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L378)

* * *

### RegisteredAction [​](https://docs.convex.dev/api/modules/server\\#registeredaction \"Direct link to RegisteredAction\")

Ƭ **RegisteredAction** < \`Visibility\`, \`Args\`, \`Returns\` >: ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` >, \`args\`: \`Args\`) =\\> \`Returns\` & \`VisibilityProperties\` < \`Visibility\` >

An action that is part of this app.

You can create an action by wrapping your function in
[actionGeneric](https://docs.convex.dev/api/modules/server#actiongeneric) or [internalActionGeneric](https://docs.convex.dev/api/modules/server#internalactiongeneric) and exporting it.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-32 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |
| \`Args\` | extends [\`DefaultFunctionArgs\`](https://docs.convex.dev/api/modules/server#defaultfunctionargs) |
| \`Returns\` | \`Returns\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-50 \"Direct link to Defined in\")

[server/registration.ts:409](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L409)

* * *

### PublicHttpAction [​](https://docs.convex.dev/api/modules/server\\#publichttpaction \"Direct link to PublicHttpAction\")

Ƭ **PublicHttpAction**: \`Object\`

#### Call signature [​](https://docs.convex.dev/api/modules/server\\#call-signature \"Direct link to Call signature\")

▸ ( \`ctx\`, \`request\`): \`Promise\` < \`Response\` >

An HTTP action that is part of this app's public API.

You can create public HTTP actions by wrapping your function in
[httpActionGeneric](https://docs.convex.dev/api/modules/server#httpactiongeneric) and exporting it.

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`ctx\` | [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` > |
| \`request\` | \`Request\` |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns \"Direct link to Returns\")

\`Promise\` < \`Response\` >

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-5 \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`isHttp\` | \`true\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-51 \"Direct link to Defined in\")

[server/registration.ts:440](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L440)

* * *

### UnvalidatedFunction [​](https://docs.convex.dev/api/modules/server\\#unvalidatedfunction \"Direct link to UnvalidatedFunction\")

Ƭ **UnvalidatedFunction** < \`Ctx\`, \`Args\`, \`Returns\` >: ( \`ctx\`: \`Ctx\`, ... \`args\`: \`Args\`) =\\> \`Returns\` \\| { \`handler\`: ( \`ctx\`: \`Ctx\`, ... \`args\`: \`Args\`) =\\> \`Returns\` }

**\`Deprecated\`**

\\-\\- See the type definition for \`MutationBuilder\` or similar for
the types used for defining Convex functions.

The definition of a Convex query, mutation, or action function without
argument validation.

Convex functions always take a context object as their first argument
and an (optional) args object as their second argument.

This can be written as a function like:

\`\`\`codeBlockLines_zEuJ
import { query } from \"./_generated/server\";

export const func = query(({ db }, { arg }) => {...});

\`\`\`

or as an object like:

\`\`\`codeBlockLines_zEuJ
import { query } from \"./_generated/server\";

export const func = query({
  handler: ({ db }, { arg }) => {...},
});

\`\`\`

See [ValidatedFunction](https://docs.convex.dev/api/interfaces/server.ValidatedFunction) to add argument validation.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-33 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Ctx\` | \`Ctx\` |
| \`Args\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) |
| \`Returns\` | \`Returns\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-52 \"Direct link to Defined in\")

[server/registration.ts:479](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L479)

* * *

### ReturnValueForOptionalValidator [​](https://docs.convex.dev/api/modules/server\\#returnvalueforoptionalvalidator \"Direct link to ReturnValueForOptionalValidator\")

Ƭ **ReturnValueForOptionalValidator** < \`ReturnsValidator\` >: \\[ \`ReturnsValidator\`\\] extends \\[ [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`any\`, \`any\` >\\] ? \`ValidatorTypeToReturnType\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ReturnsValidator\` >\\> : \\[ \`ReturnsValidator\`\\] extends \\[ [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators)\\] ? \`ValidatorTypeToReturnType\` < [\`ObjectType\`](https://docs.convex.dev/api/modules/values#objecttype) < \`ReturnsValidator\` >\\> : \`any\`

There are multiple syntaxes for defining a Convex function:

\`\`\`codeBlockLines_zEuJ
 - query(async (ctx, args) => {...})
 - query({ handler: async (ctx, args) => {...} })
 - query({ args: { a: v.string }, handler: async (ctx, args) => {...} } })
 - query({ args: { a: v.string }, returns: v.string(), handler: async (ctx, args) => {...} } })

\`\`\`

In each of these, we want to correctly infer the type for the arguments and
return value, preferring the type derived from a validator if it's provided.

To avoid having a separate overload for each, which would show up in error messages,
we use the type params -- ArgsValidator, ReturnsValidator, ReturnValue, OneOrZeroArgs.

The type for ReturnValue and OneOrZeroArgs are constrained by the type or ArgsValidator and
ReturnsValidator if they're present, and inferred from any explicit type annotations to the
arguments or return value of the function.

Below are a few utility types to get the appropriate type constraints based on
an optional validator.

Additional tricks:

- We use Validator \\| void instead of Validator \\| undefined because the latter does
not work with \`strictNullChecks\` since it's equivalent to just \`Validator\`.
- We use a tuple type of length 1 to avoid distribution over the union
[https://github.com/microsoft/TypeScript/issues/29368#issuecomment-453529532](https://github.com/microsoft/TypeScript/issues/29368#issuecomment-453529532)

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-34 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ReturnsValidator\` | extends [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`any\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) \\| \`void\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-53 \"Direct link to Defined in\")

[server/registration.ts:581](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L581)

* * *

### ArgsArrayForOptionalValidator [​](https://docs.convex.dev/api/modules/server\\#argsarrayforoptionalvalidator \"Direct link to ArgsArrayForOptionalValidator\")

Ƭ **ArgsArrayForOptionalValidator** < \`ArgsValidator\` >: \\[ \`ArgsValidator\`\\] extends \\[ [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`any\`, \`any\` >\\] ? \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> : \\[ \`ArgsValidator\`\\] extends \\[ [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators)\\] ? \`OneArgArray\` < [\`ObjectType\`](https://docs.convex.dev/api/modules/values#objecttype) < \`ArgsValidator\` >\\> : [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray)

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-35 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends [\`GenericValidator\`](https://docs.convex.dev/api/modules/values#genericvalidator) \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) \\| \`void\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-54 \"Direct link to Defined in\")

[server/registration.ts:589](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L589)

* * *

### DefaultArgsForOptionalValidator [​](https://docs.convex.dev/api/modules/server\\#defaultargsforoptionalvalidator \"Direct link to DefaultArgsForOptionalValidator\")

Ƭ **DefaultArgsForOptionalValidator** < \`ArgsValidator\` >: \\[ \`ArgsValidator\`\\] extends \\[ [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`any\`, \`any\` >\\] ? \\[ [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\] : \\[ \`ArgsValidator\`\\] extends \\[ [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators)\\] ? \\[ [\`ObjectType\`](https://docs.convex.dev/api/modules/values#objecttype) < \`ArgsValidator\` >\\] : \`OneArgArray\`

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-36 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends [\`GenericValidator\`](https://docs.convex.dev/api/modules/values#genericvalidator) \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) \\| \`void\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-55 \"Direct link to Defined in\")

[server/registration.ts:597](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L597)

* * *

### MutationBuilder [​](https://docs.convex.dev/api/modules/server\\#mutationbuilder \"Direct link to MutationBuilder\")

Ƭ **MutationBuilder** < \`DataModel\`, \`Visibility\` >: <ArgsValidator, ReturnsValidator, ReturnValue, OneOrZeroArgs>( \`mutation\`: { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\`) =\\> [\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-37 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-6 \"Direct link to Type declaration\")

▸ < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`mutation\`): [\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Internal type helper used by Convex code generation.

Used to give [mutationGeneric](https://docs.convex.dev/api/modules/server#mutationgeneric) a type specific to your data model.

##### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-38 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-1 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`mutation\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-1 \"Direct link to Returns\")

[\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-56 \"Direct link to Defined in\")

[server/registration.ts:611](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L611)

* * *

### MutationBuilderWithTable [​](https://docs.convex.dev/api/modules/server\\#mutationbuilderwithtable \"Direct link to MutationBuilderWithTable\")

Ƭ **MutationBuilderWithTable** < \`DataModel\`, \`Visibility\` >: <ArgsValidator, ReturnsValidator, ReturnValue, OneOrZeroArgs>( \`mutation\`: { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericMutationCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericmutationctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericMutationCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericmutationctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\`) =\\> [\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-39 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-7 \"Direct link to Type declaration\")

▸ < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`mutation\`): [\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Internal type helper used by Convex code generation.

Used to give [mutationGeneric](https://docs.convex.dev/api/modules/server#mutationgeneric) a type specific to your data model.

##### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-40 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-2 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`mutation\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericMutationCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericmutationctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericMutationCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericmutationctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-2 \"Direct link to Returns\")

[\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-57 \"Direct link to Defined in\")

[server/registration.ts:704](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L704)

* * *

### QueryBuilder [​](https://docs.convex.dev/api/modules/server\\#querybuilder \"Direct link to QueryBuilder\")

Ƭ **QueryBuilder** < \`DataModel\`, \`Visibility\` >: <ArgsValidator, ReturnsValidator, ReturnValue, OneOrZeroArgs>( \`query\`: { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\`) =\\> [\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-41 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-8 \"Direct link to Type declaration\")

▸ < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`query\`): [\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Internal type helper used by Convex code generation.

Used to give [queryGeneric](https://docs.convex.dev/api/modules/server#querygeneric) a type specific to your data model.

##### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-42 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-3 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`query\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-3 \"Direct link to Returns\")

[\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-58 \"Direct link to Defined in\")

[server/registration.ts:797](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L797)

* * *

### QueryBuilderWithTable [​](https://docs.convex.dev/api/modules/server\\#querybuilderwithtable \"Direct link to QueryBuilderWithTable\")

Ƭ **QueryBuilderWithTable** < \`DataModel\`, \`Visibility\` >: <ArgsValidator, ReturnsValidator, ReturnValue, OneOrZeroArgs>( \`query\`: { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericQueryCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericqueryctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericQueryCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericqueryctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\`) =\\> [\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-43 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-9 \"Direct link to Type declaration\")

▸ < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`query\`): [\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Internal type helper used by Convex code generation.

Used to give [queryGeneric](https://docs.convex.dev/api/modules/server#querygeneric) a type specific to your data model.

##### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-44 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-4 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`query\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericQueryCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericqueryctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericQueryCtxWithTable\`](https://docs.convex.dev/api/modules/server#genericqueryctxwithtable) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-4 \"Direct link to Returns\")

[\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-59 \"Direct link to Defined in\")

[server/registration.ts:886](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L886)

* * *

### ActionBuilder [​](https://docs.convex.dev/api/modules/server\\#actionbuilder \"Direct link to ActionBuilder\")

Ƭ **ActionBuilder** < \`DataModel\`, \`Visibility\` >: <ArgsValidator, ReturnsValidator, ReturnValue, OneOrZeroArgs>( \`func\`: { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\`) =\\> [\`RegisteredAction\`](https://docs.convex.dev/api/modules/server#registeredaction) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-45 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`Visibility\` | extends [\`FunctionVisibility\`](https://docs.convex.dev/api/modules/server#functionvisibility) |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-10 \"Direct link to Type declaration\")

▸ < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`func\`): [\`RegisteredAction\`](https://docs.convex.dev/api/modules/server#registeredaction) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Internal type helper used by Convex code generation.

Used to give [actionGeneric](https://docs.convex.dev/api/modules/server#actiongeneric) a type specific to your data model.

##### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-46 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-5 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`func\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`DataModel\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-5 \"Direct link to Returns\")

[\`RegisteredAction\`](https://docs.convex.dev/api/modules/server#registeredaction) < \`Visibility\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-60 \"Direct link to Defined in\")

[server/registration.ts:975](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L975)

* * *

### HttpActionBuilder [​](https://docs.convex.dev/api/modules/server\\#httpactionbuilder \"Direct link to HttpActionBuilder\")

Ƭ **HttpActionBuilder**: ( \`func\`: ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` >, \`request\`: \`Request\`) =\\> \`Promise\` < \`Response\` >) =\\> [\`PublicHttpAction\`](https://docs.convex.dev/api/modules/server#publichttpaction)

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-11 \"Direct link to Type declaration\")

▸ ( \`func\`): [\`PublicHttpAction\`](https://docs.convex.dev/api/modules/server#publichttpaction)

Internal type helper used by Convex code generation.

Used to give [httpActionGeneric](https://docs.convex.dev/api/modules/server#httpactiongeneric) a type specific to your data model
and functions.

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-6 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`func\` | ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` >, \`request\`: \`Request\`) =\\> \`Promise\` < \`Response\` > |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-6 \"Direct link to Returns\")

[\`PublicHttpAction\`](https://docs.convex.dev/api/modules/server#publichttpaction)

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-61 \"Direct link to Defined in\")

[server/registration.ts:1070](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L1070)

* * *

### RoutableMethod [​](https://docs.convex.dev/api/modules/server\\#routablemethod \"Direct link to RoutableMethod\")

Ƭ **RoutableMethod**: typeof [\`ROUTABLE_HTTP_METHODS\`](https://docs.convex.dev/api/modules/server#routable_http_methods)\\[ \`number\`\\]

A type representing the methods supported by Convex HTTP actions.

HEAD is handled by Convex by running GET and stripping the body.
CONNECT is not supported and will not be supported.
TRACE is not supported and will not be supported.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-62 \"Direct link to Defined in\")

[server/router.ts:31](https://github.com/get-convex/convex-js/blob/main/src/server/router.ts#L31)

* * *

### RouteSpecWithPath [​](https://docs.convex.dev/api/modules/server\\#routespecwithpath \"Direct link to RouteSpecWithPath\")

Ƭ **RouteSpecWithPath**: \`Object\`

A type representing a route to an HTTP action using an exact request URL path match.

Used by [HttpRouter](https://docs.convex.dev/api/classes/server.HttpRouter) to route requests to HTTP actions.

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-12 \"Direct link to Type declaration\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`path\` | \`string\` | Exact HTTP request path to route. |
| \`method\` | [\`RoutableMethod\`](https://docs.convex.dev/api/modules/server#routablemethod) | HTTP method (\"GET\", \"POST\", ...) to route. |
| \`handler\` | [\`PublicHttpAction\`](https://docs.convex.dev/api/modules/server#publichttpaction) | The HTTP action to execute. |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-63 \"Direct link to Defined in\")

[server/router.ts:56](https://github.com/get-convex/convex-js/blob/main/src/server/router.ts#L56)

* * *

### RouteSpecWithPathPrefix [​](https://docs.convex.dev/api/modules/server\\#routespecwithpathprefix \"Direct link to RouteSpecWithPathPrefix\")

Ƭ **RouteSpecWithPathPrefix**: \`Object\`

A type representing a route to an HTTP action using a request URL path prefix match.

Used by [HttpRouter](https://docs.convex.dev/api/classes/server.HttpRouter) to route requests to HTTP actions.

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-13 \"Direct link to Type declaration\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`pathPrefix\` | \`string\` | An HTTP request path prefix to route. Requests with a path starting with this value will be routed to the HTTP action. |
| \`method\` | [\`RoutableMethod\`](https://docs.convex.dev/api/modules/server#routablemethod) | HTTP method (\"GET\", \"POST\", ...) to route. |
| \`handler\` | [\`PublicHttpAction\`](https://docs.convex.dev/api/modules/server#publichttpaction) | The HTTP action to execute. |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-64 \"Direct link to Defined in\")

[server/router.ts:78](https://github.com/get-convex/convex-js/blob/main/src/server/router.ts#L78)

* * *

### RouteSpec [​](https://docs.convex.dev/api/modules/server\\#routespec \"Direct link to RouteSpec\")

Ƭ **RouteSpec**: [\`RouteSpecWithPath\`](https://docs.convex.dev/api/modules/server#routespecwithpath) \\| [\`RouteSpecWithPathPrefix\`](https://docs.convex.dev/api/modules/server#routespecwithpathprefix)

A type representing a route to an HTTP action.

Used by [HttpRouter](https://docs.convex.dev/api/classes/server.HttpRouter) to route requests to HTTP actions.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-65 \"Direct link to Defined in\")

[server/router.ts:101](https://github.com/get-convex/convex-js/blob/main/src/server/router.ts#L101)

* * *

### SchedulableFunctionReference [​](https://docs.convex.dev/api/modules/server\\#schedulablefunctionreference \"Direct link to SchedulableFunctionReference\")

Ƭ **SchedulableFunctionReference**: [\`FunctionReference\`](https://docs.convex.dev/api/modules/server#functionreference) < \`\"mutation\"\` \\| \`\"action\"\`, \`\"public\"\` \\| \`\"internal\"\` >

A [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference) that can be scheduled to run in the future.

Schedulable functions are mutations and actions that are public or internal.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-66 \"Direct link to Defined in\")

[server/scheduler.ts:11](https://github.com/get-convex/convex-js/blob/main/src/server/scheduler.ts#L11)

* * *

### GenericSchema [​](https://docs.convex.dev/api/modules/server\\#genericschema \"Direct link to GenericSchema\")

Ƭ **GenericSchema**: \`Record\` < \`string\`, [\`TableDefinition\`](https://docs.convex.dev/api/classes/server.TableDefinition) >

A type describing the schema of a Convex project.

This should be constructed using [defineSchema](https://docs.convex.dev/api/modules/server#defineschema), [defineTable](https://docs.convex.dev/api/modules/server#definetable),
and [v](https://docs.convex.dev/api/modules/values#v).

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-67 \"Direct link to Defined in\")

[server/schema.ts:399](https://github.com/get-convex/convex-js/blob/main/src/server/schema.ts#L399)

* * *

### DataModelFromSchemaDefinition [​](https://docs.convex.dev/api/modules/server\\#datamodelfromschemadefinition \"Direct link to DataModelFromSchemaDefinition\")

Ƭ **DataModelFromSchemaDefinition** < \`SchemaDef\` >: \`MaybeMakeLooseDataModel\` <{ \\[TableName in keyof SchemaDef\\[\"tables\"\\] & string\\]: SchemaDef\\[\"tables\"\\]\\[TableName\\] extends TableDefinition<infer DocumentType, infer Indexes, infer SearchIndexes, infer VectorIndexes> ? Object : never }, \`SchemaDef\`\\[ \`\"strictTableNameTypes\"\`\\]>

Internal type used in Convex code generation!

Convert a [SchemaDefinition](https://docs.convex.dev/api/classes/server.SchemaDefinition) into a [GenericDataModel](https://docs.convex.dev/api/modules/server#genericdatamodel).

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-47 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`SchemaDef\` | extends [\`SchemaDefinition\`](https://docs.convex.dev/api/classes/server.SchemaDefinition) < \`any\`, \`boolean\` > |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-68 \"Direct link to Defined in\")

[server/schema.ts:530](https://github.com/get-convex/convex-js/blob/main/src/server/schema.ts#L530)

* * *

### SystemTableNames [​](https://docs.convex.dev/api/modules/server\\#systemtablenames \"Direct link to SystemTableNames\")

Ƭ **SystemTableNames**: [\`TableNamesInDataModel\`](https://docs.convex.dev/api/modules/server#tablenamesindatamodel) < [\`SystemDataModel\`](https://docs.convex.dev/api/interfaces/server.SystemDataModel) >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-69 \"Direct link to Defined in\")

[server/schema.ts:588](https://github.com/get-convex/convex-js/blob/main/src/server/schema.ts#L588)

* * *

### StorageId [​](https://docs.convex.dev/api/modules/server\\#storageid \"Direct link to StorageId\")

Ƭ **StorageId**: \`string\`

A reference to a file in storage.

This is used in the [StorageReader](https://docs.convex.dev/api/interfaces/server.StorageReader) and [StorageWriter](https://docs.convex.dev/api/interfaces/server.StorageWriter) which are accessible in
Convex queries and mutations via QueryCtx and MutationCtx respectively.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-70 \"Direct link to Defined in\")

[server/storage.ts:11](https://github.com/get-convex/convex-js/blob/main/src/server/storage.ts#L11)

* * *

### FileStorageId [​](https://docs.convex.dev/api/modules/server\\#filestorageid \"Direct link to FileStorageId\")

Ƭ **FileStorageId**: [\`GenericId\`](https://docs.convex.dev/api/modules/values#genericid) < \`\"_storage\"\` \\> \\| [\`StorageId\`](https://docs.convex.dev/api/modules/server#storageid)

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-71 \"Direct link to Defined in\")

[server/storage.ts:12](https://github.com/get-convex/convex-js/blob/main/src/server/storage.ts#L12)

* * *

### FileMetadata [​](https://docs.convex.dev/api/modules/server\\#filemetadata \"Direct link to FileMetadata\")

Ƭ **FileMetadata**: \`Object\`

Metadata for a single file as returned by [storage.getMetadata](https://docs.convex.dev/api/interfaces/server.StorageReader#getmetadata).

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-14 \"Direct link to Type declaration\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`storageId\` | [\`StorageId\`](https://docs.convex.dev/api/modules/server#storageid) | ID for referencing the file (eg. via [storage.getUrl](https://docs.convex.dev/api/interfaces/server.StorageReader#geturl)) |
| \`sha256\` | \`string\` | Hex encoded sha256 checksum of file contents |
| \`size\` | \`number\` | Size of the file in bytes |
| \`contentType\` | \`string\` \\| \`null\` | ContentType of the file if it was provided on upload |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-72 \"Direct link to Defined in\")

[server/storage.ts:18](https://github.com/get-convex/convex-js/blob/main/src/server/storage.ts#L18)

* * *

### SystemFields [​](https://docs.convex.dev/api/modules/server\\#systemfields \"Direct link to SystemFields\")

Ƭ **SystemFields**: \`Object\`

The fields that Convex automatically adds to documents, not including \`_id\`.

This is an object type mapping field name to field type.

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-15 \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`_creationTime\` | \`number\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-73 \"Direct link to Defined in\")

[server/system\\_fields.ts:11](https://github.com/get-convex/convex-js/blob/main/src/server/system_fields.ts#L11)

* * *

### IdField [​](https://docs.convex.dev/api/modules/server\\#idfield \"Direct link to IdField\")

Ƭ **IdField** < \`TableName\` >: \`Object\`

The \`_id\` field that Convex automatically adds to documents.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-48 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`TableName\` | extends \`string\` |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-16 \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`_id\` | [\`GenericId\`](https://docs.convex.dev/api/modules/values#genericid) < \`TableName\` > |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-74 \"Direct link to Defined in\")

[server/system\\_fields.ts:19](https://github.com/get-convex/convex-js/blob/main/src/server/system_fields.ts#L19)

* * *

### WithoutSystemFields [​](https://docs.convex.dev/api/modules/server\\#withoutsystemfields \"Direct link to WithoutSystemFields\")

Ƭ **WithoutSystemFields** < \`Document\` >: [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) < [\`BetterOmit\`](https://docs.convex.dev/api/modules/server#betteromit) < \`Document\`, keyof [\`SystemFields\`](https://docs.convex.dev/api/modules/server#systemfields) \\| \`\"_id\"\` >>

A Convex document with the system fields like \`_id\` and \`_creationTime\` omitted.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-49 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Document\` | extends [\`GenericDocument\`](https://docs.convex.dev/api/modules/server#genericdocument) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-75 \"Direct link to Defined in\")

[server/system\\_fields.ts:28](https://github.com/get-convex/convex-js/blob/main/src/server/system_fields.ts#L28)

* * *

### WithOptionalSystemFields [​](https://docs.convex.dev/api/modules/server\\#withoptionalsystemfields \"Direct link to WithOptionalSystemFields\")

Ƭ **WithOptionalSystemFields** < \`Document\` >: [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) < [\`WithoutSystemFields\`](https://docs.convex.dev/api/modules/server#withoutsystemfields) < \`Document\` \\> & \`Partial\` < \`Pick\` < \`Document\`, keyof [\`SystemFields\`](https://docs.convex.dev/api/modules/server#systemfields) \\| \`\"_id\"\` >>>

A Convex document with the system fields like \`_id\` and \`_creationTime\` optional.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-50 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Document\` | extends [\`GenericDocument\`](https://docs.convex.dev/api/modules/server#genericdocument) |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-76 \"Direct link to Defined in\")

[server/system\\_fields.ts:37](https://github.com/get-convex/convex-js/blob/main/src/server/system_fields.ts#L37)

* * *

### SystemIndexes [​](https://docs.convex.dev/api/modules/server\\#systemindexes \"Direct link to SystemIndexes\")

Ƭ **SystemIndexes**: \`Object\`

The indexes that Convex automatically adds to every table.

This is an object mapping index names to index field paths.

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-17 \"Direct link to Type declaration\")

| Name | Type |
| :-- | :-- |
| \`by_id\` | \\[ \`\"_id\"\`\\] |
| \`by_creation_time\` | \\[ \`\"_creationTime\"\`\\] |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-77 \"Direct link to Defined in\")

[server/system\\_fields.ts:48](https://github.com/get-convex/convex-js/blob/main/src/server/system_fields.ts#L48)

* * *

### IndexTiebreakerField [​](https://docs.convex.dev/api/modules/server\\#indextiebreakerfield \"Direct link to IndexTiebreakerField\")

Ƭ **IndexTiebreakerField**: \`\"_creationTime\"\`

Convex automatically appends \"\\_creationTime\" to the end of every index to
break ties if all of the other fields are identical.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-78 \"Direct link to Defined in\")

[server/system\\_fields.ts:61](https://github.com/get-convex/convex-js/blob/main/src/server/system_fields.ts#L61)

* * *

### VectorSearch [​](https://docs.convex.dev/api/modules/server\\#vectorsearch \"Direct link to VectorSearch\")

Ƭ **VectorSearch** < \`DataModel\`, \`TableName\`, \`IndexName\` >: ( \`tableName\`: \`TableName\`, \`indexName\`: \`IndexName\`, \`query\`: [\`VectorSearchQuery\`](https://docs.convex.dev/api/interfaces/server.VectorSearchQuery) < [\`NamedTableInfo\`](https://docs.convex.dev/api/modules/server#namedtableinfo) < \`DataModel\`, \`TableName\` >, \`IndexName\` >) =\\> \`Promise\` <{ \`_id\`: [\`GenericId\`](https://docs.convex.dev/api/modules/values#genericid) < \`TableName\` \\> ; \`_score\`: \`number\` }\\[\\]>

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-51 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DataModel\` | extends [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) |
| \`TableName\` | extends [\`TableNamesInDataModel\`](https://docs.convex.dev/api/modules/server#tablenamesindatamodel) < \`DataModel\` > |
| \`IndexName\` | extends [\`VectorIndexNames\`](https://docs.convex.dev/api/modules/server#vectorindexnames) < [\`NamedTableInfo\`](https://docs.convex.dev/api/modules/server#namedtableinfo) < \`DataModel\`, \`TableName\` >> |

#### Type declaration [​](https://docs.convex.dev/api/modules/server\\#type-declaration-18 \"Direct link to Type declaration\")

▸ ( \`tableName\`, \`indexName\`, \`query\`): \`Promise\` <{ \`_id\`: [\`GenericId\`](https://docs.convex.dev/api/modules/values#genericid) < \`TableName\` \\> ; \`_score\`: \`number\` }\\[\\]>

##### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-7 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`tableName\` | \`TableName\` |
| \`indexName\` | \`IndexName\` |
| \`query\` | [\`VectorSearchQuery\`](https://docs.convex.dev/api/interfaces/server.VectorSearchQuery) < [\`NamedTableInfo\`](https://docs.convex.dev/api/modules/server#namedtableinfo) < \`DataModel\`, \`TableName\` >, \`IndexName\` > |

##### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-7 \"Direct link to Returns\")

\`Promise\` <{ \`_id\`: [\`GenericId\`](https://docs.convex.dev/api/modules/values#genericid) < \`TableName\` \\> ; \`_score\`: \`number\` }\\[\\]>

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-79 \"Direct link to Defined in\")

[server/vector\\_search.ts:55](https://github.com/get-convex/convex-js/blob/main/src/server/vector_search.ts#L55)

* * *

### Expand [​](https://docs.convex.dev/api/modules/server\\#expand \"Direct link to Expand\")

Ƭ **Expand** < \`ObjectType\` >: \`ObjectType\` extends \`Record\` < \`any\`, \`any\` \\> ? { \\[Key in keyof ObjectType\\]: ObjectType\\[Key\\] } : \`never\`

Hack! This type causes TypeScript to simplify how it renders object types.

It is functionally the identity for object types, but in practice it can
simplify expressions like \`A & B\`.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-52 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ObjectType\` | extends \`Record\` < \`any\`, \`any\` > |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-80 \"Direct link to Defined in\")

[type\\_utils.ts:12](https://github.com/get-convex/convex-js/blob/main/src/type_utils.ts#L12)

* * *

### BetterOmit [​](https://docs.convex.dev/api/modules/server\\#betteromit \"Direct link to BetterOmit\")

Ƭ **BetterOmit** < \`T\`, \`K\` >: { \\[Property in keyof T as Property extends K ? never : Property\\]: T\\[Property\\] }

An \`Omit<>\` type that:

1. Applies to each element of a union.
2. Preserves the index signature of the underlying type.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-53 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`T\` | \`T\` |
| \`K\` | extends keyof \`T\` |

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-81 \"Direct link to Defined in\")

[type\\_utils.ts:24](https://github.com/get-convex/convex-js/blob/main/src/type_utils.ts#L24)

## Variables [​](https://docs.convex.dev/api/modules/server\\#variables \"Direct link to Variables\")

### anyApi [​](https://docs.convex.dev/api/modules/server\\#anyapi-1 \"Direct link to anyApi\")

• \`Const\` **anyApi**: [\`AnyApi\`](https://docs.convex.dev/api/modules/server#anyapi)

A utility for constructing [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference) s in projects that
are not using code generation.

You can create a reference to a function like:

\`\`\`codeBlockLines_zEuJ
const reference = anyApi.myModule.myFunction;

\`\`\`

This supports accessing any path regardless of what directories and modules
are in your project. All function references are typed as
AnyFunctionReference.

If you're using code generation, use \`api\` from \`convex/_generated/api\`
instead. It will be more type-safe and produce better auto-complete
in your editor.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-82 \"Direct link to Defined in\")

[server/api.ts:427](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L427)

* * *

### paginationOptsValidator [​](https://docs.convex.dev/api/modules/server\\#paginationoptsvalidator \"Direct link to paginationOptsValidator\")

• \`Const\` **paginationOptsValidator**: [\`VObject\`](https://docs.convex.dev/api/classes/values.VObject) <{ \`id\`: \`undefined\` \\| \`number\` ; \`endCursor\`: \`undefined\` \\| \`null\` \\| \`string\` ; \`maximumRowsRead\`: \`undefined\` \\| \`number\` ; \`maximumBytesRead\`: \`undefined\` \\| \`number\` ; \`numItems\`: \`number\` ; \`cursor\`: \`null\` \\| \`string\` }, { \`numItems\`: [\`VFloat64\`](https://docs.convex.dev/api/classes/values.VFloat64) < \`number\`, \`\"required\"\` \\> ; \`cursor\`: [\`VUnion\`](https://docs.convex.dev/api/classes/values.VUnion) < \`null\` \\| \`string\`, \\[ [\`VString\`](https://docs.convex.dev/api/classes/values.VString) < \`string\`, \`\"required\"\` >, [\`VNull\`](https://docs.convex.dev/api/classes/values.VNull) < \`null\`, \`\"required\"\` >\\], \`\"required\"\`, \`never\` \\> ; \`endCursor\`: [\`VUnion\`](https://docs.convex.dev/api/classes/values.VUnion) < \`undefined\` \\| \`null\` \\| \`string\`, \\[ [\`VString\`](https://docs.convex.dev/api/classes/values.VString) < \`string\`, \`\"required\"\` >, [\`VNull\`](https://docs.convex.dev/api/classes/values.VNull) < \`null\`, \`\"required\"\` >\\], \`\"optional\"\`, \`never\` \\> ; \`id\`: [\`VFloat64\`](https://docs.convex.dev/api/classes/values.VFloat64) < \`undefined\` \\| \`number\`, \`\"optional\"\` \\> ; \`maximumRowsRead\`: [\`VFloat64\`](https://docs.convex.dev/api/classes/values.VFloat64) < \`undefined\` \\| \`number\`, \`\"optional\"\` \\> ; \`maximumBytesRead\`: [\`VFloat64\`](https://docs.convex.dev/api/classes/values.VFloat64) < \`undefined\` \\| \`number\`, \`\"optional\"\` \\> }, \`\"required\"\`, \`\"id\"\` \\| \`\"numItems\"\` \\| \`\"cursor\"\` \\| \`\"endCursor\"\` \\| \`\"maximumRowsRead\"\` \\| \`\"maximumBytesRead\"\` >

A [Validator](https://docs.convex.dev/api/modules/values#validator) for [PaginationOptions](https://docs.convex.dev/api/interfaces/server.PaginationOptions).

This includes the standard [PaginationOptions](https://docs.convex.dev/api/interfaces/server.PaginationOptions) properties along with
an optional cache-busting \`id\` property used by [usePaginatedQuery](https://docs.convex.dev/api/modules/react#usepaginatedquery).

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-83 \"Direct link to Defined in\")

[server/pagination.ts:131](https://github.com/get-convex/convex-js/blob/main/src/server/pagination.ts#L131)

* * *

### ROUTABLE\\_HTTP\\_METHODS [​](https://docs.convex.dev/api/modules/server\\#routable_http_methods \"Direct link to ROUTABLE_HTTP_METHODS\")

• \`Const\` **ROUTABLE\\_HTTP\\_METHODS**: readonly \\[ \`\"GET\"\`, \`\"POST\"\`, \`\"PUT\"\`, \`\"DELETE\"\`, \`\"OPTIONS\"\`, \`\"PATCH\"\`\\]

A list of the methods supported by Convex HTTP actions.

HEAD is handled by Convex by running GET and stripping the body.
CONNECT is not supported and will not be supported.
TRACE is not supported and will not be supported.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-84 \"Direct link to Defined in\")

[server/router.ts:14](https://github.com/get-convex/convex-js/blob/main/src/server/router.ts#L14)

## Functions [​](https://docs.convex.dev/api/modules/server\\#functions \"Direct link to Functions\")

### getFunctionName [​](https://docs.convex.dev/api/modules/server\\#getfunctionname \"Direct link to getFunctionName\")

▸ **getFunctionName**( \`functionReference\`): \`string\`

Get the name of a function from a [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference).

The name is a string like \"myDir/myModule:myFunction\". If the exported name
of the function is \`\"default\"\`, the function name is omitted
(e.g. \"myDir/myModule\").

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-8 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`functionReference\` | \`AnyFunctionReference\` | A [FunctionReference](https://docs.convex.dev/api/modules/server#functionreference) to get the name of. |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-8 \"Direct link to Returns\")

\`string\`

A string of the function's name.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-85 \"Direct link to Defined in\")

[server/api.ts:78](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L78)

* * *

### makeFunctionReference [​](https://docs.convex.dev/api/modules/server\\#makefunctionreference \"Direct link to makeFunctionReference\")

▸ **makeFunctionReference** < \`type\`, \`args\`, \`ret\` >( \`name\`): [\`FunctionReference\`](https://docs.convex.dev/api/modules/server#functionreference) < \`type\`, \`\"public\"\`, \`args\`, \`ret\` >

FunctionReferences generally come from generated code, but in custom clients
it may be useful to be able to build one manually.

Real function references are empty objects at runtime, but the same interface
can be implemented with an object for tests and clients which don't use
code generation.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-54 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`type\` | extends [\`FunctionType\`](https://docs.convex.dev/api/modules/server#functiontype) |
| \`args\` | extends [\`DefaultFunctionArgs\`](https://docs.convex.dev/api/modules/server#defaultfunctionargs) = \`any\` |
| \`ret\` | \`any\` |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-9 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`name\` | \`string\` | The identifier of the function. E.g. \`path/to/file:functionName\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-9 \"Direct link to Returns\")

[\`FunctionReference\`](https://docs.convex.dev/api/modules/server#functionreference) < \`type\`, \`\"public\"\`, \`args\`, \`ret\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-86 \"Direct link to Defined in\")

[server/api.ts:122](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L122)

* * *

### filterApi [​](https://docs.convex.dev/api/modules/server\\#filterapi-1 \"Direct link to filterApi\")

▸ **filterApi** < \`API\`, \`Predicate\` >( \`api\`): [\`FilterApi\`](https://docs.convex.dev/api/modules/server#filterapi) < \`API\`, \`Predicate\` >

Given an api of type API and a FunctionReference subtype, return an api object
containing only the function references that match.

\`\`\`codeBlockLines_zEuJ
const q = filterApi<typeof api, FunctionReference<\"query\">>(api)

\`\`\`

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-55 \"Direct link to Type parameters\")

| Name |
| :-- |
| \`API\` |
| \`Predicate\` |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-10 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`api\` | \`API\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-10 \"Direct link to Returns\")

[\`FilterApi\`](https://docs.convex.dev/api/modules/server#filterapi) < \`API\`, \`Predicate\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-87 \"Direct link to Defined in\")

[server/api.ts:301](https://github.com/get-convex/convex-js/blob/main/src/server/api.ts#L301)

* * *

### createFunctionHandle [​](https://docs.convex.dev/api/modules/server\\#createfunctionhandle \"Direct link to createFunctionHandle\")

▸ **createFunctionHandle** < \`Type\`, \`Args\`, \`ReturnType\` >( \`functionReference\`): \`Promise\` < [\`FunctionHandle\`](https://docs.convex.dev/api/modules/server#functionhandle) < \`Type\`, \`Args\`, \`ReturnType\` >>

Create a serializable reference to a Convex function.
Passing a this reference to another component allows that component to call this
function during the current function execution or at any later time.
Function handles are used like \`api.folder.function\` FunctionReferences,
e.g. \`ctx.scheduler.runAfter(0, functionReference, args)\`.

A function reference is stable across code pushes but it's possible
the Convex function it refers to might no longer exist.

This is a feature of components, which are in beta.
This API is unstable and may change in subsequent releases.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-56 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Type\` | extends [\`FunctionType\`](https://docs.convex.dev/api/modules/server#functiontype) |
| \`Args\` | extends [\`DefaultFunctionArgs\`](https://docs.convex.dev/api/modules/server#defaultfunctionargs) |
| \`ReturnType\` | \`ReturnType\` |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-11 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`functionReference\` | [\`FunctionReference\`](https://docs.convex.dev/api/modules/server#functionreference) < \`Type\`, \`\"public\"\` \\| \`\"internal\"\`, \`Args\`, \`ReturnType\` > |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-11 \"Direct link to Returns\")

\`Promise\` < [\`FunctionHandle\`](https://docs.convex.dev/api/modules/server#functionhandle) < \`Type\`, \`Args\`, \`ReturnType\` >>

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-88 \"Direct link to Defined in\")

[server/components/index.ts:54](https://github.com/get-convex/convex-js/blob/main/src/server/components/index.ts#L54)

* * *

### defineComponent [​](https://docs.convex.dev/api/modules/server\\#definecomponent \"Direct link to defineComponent\")

▸ **defineComponent** < \`Exports\` >( \`name\`): [\`ComponentDefinition\`](https://docs.convex.dev/api/modules/server#componentdefinition) < \`Exports\` >

Define a component, a piece of a Convex deployment with namespaced resources.

The default
the default export of a module like \"cool-component/convex.config.js\"
is a \\\`@link ComponentDefinition}, but during component definition evaluation
this is its type instead.

@param name Name must be alphanumeric plus underscores. Typically these are
lowercase with underscores like \`\"onboarding_flow_tracker\"\`.

This is a feature of components, which are in beta.
This API is unstable and may change in subsequent releases.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-57 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Exports\` | extends \`ComponentExports\` = \`any\` |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-12 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`name\` | \`string\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-12 \"Direct link to Returns\")

[\`ComponentDefinition\`](https://docs.convex.dev/api/modules/server#componentdefinition) < \`Exports\` >

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-89 \"Direct link to Defined in\")

[server/components/index.ts:359](https://github.com/get-convex/convex-js/blob/main/src/server/components/index.ts#L359)

* * *

### defineApp [​](https://docs.convex.dev/api/modules/server\\#defineapp \"Direct link to defineApp\")

▸ **defineApp**(): \`AppDefinition\`

Attach components, reuseable pieces of a Convex deployment, to this Convex app.

This is a feature of components, which are in beta.
This API is unstable and may change in subsequent releases.

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-13 \"Direct link to Returns\")

\`AppDefinition\`

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-90 \"Direct link to Defined in\")

[server/components/index.ts:385](https://github.com/get-convex/convex-js/blob/main/src/server/components/index.ts#L385)

* * *

### componentsGeneric [​](https://docs.convex.dev/api/modules/server\\#componentsgeneric \"Direct link to componentsGeneric\")

▸ **componentsGeneric**(): \`AnyChildComponents\`

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-14 \"Direct link to Returns\")

\`AnyChildComponents\`

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-91 \"Direct link to Defined in\")

[server/components/index.ts:440](https://github.com/get-convex/convex-js/blob/main/src/server/components/index.ts#L440)

* * *

### getFunctionAddress [​](https://docs.convex.dev/api/modules/server\\#getfunctionaddress \"Direct link to getFunctionAddress\")

▸ **getFunctionAddress**( \`functionReference\`): { \`functionHandle\`: \`string\` = functionReference; \`name?\`: \`undefined\` ; \`reference?\`: \`undefined\` = referencePath } \\| { \`functionHandle?\`: \`undefined\` = functionReference; \`name\`: \`any\` ; \`reference?\`: \`undefined\` = referencePath } \\| { \`functionHandle?\`: \`undefined\` = functionReference; \`name?\`: \`undefined\` ; \`reference\`: \`string\` = referencePath }

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-13 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`functionReference\` | \`any\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-15 \"Direct link to Returns\")

{ \`functionHandle\`: \`string\` = functionReference; \`name?\`: \`undefined\` ; \`reference?\`: \`undefined\` = referencePath } \\| { \`functionHandle?\`: \`undefined\` = functionReference; \`name\`: \`any\` ; \`reference?\`: \`undefined\` = referencePath } \\| { \`functionHandle?\`: \`undefined\` = functionReference; \`name?\`: \`undefined\` ; \`reference\`: \`string\` = referencePath }

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-92 \"Direct link to Defined in\")

[server/components/paths.ts:20](https://github.com/get-convex/convex-js/blob/main/src/server/components/paths.ts#L20)

* * *

### cronJobs [​](https://docs.convex.dev/api/modules/server\\#cronjobs \"Direct link to cronJobs\")

▸ **cronJobs**(): [\`Crons\`](https://docs.convex.dev/api/classes/server.Crons)

Create a CronJobs object to schedule recurring tasks.

\`\`\`codeBlockLines_zEuJ
// convex/crons.js
import { cronJobs } from 'convex/server';
import { api } from \"./_generated/api\";

const crons = cronJobs();
crons.weekly(
  \"weekly re-engagement email\",
  {
    hourUTC: 17, // (9:30am Pacific/10:30am Daylight Savings Pacific)
    minuteUTC: 30,
  },
  api.emails.send
)
export default crons;

\`\`\`

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-16 \"Direct link to Returns\")

[\`Crons\`](https://docs.convex.dev/api/classes/server.Crons)

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-93 \"Direct link to Defined in\")

[server/cron.ts:180](https://github.com/get-convex/convex-js/blob/main/src/server/cron.ts#L180)

* * *

### mutationGeneric [​](https://docs.convex.dev/api/modules/server\\#mutationgeneric \"Direct link to mutationGeneric\")

▸ **mutationGeneric** < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`mutation\`): [\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`\"public\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Define a mutation in this Convex app's public API.

This function will be allowed to modify your Convex database and will be accessible from the client.

If you're using code generation, use the \`mutation\` function in
\`convex/_generated/server.d.ts\` which is typed for your data model.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-58 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-14 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`mutation\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-17 \"Direct link to Returns\")

[\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`\"public\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

The wrapped mutation. Include this as an \`export\` to name it and make it accessible.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-94 \"Direct link to Defined in\")

[server/registration.ts:615](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L615)

* * *

### internalMutationGeneric [​](https://docs.convex.dev/api/modules/server\\#internalmutationgeneric \"Direct link to internalMutationGeneric\")

▸ **internalMutationGeneric** < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`mutation\`): [\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`\"internal\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Define a mutation that is only accessible from other Convex functions (but not from the client).

This function will be allowed to modify your Convex database. It will not be accessible from the client.

If you're using code generation, use the \`internalMutation\` function in
\`convex/_generated/server.d.ts\` which is typed for your data model.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-59 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-15 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`mutation\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericMutationCtx\`](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-18 \"Direct link to Returns\")

[\`RegisteredMutation\`](https://docs.convex.dev/api/modules/server#registeredmutation) < \`\"internal\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

The wrapped mutation. Include this as an \`export\` to name it and make it accessible.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-95 \"Direct link to Defined in\")

[server/registration.ts:615](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L615)

* * *

### queryGeneric [​](https://docs.convex.dev/api/modules/server\\#querygeneric \"Direct link to queryGeneric\")

▸ **queryGeneric** < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`query\`): [\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`\"public\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Define a query in this Convex app's public API.

This function will be allowed to read your Convex database and will be accessible from the client.

If you're using code generation, use the \`query\` function in
\`convex/_generated/server.d.ts\` which is typed for your data model.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-60 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-16 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`query\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-19 \"Direct link to Returns\")

[\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`\"public\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

The wrapped query. Include this as an \`export\` to name it and make it accessible.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-96 \"Direct link to Defined in\")

[server/registration.ts:801](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L801)

* * *

### internalQueryGeneric [​](https://docs.convex.dev/api/modules/server\\#internalquerygeneric \"Direct link to internalQueryGeneric\")

▸ **internalQueryGeneric** < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`query\`): [\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`\"internal\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Define a query that is only accessible from other Convex functions (but not from the client).

This function will be allowed to read from your Convex database. It will not be accessible from the client.

If you're using code generation, use the \`internalQuery\` function in
\`convex/_generated/server.d.ts\` which is typed for your data model.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-61 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-17 \"Direct link to Parameters\")

| Name | Type |
| :-- | :-- |
| \`query\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericQueryCtx\`](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-20 \"Direct link to Returns\")

[\`RegisteredQuery\`](https://docs.convex.dev/api/modules/server#registeredquery) < \`\"internal\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

The wrapped query. Include this as an \`export\` to name it and make it accessible.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-97 \"Direct link to Defined in\")

[server/registration.ts:801](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L801)

* * *

### actionGeneric [​](https://docs.convex.dev/api/modules/server\\#actiongeneric \"Direct link to actionGeneric\")

▸ **actionGeneric** < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`func\`): [\`RegisteredAction\`](https://docs.convex.dev/api/modules/server#registeredaction) < \`\"public\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Define an action in this Convex app's public API.

If you're using code generation, use the \`action\` function in
\`convex/_generated/server.d.ts\` which is typed for your data model.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-62 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-18 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`func\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` | The function. It receives a [GenericActionCtx](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) as its first argument. |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-21 \"Direct link to Returns\")

[\`RegisteredAction\`](https://docs.convex.dev/api/modules/server#registeredaction) < \`\"public\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

The wrapped function. Include this as an \`export\` to name it and make it accessible.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-98 \"Direct link to Defined in\")

[server/registration.ts:979](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L979)

* * *

### internalActionGeneric [​](https://docs.convex.dev/api/modules/server\\#internalactiongeneric \"Direct link to internalActionGeneric\")

▸ **internalActionGeneric** < \`ArgsValidator\`, \`ReturnsValidator\`, \`ReturnValue\`, \`OneOrZeroArgs\` >( \`func\`): [\`RegisteredAction\`](https://docs.convex.dev/api/modules/server#registeredaction) < \`\"internal\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

Define an action that is only accessible from other Convex functions (but not from the client).

If you're using code generation, use the \`internalAction\` function in
\`convex/_generated/server.d.ts\` which is typed for your data model.

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-63 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`ArgsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnsValidator\` | extends \`void\` \\| [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`any\`, \`\"required\"\`, \`any\` \\> \\| [\`PropertyValidators\`](https://docs.convex.dev/api/modules/values#propertyvalidators) |
| \`ReturnValue\` | extends \`any\` = \`any\` |
| \`OneOrZeroArgs\` | extends [\`ArgsArray\`](https://docs.convex.dev/api/modules/server#argsarray) \\| \`OneArgArray\` < [\`Infer\`](https://docs.convex.dev/api/modules/values#infer) < \`ArgsValidator\` >\\> \\| \`OneArgArray\` < [\`Expand\`](https://docs.convex.dev/api/modules/server#expand) <{ \\[Property in string \\| number \\| symbol\\]?: Exclude<Infer<ArgsValidator\\[Property\\]>, undefined> } & { \\[Property in string \\| number \\| symbol\\]: Infer<ArgsValidator\\[Property\\]> }>> = [\`DefaultArgsForOptionalValidator\`](https://docs.convex.dev/api/modules/server#defaultargsforoptionalvalidator) < \`ArgsValidator\` > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-19 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`func\` | { \`args?\`: \`ArgsValidator\` ; \`returns?\`: \`ReturnsValidator\` ; \`handler\`: ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` } \\| ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < \`any\` >, ... \`args\`: \`OneOrZeroArgs\`) =\\> \`ReturnValue\` | The function. It receives a [GenericActionCtx](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) as its first argument. |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-22 \"Direct link to Returns\")

[\`RegisteredAction\`](https://docs.convex.dev/api/modules/server#registeredaction) < \`\"internal\"\`, [\`ArgsArrayToObject\`](https://docs.convex.dev/api/modules/server#argsarraytoobject) < \`OneOrZeroArgs\` >, \`ReturnValue\` >

The wrapped function. Include this as an \`export\` to name it and make it accessible.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-99 \"Direct link to Defined in\")

[server/registration.ts:979](https://github.com/get-convex/convex-js/blob/main/src/server/registration.ts#L979)

* * *

### httpActionGeneric [​](https://docs.convex.dev/api/modules/server\\#httpactiongeneric \"Direct link to httpActionGeneric\")

▸ **httpActionGeneric**( \`func\`): [\`PublicHttpAction\`](https://docs.convex.dev/api/modules/server#publichttpaction)

Define a Convex HTTP action.

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-20 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`func\` | ( \`ctx\`: [\`GenericActionCtx\`](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) < [\`GenericDataModel\`](https://docs.convex.dev/api/modules/server#genericdatamodel) >, \`request\`: \`Request\`) =\\> \`Promise\` < \`Response\` > | The function. It receives an [GenericActionCtx](https://docs.convex.dev/api/interfaces/server.GenericActionCtx) as its first argument, and a \`Request\` object as its second. |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-23 \"Direct link to Returns\")

[\`PublicHttpAction\`](https://docs.convex.dev/api/modules/server#publichttpaction)

The wrapped function. Route a URL path to this function in \`convex/http.js\`.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-100 \"Direct link to Defined in\")

[server/impl/registration\\_impl.ts:454](https://github.com/get-convex/convex-js/blob/main/src/server/impl/registration_impl.ts#L454)

* * *

### httpRouter [​](https://docs.convex.dev/api/modules/server\\#httprouter \"Direct link to httpRouter\")

▸ **httpRouter**(): [\`HttpRouter\`](https://docs.convex.dev/api/classes/server.HttpRouter)

Return a new [HttpRouter](https://docs.convex.dev/api/classes/server.HttpRouter) object.

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-24 \"Direct link to Returns\")

[\`HttpRouter\`](https://docs.convex.dev/api/classes/server.HttpRouter)

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-101 \"Direct link to Defined in\")

[server/router.ts:47](https://github.com/get-convex/convex-js/blob/main/src/server/router.ts#L47)

* * *

### defineTable [​](https://docs.convex.dev/api/modules/server\\#definetable \"Direct link to defineTable\")

▸ **defineTable** < \`DocumentSchema\` >( \`documentSchema\`): [\`TableDefinition\`](https://docs.convex.dev/api/classes/server.TableDefinition) < \`DocumentSchema\` >

Define a table in a schema.

You can either specify the schema of your documents as an object like

\`\`\`codeBlockLines_zEuJ
defineTable({
  field: v.string()
});

\`\`\`

or as a schema type like

\`\`\`codeBlockLines_zEuJ
defineTable(
 v.union(
   v.object({...}),
   v.object({...})
 )
);

\`\`\`

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-64 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DocumentSchema\` | extends [\`Validator\`](https://docs.convex.dev/api/modules/values#validator) < \`Record\` < \`string\`, \`any\` >, \`\"required\"\`, \`any\` > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-21 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`documentSchema\` | \`DocumentSchema\` | The type of documents stored in this table. |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-25 \"Direct link to Returns\")

[\`TableDefinition\`](https://docs.convex.dev/api/classes/server.TableDefinition) < \`DocumentSchema\` >

A [TableDefinition](https://docs.convex.dev/api/classes/server.TableDefinition) for the table.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-102 \"Direct link to Defined in\")

[server/schema.ts:347](https://github.com/get-convex/convex-js/blob/main/src/server/schema.ts#L347)

▸ **defineTable** < \`DocumentSchema\` >( \`documentSchema\`): [\`TableDefinition\`](https://docs.convex.dev/api/classes/server.TableDefinition) < [\`VObject\`](https://docs.convex.dev/api/classes/values.VObject) < [\`ObjectType\`](https://docs.convex.dev/api/modules/values#objecttype) < \`DocumentSchema\` >, \`DocumentSchema\` >>

Define a table in a schema.

You can either specify the schema of your documents as an object like

\`\`\`codeBlockLines_zEuJ
defineTable({
  field: v.string()
});

\`\`\`

or as a schema type like

\`\`\`codeBlockLines_zEuJ
defineTable(
 v.union(
   v.object({...}),
   v.object({...})
 )
);

\`\`\`

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-65 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`DocumentSchema\` | extends \`Record\` < \`string\`, [\`GenericValidator\`](https://docs.convex.dev/api/modules/values#genericvalidator) > |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-22 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`documentSchema\` | \`DocumentSchema\` | The type of documents stored in this table. |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-26 \"Direct link to Returns\")

[\`TableDefinition\`](https://docs.convex.dev/api/classes/server.TableDefinition) < [\`VObject\`](https://docs.convex.dev/api/classes/values.VObject) < [\`ObjectType\`](https://docs.convex.dev/api/modules/values#objecttype) < \`DocumentSchema\` >, \`DocumentSchema\` >>

A [TableDefinition](https://docs.convex.dev/api/classes/server.TableDefinition) for the table.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-103 \"Direct link to Defined in\")

[server/schema.ts:375](https://github.com/get-convex/convex-js/blob/main/src/server/schema.ts#L375)

* * *

### defineSchema [​](https://docs.convex.dev/api/modules/server\\#defineschema \"Direct link to defineSchema\")

▸ **defineSchema** < \`Schema\`, \`StrictTableNameTypes\` >( \`schema\`, \`options?\`): [\`SchemaDefinition\`](https://docs.convex.dev/api/classes/server.SchemaDefinition) < \`Schema\`, \`StrictTableNameTypes\` >

Define the schema of this Convex project.

This should be exported from a \`schema.ts\` file in your \`convex/\` directory
like:

\`\`\`codeBlockLines_zEuJ
export default defineSchema({
  ...
});

\`\`\`

#### Type parameters [​](https://docs.convex.dev/api/modules/server\\#type-parameters-66 \"Direct link to Type parameters\")

| Name | Type |
| :-- | :-- |
| \`Schema\` | extends [\`GenericSchema\`](https://docs.convex.dev/api/modules/server#genericschema) |
| \`StrictTableNameTypes\` | extends \`boolean\` = \`true\` |

#### Parameters [​](https://docs.convex.dev/api/modules/server\\#parameters-23 \"Direct link to Parameters\")

| Name | Type | Description |
| :-- | :-- | :-- |
| \`schema\` | \`Schema\` | A map from table name to [TableDefinition](https://docs.convex.dev/api/classes/server.TableDefinition) for all of the tables in this project. |
| \`options?\` | [\`DefineSchemaOptions\`](https://docs.convex.dev/api/interfaces/server.DefineSchemaOptions) < \`StrictTableNameTypes\` > | Optional configuration. See [DefineSchemaOptions](https://docs.convex.dev/api/interfaces/server.DefineSchemaOptions) for a full description. |

#### Returns [​](https://docs.convex.dev/api/modules/server\\#returns-27 \"Direct link to Returns\")

[\`SchemaDefinition\`](https://docs.convex.dev/api/classes/server.SchemaDefinition) < \`Schema\`, \`StrictTableNameTypes\` >

The schema.

#### Defined in [​](https://docs.convex.dev/api/modules/server\\#defined-in-104 \"Direct link to Defined in\")
  `;
}
