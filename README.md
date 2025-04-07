# flex-diy

This is fork of the `stable` branch of [bolt.diy](https://github.com/stackblitz-labs/bolt.diy).

### One-time setup

- clone the repo, e.g. git clone git@github.com:get-convex/flex-diy.git
- use node 18 or 20, e.g. `nvm use 18`
- install pnpm somehow, e.g. `npm install -g pnpm
- run `pnpm i`
- set up the .env.local file (do this BEFORE running the next command). Copy from 1Password (flex .env.local)
- run `pnpx convex dev --configure existing --team convex --project bolt-diy-f612e --once`

# each time

```
pnpm i
pnpm run dev
# and in another terminal,
pnpx convex dev
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

# Working on the template

There are a few steps to iterating on the template.

Run `npm run rebuild-template` for directions.
