<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://static.convex.dev/logo/convex-logo-light.svg" width="600">
  <source media="(prefers-color-scheme: light)" srcset="https://static.convex.dev/logo/convex-logo.svg" width="600">
  <img alt="Convex logo" src="https://static.convex.dev/logo/convex-logo.svg" width="600">
</picture>
</p>

[Chef](https://chef.convex.dev) is the only AI app builder that knows backend. It builds full-stack web apps with a built-in database, zero config auth, file uploads,
real-time UIs, and background workflows.

Chef's capabilities are enabled by being built on top of [Convex](https://convex.dev), the open-source reactive database designed to make life easy for web app developers.

Development of the Chef is led by the Convex team. We
[welcome bug fixes](./CONTRIBUTING.md) and
[love receiving feedback](https://discord.gg/convex).

This project was made in collaboration with the [Bolt](https://bolt.new/) team and is a fork of the `stable` branch of [bolt.diy](https://github.com/stackblitz-labs/bolt.diy).

## Getting Started

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
