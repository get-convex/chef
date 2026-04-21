export function generateReadmeContent(description: string, convexDeploymentName: string | null) {
  return `# ${description}
  
This is a project built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.
 You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).
  
${convexDeploymentName ? generateConvexDeploymentContent(convexDeploymentName) : ''}
  
## Project structure
  
The frontend code is in the \`app\` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the \`convex\` directory.
  
\`npm run dev\` will start the frontend and backend servers.

## App authentication

Chef apps use [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## Deploying via the CLI (recommended)

You can rebuild and redeploy your Chef-hosted site from your machine. \`.env.local\` in this zip already contains both \`CONVEX_DEPLOYMENT\` and \`CONVEX_DEPLOY_KEY\`, so no extra setup is needed:

\`\`\`bash
npm install
npm run chef-deploy
\`\`\`

This runs \`npm run build\`, zips the \`dist/\` directory, and uploads it to your existing ${convexDeploymentName ? `\`${convexDeploymentName}.convex.app\`` : '`*.convex.app`'} site.

If you need to pass flags, invoke the CLI directly:

\`\`\`bash
npx --yes @convex-dev/chef-deploy --help
\`\`\`

Useful flags:

- \`--build-command "pnpm build"\` if you prefer pnpm
- \`--build-dir build\` if your framework writes somewhere other than \`dist/\`
- \`--skip-build\` to upload an already-built \`dist/\` as-is
- \`--chef-url https://...\` to target a non-default Chef host

## HTTP API

User-defined http routes are defined in the \`convex/router.ts\` file. We split these routes into a separate file from \`convex/http.ts\` to allow us to prevent the LLM from modifying the authentication routes.
`;
}

function generateConvexDeploymentContent(convexDeploymentName: string) {
  return `This project is connected to the Convex deployment named [\`${convexDeploymentName}\`](https://dashboard.convex.dev/d/${convexDeploymentName}).`;
}
