# Development

Below is a guide for the development and release processes of Chef. This is meant for Convex employees and is not a supported workflow for external users.

There are three special branches:

- main: default branch, make PRs against this
- staging: what the world sees at [chef-staging.convex.dev](https://chef-staging.convex.dev)
- release: what the world sees at [chef.convex.dev](https://chef.convex.dev)

### One-time setup

```
git clone git@github.com:get-convex/chef.git
cd chef
nvm install
nvm use
npm install -g pnpm
pnpm i
npx vercel link --scope convex-dev --project chef -y
npx vercel env pull
echo 'VITE_CONVEX_URL=placeholder' >> .env.local
npx convex dev --configure existing --team convex --project chef --once
```

Explanation:

Clone the 100MB repo (don't worry, it's not much code) into a dir called chef.
We use Node.js version 20 to develop even though in production on Vercel backend code runs in Vercel's Node.js 22 environment!
This project uses `pnpm` instead of `npm`. Download an .env.local from Vercel.
Add `VITE_CONVEX_URL` because otherwise `npx convex dev` will incorrectly guess that you want to use `CONVEX_URL` as the client environment variable (Nicolas added a fix to the convex CLI that will be in the next client release so we can avoid this.)
Connect to the same Convex project as the rest of us so that you get some environment variables populated in your dev deployment automatically.

### Developing

```
pnpm i
pnpm run dev

# and in another terminal,

npx convex dev

# now visit http://127.0.0.1:5173
# make sure to use this port and 127.0.0.1 instead of localhost as the hostname, it's been specifically listed in our WorkOS application.
# Wait a few seconds, and then RELOAD THE PAGE! Unfortunately this is currently required
# to use the hot-reloading dev server.
```

### Submitting PRs

Probably set up an editor plugin for running prettier on save.

We have a commit queue that blocks on tests, formatting, lints and typechecking.
Run `pnpm run lint:fix` for lints and formatting, `pnpm run test`for tests (or skip this,
there are very few tests so you're unlikely to break any), and `pnpm run typecheck` for typechecking.

Hit "Merge when ready" on your own PR once it's ready.

We have deploy previews, click the link on
your PR or push a branch and go to [vercel.com/convex-dev/chef/deployments](https://vercel.com/convex-dev/chef/deployments)
to find your preview deploy.

Test your work, we don't have e2e tests.

### Deploy Process

Push from main to staging whenever it makes sense, it's not a protected branch on GitHub.

```
git checkout main
git pull
git push origin main:staging
```

Make a PR from staging to release using [go/chef-release](https://go.cvx.is/chef-release) and confirm that
the evals look good once they run (they should take ~10 mins). All of the evals should have an `isSuccess`
rate of 100%. (Do NOT merge this PR because the GitHub merge queue doesn't allow fast-forward only merges)
While you're waiting for evals to run, manually test staging.

Merge the staging branch into release using the command below.
Announce in the #project-chef Slack channel when you do this.

```
git checkout staging
git pull
git push origin staging:release
```

If the change does not include non-backward compatible Convex DB changes you
can use the Vercel instant rollbacks to prompt old deployments to production.

### Auth

- Users sign in with their regular Convex account through WorkOS.
- Users choose a team to create a new project in for app they conconct with Chef.
  Note that this is _not_ the OAuth flow that we offer to customers; if a customer wants this,
  they need to use the OAuth flow that grants them access to a user's specific Convex project.
- You'll need the following env vars set in `.env.local` (values are in 1Password under `flex .env.local`)
  - VITE_WORKOS_CLIENT_ID=client_01K0YV0SNPRYJ5AV4AS0VG7T1J
  - VITE_WORKOS_REDIRECT_URI=http://127.0.0.1:5173
  - VITE_WORKOS_API_HOSTNAME=apiauth.convex.dev

(it'll also be in the default Convex project env vars, so you can sync via dashboard).

### Developing against local big-brain

You will need a lot of terminals

- just run-big-brain-for-chef-dev
- just run-dash
- Switch chef .env.local env vars to the dev variants (from 1Password)
- Set VITE_CONVEX_URL to 'placeholder' and remove CONVEX_URL
- just convex-bb dev
- Set VITE_CONVEX_SITE_URL to match the newly updated VITE_CONVEX_URL (but .convex.site instead)
- npm run dev

# Working on the template

There are a few steps to iterating on the template.

Run `npm run rebuild-template` for directions.

# Debugging

We include source maps in production so you should be able to poke around in production.

There are a few global variables available for debugging too:

- `chefWebContainer` is the unix-ish container in which tooling and code runs
- `chefMessages` is the raw messages
- `chefParsedMessages` is similar
- `chefSentryEnabled` is whether Sentry is currently enabled
- `chefSetLogLevel()` can be called with log levels like `"debug"` or `"info"` to get more console logging. `"tracing"` is usually too much.
- `chefAssertAdmin()` enables admin features (after checking that you are a member of the Convex team in the prod dashboard)
