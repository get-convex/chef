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
Let's use the same Node.js version as the monorepo for convenience
even though it's old. This project uses `pnpm` instead of `npm`. Download an
.env.local from Vercel. Add `VITE_CONVEX_URL` because otherwise `npx convex dev`
will incorrectly guess that you want to use `CONVEX_URL` as the client
environment variable. Connect to the same Convex project as the rest of us
so that you get some environment variables populated in your dev deployment
automatically.

### Developing

```
pnpm i
pnpm run dev

# and in another terminal,

npx convex dev

# you'll need to issue an invite code to use
npx convex run sessions:issueInviteCode '{issuedReason: "development testing locally", code: "dev-test"}'

# now visit http://localhost:5173
# make sure to use this port, it's been specifically listed in our Auth0 application.
```

### Auth

There are two forms of auth, dictated by the `FLEX_AUTH_MODE` environment variable.

#### `FLEX_AUTH_MODE=ConvexOAuth`

- Users sign in with their Github account to Convex (as of writing, actually a test Convex Auth0 app)
- Users go through an OAuth flow to link projects in their account to Flex
- You'll need the following env vars set in `.env.local` (values are in 1Password under `flex .env.local`)
  - `VITE_AUTH0_CLIENT_ID`
  - `VITE_AUTH0_DOMAIN`
  - `CONVEX_OAUTH_CLIENT_ID`
  - `CONVEX_OAUTH_CLIENT_SECRET`

Additionally make sure `CHEF_OAUTH_APP_NAME` is set to the same value as `CONVEX_OAUTH_CLIENT_ID` on your Convex deployment
(it'll also be in the default Convex project env vars, so you can sync via dashboard).

#### `FLEX_AUTH_MODE=InviteCode`

- Convex projects are provisioned automatically against one of our teams
- The credentials are saved as default environment variables on the `bolt-diy-f612` Convex project
- You need a "code" to access Flex. There's an internal mutation you can run to issue yourself a code (e.g. `sshader-test`).
- Each code corresponds to a user, so if you're doing this in production, issue a code with your name in it.

### Developing against local big-brain

- Start local big-brain/usher/dashboard the traditional way
- Switch .env.local env vars to the dev variants (from 1Password)

# Working on the template

There are a few steps to iterating on the template.

Run `npm run rebuild-template` for directions.

```

```
