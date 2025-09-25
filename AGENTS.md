# AGENTS.md

A briefing packet for AI coding agents working on **Chef**.

This file gives setup commands, safe edit zones, prompt system context, and a predictable task playbook. It mirrors the project’s README and avoids surprises.

---

## Repository Structure
- **Monorepo**: pnpm workspaces  
  - Workspaces: `chef` (root app), `chef-agent`, `chefshot`
- **Key directories** (from README):
  - `chef-agent/` — agent loop, tools, prompts
  - `convex/` — database & server functions (Convex)
  - `template/` — project bootstrap template
  - `test-kitchen/` — agent harness & evaluation
  - `chefshot/` — CLI to interact with the webapp
  - `app/` — client and some serverless routes

## Setup (local)
Use the exact steps below.

```bash
# 1) Clone & enter
git clone https://github.com/get-convex/chef.git
cd chef

# 2) Tooling
nvm install
nvm use
npm install -g pnpm
pnpm i

echo 'VITE_CONVEX_URL=placeholder' >> .env.local

# 3) One-time Convex project provisioning (hosted control plane)
npx convex dev --once # follow the steps to create a Convex project in your team
```

OAuth & environment (human step)

In the Convex dashboard:

Create an OAuth app (the team you use becomes the sign-in team for local Chef).

Under Settings → Environment Variables, set:

```
BIG_BRAIN_HOST=https://api.convex.dev
CONVEX_OAUTH_CLIENT_ID=<value from oauth setup>
CONVEX_OAUTH_CLIENT_SECRET=<value from oauth setup>
WORKOS_CLIENT_ID=<value from .env.development>
```

Add model keys locally in .env.local for codegen:

```
ANTHROPIC_API_KEY=<your api key>
GOOGLE_API_KEY=<your api key>
OPENAI_API_KEY=<your api key>
XAI_API_KEY=<your api key>
```

Running (dev)

In one terminal:

```
pnpm run dev
```

In another terminal:

```
npx convex dev
```

Access Chef at http://127.0.0.1:{port} (not http://localhost:{port}).

## Build / Typecheck / Tests

Typecheck (no emit):

```
pnpm -r exec tsc --noEmit
```

Build the prompt artifact:

```
pnpm run build:system-prompts
```

Tests (vitest):

```
pnpm test
```

## Prompt System Architecture

Source modules live in `chef-agent/prompts/`

Examples: `system.ts` (orchestrator), `convexGuidelines.ts`, `outputInstructions.ts`, `solutionConstraints.ts`, `secretsInstructions.ts`

Builder script: `buildSystemPrompts.ts` (generates the release artifact)

Usage: import prompt functions/constants directly from `chef-agent/prompts/*`. Do not commit compiled artifacts.

## Reusing Chef Components

Agent core: `chef-agent/ChatContextManager.ts`, `chef-agent/message-parser.ts`

Prompts: import from `chef-agent/prompts/system.ts` and siblings

Tools: `chef-agent/tools/*` (some Convex-specific—see file headers)

Templates: see `template/` for scaffolding patterns

## Agent Evaluation

`test-kitchen/` provides an evaluation harness:

- `initialGeneration.eval.ts` (Braintrust integration)
- `chefTask.ts` (task definition)

Typical run (requires API keys):

```
ANTHROPIC_API_KEY=<key> npx braintrust eval initialGeneration.eval.ts
```

## Safe-to-edit vs caution zones

Prefer editing:

- `chef-agent/tools/*`, `chef-agent/prompts/*`, `chefshot/*`, `template/*`, `test-kitchen/*`

Caution (read-first):

- `convex/*`, `app/*`, `proxy/*`, `iframe-worker/*`

Root configs (`tsconfig.json`, `pnpm-workspace.yaml`, ESLint) — do not mass-reformat

## File ops policy

Avoid renames/moves unless explicitly instructed.

Keep diffs small; run `pnpm -r exec tsc --noEmit` after edits.

## Task Playbook for Agents

Explain the plan before edits (PR body or comments).

Prefer additive changes (exports, docs, examples).

Expose symbols via `chef-agent/index.ts` rather than moving files.

Keep Convex semantics intact; do not vendor/replace Convex in this repo.

Ensure typecheck passes; never commit secrets.

## Chef as an Agent Research Platform

Chef wasn’t built as a standalone commercial product; it’s a living lab for LLM-driven code generation on Convex. Contributions that improve agent workflows (docs, exports, examples) are welcome and reduce friction for the community.

## Conventions for commits/PRs

Small, atomic PRs; docs-only changes are encouraged.

Explain scope, surfaces touched, and test steps.

Favor JSDoc on new exports over sweeping refactors.

## Quick tree (orientation)
```
app/            # client + some serverless routes
chef-agent/     # agent loop, tools, prompts
chefshot/       # CLI interface
convex/         # database & server functions
template/       # project bootstrap
test-kitchen/   # agent harness & eval
```

## Why this will be welcomed

It aligns exactly with the current README flow, adds machine-readable guardrails, and highlights Chef’s research posture that Convex themselves emphasize.
