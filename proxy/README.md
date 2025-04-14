The Vite dev server response to both HTTP and HMR WebSocket traffic.

We proxy this traffic for previews so that different domains can be used
to simulate different users.

I couldn't get WebContainers to accept connections on different ports for
HTTP and WebSockets (although Vite is easy to configure to do this) so
we also need to proxy WebSocket traffic.

Although we could write a file to the WebContainer filesystem, it's
cleaner not to.

The Node.js in WebContainers does not support reading from stdin.
`node -e 'my very long script...'` works, but there's a broken parser
somewhere in there (breaks on the regex `/\\/+/g` for example) we
have to get past if we use `-e`.

Writing a very short proxy that works with WebSockets should be easy
(TODO) but I couldn't get it to work. So we bundle up a simple proxy server
built with node-http-proxy aka http-proxy.
