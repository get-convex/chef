# Test Kitchen

## Instructions

```bash
pnpm i

BRAINTRUST_API_KEY=<..> ANTHROPIC_API_KEY=<..> npx braintrust eval initialGeneration.eval.ts
```

You can also run it as a oneoff (without Braintrust) via `main.ts`:

```bash
ANTHROPIC_API_KEY=<..> bun run main.ts
```
