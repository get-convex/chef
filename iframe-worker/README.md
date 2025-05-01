The vite server of the template/snapshot vite app (the initial state of every Chef app)
injects code during development only so a Chef app in an iframe can listen to postMessage
messages from its parent Chef window.

The injected code just checks the message is from its parent, then loads this script
to response to the message.

This way we control the script if we ever needed to updated dependencies etc.

Updating this script requires a deploy because the script is served from
https://chef.convex.dev/scripts/worker.bundled.mjs. The WebContainer _can't_ make requests of localhost,
so use a proxy if you're updating it live in development. You'll need to add that to vite.config.ts
server.allowedHosts to use it.
