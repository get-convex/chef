# Chefshot

Goal is to run evals with this.

### Examples

Run all of these from the repo root (not this directory, one level up)

Download filesystem to my-app and print all messages

```
npx convex dev --once; pnpm run build; pnpm run start;
# and then in another terminal
npx chefshot generate "Let's make a chat app" --messages-file foo.json --prod | jq
```

Just save the messages you get from a prompt in prod

```
npx chefshot "Let's make a chat app!" --messages-file foo.json --prod
```

Debug

```
npx convex dev --once; pnpm run dev
# and then in another terminal
npx chefshot generate "Let's make a chat app" --dev --no-headless
```

# Credentials

This script only works for username/password dashboard logins.
It reads from these environment variables, you can get them
with `npx vercel env pull` from the root repo directory (not in
this directory).

```
CHEF_EVAL_USER_PASSWORD
CHEF_EVAL_USER_EMAIL
```

You can log into the dashboard with these credentials by visiting

https://dashboard.convex.dev/api/auth/login?useEmail=true
