## Getting Started

Visit our [documentation](https://docs.convex.dev/chef) to learn more about Chef and check out our prompting [guide](https://stack.convex.dev/chef-cookbook-tips-working-with-ai-app-builders).

The easiest way to build with Chef is through our hosted [webapp](https://chef.convex.dev), which includes a generous free tier. If you want to
run Chef locally, you can follow the guide below.


### Running Locally


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
