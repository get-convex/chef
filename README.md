<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://chef.convex.dev/github-header-dark.svg">
    <img alt="Chef by Convex'" src="https://chef.convex.dev/github-header-light.svg" width="600">
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

> [!IMPORTANT]
> Chef is provided as-is, using an authentication configuration specific to Convex's internal control plane that manages user accounts.

If you are planning on developing a fork of Chef for production use or re-distribution, your fork will need to replace the existing authentication system with your own. We recommend using the [OAuth Authorization Code Grant](https://docs.convex.dev/platform-apis/oauth-applications#implementing-oauth) flow to authorize access to Convex teams or projects. [Read more about available Platform APIs](https://docs.convex.dev/platform-apis).

Chef is easy to use for local development without changes. Read on for instructions for using Chef locally.

### Running Locally

Note: This will use the hosted Convex control plane to provision Convex projects. However, Chef tokens used in this enviroment will not count towards usage in your Convex account.

**1. Clone the project**

Clone the GitHub respository and `cd` into the directory by running the following commands:

```bash
git clone https://github.com/get-convex/chef.git
cd chef
```

**2. Set up local environment**

Run the following commands in your terminal:

```bash
nvm install
nvm use
npm install -g pnpm
pnpm i
echo 'VITE_CONVEX_URL=placeholder' >> .env.local
npx convex dev --once # follow the steps to create a Convex project in your team
```

Note: `nvm` only works on Mac and Linux. If you are using Windows, you may have to find an alternative.

**3. Set up Chef OAuth application**

Go to the Convex [dashboard](https://dashboard.convex.dev/team/settings/applications/oauth-apps) and create an OAuth application. The team you use to create the application will be the only team you can sign-in with on local Chef. Redirect URIs will not matter, but you can set one to http://127.0.0.1:5173 (or whatever port you’ll run the Chef UI on) so that the form can be submitted.

**4. Set up Convex deployment**

Use `npx convex dashboard` to open the Convex [dashboard](https://dashboard.convex.dev) and go to Settings → Environment Variables. Then, set the following environment variables:

```env
BIG_BRAIN_HOST=https://api.convex.dev
CONVEX_OAUTH_CLIENT_ID=<value from oauth setup>
CONVEX_OAUTH_CLIENT_SECRET=<value from oauth setup>
WORKOS_CLIENT_ID=<value from .env.development>
```

**5. Add API keys for model providers**

Add any of the following API keys in your `.env.local` to enable code generation:

```env
ANTHROPIC_API_KEY=<your api key>
GOOGLE_API_KEY=<your api key>
OPENAI_API_KEY=<your api key>
XAI_API_KEY=<your api key>
OPENROUTER_API_KEY=<your api key>
```

Note: You can also add your own API keys through the Chef settings page.

**6. Run Chef backend and frontend**

Run the following commands in your terminal:

```bash
pnpm run dev

## in another terminal
npx convex dev
```

Congratulations, you now have Chef running locally! You can log in to Chef with your existing Convex account.

Note: Chef is accessible at http://127.0.0.1:{port}/ and will not work properly on http://localhost:{port}/.

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
