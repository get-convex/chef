<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://static.convex.dev/logo/convex-logo-light.svg" width="600">
  <source media="(prefers-color-scheme: light)" srcset="https://static.convex.dev/logo/convex-logo.svg" width="600">
  <img alt="Convex logo" src="https://static.convex.dev/logo/convex-logo.svg" width="600">
</picture>
</p>

[Chef](https://chef.convex.dev) is the only AI app builder that knows backend. It builds full-stack web apps with a built-in database, zero config auth, file uploads,
real-time UIs, and background workflows. If you want to check out the secret sauce that powers Chef, you can view or download the system prompt [here](https://github.com/get-convex/chef/releases/latest).

Chef's capabilities are enabled by being built on top of [Convex](https://convex.dev), the open-source reactive database designed to make life easy for web app developers. The "magic" in Chef is just the fact that it's using Convex's APIs, which are an ideal fit for codegen.

Development of the Chef is led by the Convex team. We
[welcome bug fixes](./CONTRIBUTING.md) and
[love receiving feedback](https://discord.gg/convex).

This project is a fork of the `stable` branch of [bolt.diy](https://github.com/stackblitz-labs/bolt.diy).

## Getting Started

Visit our [documentation](https://docs.convex.dev/chef) to learn more about Chef and check out our prompting [guide](https://stack.convex.dev/chef-cookbook-tips-working-with-ai-app-builders).

The easiest way to build with Chef is through our hosted [webapp](https://chef.convex.dev), which includes a generous free tier. If you want to
run Chef locally, you can follow the guide below.

### Running Locally

Note: This will use the hosted Convex control plane to provision Convex projects. However, Chef tokens used in this enviroment will not count towards usage in your Convex account.

**1. Set up local environment**

Run the following commands in your terminal:

```bash
nvm install
nvm use
npm install -g pnpm
pnpm i
echo 'VITE_CONVEX_URL=placeholder' >> .env.local
npx convex dev --once # follow the steps to create a convex project in your team
```

**2. Set up Chef OAuth application**

Go to the Convex [dashboard](https://dashboard.convex.dev/team/settings/applications/oauth-apps) and create an OAuth application. The team you use to create the application will be the only team you can sign-in with on local Chef. Redirect URIs will not matter for Chef, but you can set one to http://127.0.0.1:5173 (or whatever port you’ll run the Chef UI on) so that the form can be submitted.

**3. Set up Convex deployment**

Open the Convex dashboard and go to Settings → Environment Variables. Then, set the following environment variables:

```env
BIG_BRAIN_HOST=https://api.convex.dev
CONVEX_OAUTH_CLIENT_ID=<value from oauth setup>
CONVEX_OAUTH_CLIENT_SECRET=<value from oauth setup>
```

**4. Add API keys for model providers**

Add any of the following API keys in order to enable code generation:

```env
ANTHROPIC_API_KEY=<your api key>
GOOGLE_API_KEY=<your api key>
OPENAI_API_KEY=<your api key>
XAI_API_KEY=<your api key>
```

Note: you can also add your own API keys through the settings page.

**4. Run Chef backend and frontend**

Run the following commands in your terminal:

```bash
pnpm i
pnpm run dev

## in another terminal
npx convex dev
```

Congratulations, you now have Chef running locally! You can log in to Chef with your existing Convex account.

## Repository Layout

- `app/` contains all of the client side code and some serverless APIs.

  - `components/` defines the UI components
  - `lib/` contains client-side logic for syncing local state with the server
  - `routes/` defines some client and server routes

- `chef-agent/` handles the agentic loop by injecting system prompts, defining tools, and calling out to model providers.

- `chefshot/` defines a CLI interface for interacting with the Chef webapp.

- `convex/` contains the database that stores chats and user metadata.

- `template/` contains the template that we use to start all Chef projects.

- `test-kitchen/` contains a test harness for the Chef agent loop.
