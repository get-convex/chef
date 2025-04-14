# Chef

This is fork of the `stable` branch of [bolt.diy](https://github.com/stackblitz-labs/bolt.diy).

We use two branches:

- staging (use this like main): [chef.convex.dev](https://chef.convex.dev)
- release: [chef-staging.convex.dev](https://chef-staging.convex.dev)

### One-time setup

```
git clone git@github.com:get-convex/flex-diy.git chef
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

# now visit http://localhost:5173
# make sure to use this port, it's been specifically listed in our Auth0 application.
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

You can make a PR to merge staging into release or just push staging to release; it's not a protected branch on GitHub.
Announce in the #project-chef Slack channel when you do this. Try out staging for a while before promoting it to
release.

If the change does not include non-backward compatible Convex DB changes you
can use the Vercel instant rollbacks to prompt old deployments to production.

### Auth

- Users sign in with their Github account to Convex via the same Auth0 app as the dashboard.
- Users choose a team to create a new project in for app they conconct with Chef.
  Note that this is _not_ the OAuth flow that we offer to customers; if a customer wants this,
  they need to use the OAuth flow that grants them access to a user's specific Convex project.
- You'll need the following env vars set in `.env.local` (values are in 1Password under `flex .env.local`)
  - `VITE_AUTH0_CLIENT_ID`
  - `VITE_AUTH0_DOMAIN`

Additionally make sure `CHEF_OAUTH_APP_NAME` is set on your Convex deployment
(it'll also be in the default Convex project env vars, so you can sync via dashboard).

### Developing against local big-brain

- Start local big-brain/usher/dashboard the traditional way
- Switch .env.local env vars to the dev variants (from 1Password)
- Set VITE_CONVEX_URL to 'placeholder' and remove CONVEX_URL
- just convex-bb dev

# Working on the template

There are a few steps to iterating on the template.

Run `npm run rebuild-template` for directions.
