<p align="center">
  <img src="./public/AI_Standard_Logo_Clean.png" alt="AI Standard" width="200">
</p>

# AI Standard

## Well, Let's Make It An App

**AI Standard** empowers builders to transform ideas into real applications. We're builders-first and execution-obsessed, providing the tools, guidance, and support you need to ship.

### Core Philosophy
- **Democratizing Development**: Anyone can build an app
- **Learning by Doing**: Build real projects while mastering modern development
- **Builders Empowering Builders**: Spearheaded by Ramon Williams Jr.

### What You Get
Built on [Chef by Convex](https://chef.convex.dev), your apps come with:
- Built-in database powered by [Convex](https://convex.dev)
- Zero-config authentication
- File uploads and storage
- Real-time UIs
- Background workflows
- Everything you need to build, iterate, and launch

**Foundation** - Built on the [Chef project](https://github.com/get-convex/chef) by the Convex team.

This project is a fork of the `stable` branch of [bolt.diy](https://github.com/stackblitz-labs/bolt.diy).

## Getting Started

Ready to build? Let's go.

For guidance on the underlying platform, check out the [documentation](https://docs.convex.dev/chef) and [prompting guide](https://stack.convex.dev/chef-cookbook-tips-working-with-ai-app-builders).

> [!IMPORTANT]
> This fork has replaced the original WorkOS authentication with a custom Google OAuth implementation. See `GOOGLE_AUTH_IMPLEMENTATION.md` for details.

### Running Locally

**Note:** Uses the hosted Convex control plane to provision projects.

**1. Clone the repository**

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
