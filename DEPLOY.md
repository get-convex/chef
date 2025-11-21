# Deployment Guide for Chef

This guide explains how to deploy your own instance of Chef, including the Convex backend, the Remix frontend, and the necessary authentication and AI services.

## Prerequisites

Before you begin, ensure you have accounts with the following services:

1.  **[Convex](https://convex.dev/)**: For the backend database and functions.
2.  **[Vercel](https://vercel.com/)**: For hosting the frontend (recommended, but other Remix-compatible hosts work too).
3.  **[WorkOS](https://workos.com/)**: For user authentication.
4.  **AI Providers**: API keys for the models you want to use (OpenAI, Anthropic, Google, etc.).

## Step 1: Clone and Setup

Clone the repository:

```bash
git clone https://github.com/get-convex/chef.git
cd chef
npm install -g pnpm
pnpm install
```

## Step 2: Setup Convex (Backend)

1.  Initialize the Convex project:

    ```bash
    npx convex dev --once
    ```

    Follow the prompts to log in and create a new project in your Convex dashboard.

2.  Deploy the backend to production:

    ```bash
    npx convex deploy
    ```

    This will push your backend code to the Convex production environment.

## Step 3: Setup Authentication (WorkOS)

Since this is a fork, you must set up your own authentication using WorkOS.

1.  **Create a WorkOS Account & Organization**: Go to [WorkOS](https://workos.com/) and set up an organization.
2.  **Create an Environment**: Create a "Production" environment.
3.  **Get Client ID**: Note your `Client ID` from the WorkOS dashboard.
4.  **Configure Redirect URIs**:
    -   For local development: `http://localhost:5173/` (or whatever port you use).
    -   For production: Your Vercel URL (e.g., `https://your-chef-app.vercel.app/`).
5.  **Set Environment Variable**:
    You will need the `WORKOS_CLIENT_ID` for your deployment configuration.

## Step 4: Configure Environment Variables

You need to set up environment variables for both the frontend (Vercel) and the backend (Convex).

### Convex Dashboard Variables
Go to your Convex Dashboard > Settings > Environment Variables and add:

-   `WORKOS_CLIENT_ID`: Your WorkOS Client ID.
-   `ANTHROPIC_API_KEY`: (Optional) Your Anthropic API key.
-   `OPENAI_API_KEY`: (Optional) Your OpenAI API key.
-   `GOOGLE_API_KEY`: (Optional) Your Google API key.
-   `XAI_API_KEY`: (Optional) Your xAI API key.

### Frontend Variables (Vercel)
When you deploy to Vercel, you will need to add these environment variables:

-   `VITE_CONVEX_URL`: The URL of your production Convex deployment (find this in `.env.local` after running `npx convex deploy`, or in the Convex dashboard).
-   `VITE_WORKOS_CLIENT_ID`: Your WorkOS Client ID.
-   `VITE_WORKOS_API_HOSTNAME`: `api.workos.com` (or `apiauth.convex.dev` if using Convex's managed auth, but for a fork use standard WorkOS or your own proxy). *Note: The default code points to `apiauth.convex.dev`. If you are using standard WorkOS, you might need to adjust `app/root.tsx` or this variable.*
-   `VITE_WORKOS_REDIRECT_URI`: Your production URL (e.g., `https://your-chef-app.vercel.app/`).

**Important Note on Authentication:**
The default `convex/auth.config.ts` and `app/root.tsx` are configured to use Convex's internal WorkOS wrapper (`apiauth.convex.dev`). For a personal deployment using your own WorkOS account:

1.  **Frontend**: In `app/root.tsx`, the `AuthKitProvider` uses `import.meta.env.VITE_WORKOS_API_HOSTNAME`. Set this to `api.workos.com` (or leave it blank if the library defaults to it).
2.  **Backend**: Check `convex/auth.config.ts`. It currently points to `https://apiauth.convex.dev/...`. You will likely need to update this to point to WorkOS's standard JWKS url or your own auth provider configuration if you are not using the Convex wrapper.
    *   *Simpler Alternative*: Use the "Running Locally" method but on a server, using the default auth (not recommended for public/production use as stated in the README).

## Step 5: Deploy to Vercel

1.  Install Vercel CLI (optional, or use the web UI):
    ```bash
    npm i -g vercel
    ```
2.  Deploy:
    ```bash
    vercel
    ```
    Follow the prompts. Link it to your GitHub repo for continuous deployment.
3.  **Add Environment Variables**: Go to the Vercel project settings and add the variables listed in Step 4.
4.  **Redeploy**: After adding variables, redeploy to ensure they take effect.

## Step 6: Final Verification

1.  Visit your Vercel URL.
2.  Try to log in. If configured correctly with your WorkOS account, it should work.
3.  Test the AI features. The backend should be able to call the APIs using the keys stored in Convex.

## Troubleshooting

-   **Auth Errors**: If login fails, double-check your WorkOS Redirect URIs and the `VITE_WORKOS_CLIENT_ID`.
-   **AI Errors**: Check the Convex logs in the dashboard to see if the API keys are being read correctly.
