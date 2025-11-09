// vite.config.ts
import { vitePlugin as remix } from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/@remix-run+dev@2.15.3_@remix-run+react@2.15.3_react-dom@18.3.1_react@18.3.1__react@18.3.1_typ_yyl3iqdsdryeciubstza6pglti/node_modules/@remix-run/dev/dist/index.js";
import { defineConfig } from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/vite@5.4.17_@types+node@22.14.0_sass-embedded@1.83.4_sugarss@4.0.1_postcss@8.5.3_/node_modules/vite/dist/node/index.js";
import { vercelPreset } from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/@vercel+remix@2.15.3_@remix-run+dev@2.15.3_@remix-run+react@2.15.3_react-dom@18.3.1_react@18._hbem6ksc4cb3wmnk2w32hbvu3q/node_modules/@vercel/remix/vite.js";
import tsconfigPaths from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/vite-tsconfig-paths@4.3.2_typescript@5.7.3_vite@5.4.17_@types+node@22.14.0_sass-embedded@1.83_vnn7t3lunnjfitqrfu7ky5zbs4/node_modules/vite-tsconfig-paths/dist/index.mjs";
import * as dotenv from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/dotenv@16.4.7/node_modules/dotenv/lib/main.js";
import { optimizeCssModules } from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/vite-plugin-optimize-css-modules@1.2.0_vite@5.4.17_@types+node@22.14.0_sass-embedded@1.83.4_s_a27ifuwdkx2vfg6z5x7ywtlnh4/node_modules/vite-plugin-optimize-css-modules/dist/index.mjs";
import wasm from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/vite-plugin-wasm@3.4.1_vite@5.4.17_@types+node@22.14.0_sass-embedded@1.83.4_sugarss@4.0.1_postcss@8.5.3__/node_modules/vite-plugin-wasm/exports/import.mjs";
import { nodePolyfills } from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/vite-plugin-node-polyfills@0.22.0_rollup@3.29.5_vite@5.4.17_@types+node@22.14.0_sass-embedded_xizib6s5m5pihiookdkm7eg3yy/node_modules/vite-plugin-node-polyfills/dist/index.js";
import { sentryVitePlugin } from "file:///C:/Users/abdo2/Documents/GitHub/chef/node_modules/.pnpm/@sentry+vite-plugin@3.3.1/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
dotenv.config();
var vite_config_default = defineConfig((config2) => {
  return {
    define: {
      "process.env.VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV),
      "process.env.VERCEL_GIT_COMMIT_SHA": JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA)
    },
    /*
     * Remix Vite likes to avoid bundling server-side code, so you can end up with errors in Vercel like
     *
     * [commonjs--resolver] Could not load /Users/tomb/simple-vercel-remix/node_modules/.pnpm/util@0.12.5/node_modules/util/types:
     * ENOENT: no such file or directory, open '/Users/tomb/simple-vercel-remix/node_modules/.pnpm/util@0.12.5/node_modules/util/types'
     *
     * so we may need to bundle in prod. But we need to make sure we don't bundle do it in dev:
     * https://github.com/remix-run/react-router/issues/13075
     *
     * If we have this issue we need to turn on `noExternal: true`, or manually bundle more libraries.
     */
    ssr: config2.command === "build" ? {
      // noExternal: true,
      //
      // Some dependencies are hard to bundler.
      external: [
        // the bundler must think this has side effects because I can't
        // bundle it without problems
        "cloudflare",
        // something about eval
        "@protobufjs/inquire",
        // doesn't actually help, remove this
        "@protobufjs/inquire?commonjs-external",
        // these were guesses to fix a bundling issue, must have
        // needed at least on of the not to be bundled.
        "@sentry/remix",
        "vite-plugin-node-polyfills"
      ]
    } : { noExternal: ["@protobufjs/inquire"] },
    build: {
      // this enabled top-level await
      target: "esnext",
      // our source isn't very secret, but this does make it very important not to harcode secrets:
      // sourcemaps may include backend code!
      sourcemap: true,
      rollupOptions: {
        output: {
          format: "esm"
        }
      },
      commonjsOptions: {
        transformMixedEsModules: true
      }
    },
    optimizeDeps: {
      include: [
        "jose",
        // discovered late during dev so causes a reload when optimizing
        "classnames",
        // fix for @convex-dev/design-system to work
        // these are all used by @convex-dev/design-system/Combobox (also see knip.jsonc)
        "react-dom",
        "react-fast-compare",
        "warning",
        "fuzzy"
      ],
      esbuildOptions: {
        define: {
          global: "globalThis"
        }
      }
    },
    resolve: {
      alias: {
        buffer: "vite-plugin-node-polyfills/polyfills/buffer",
        ...config2.mode === "test" ? { "lz4-wasm": "lz4-wasm/dist/index.js" } : {}
      }
    },
    server: {
      host: "127.0.0.1",
      // feel free to disable, just using this to foolproof dev
      strictPort: true
    },
    plugins: [
      // This is complicated: we're polyfilling the browser (!) for some things
      // and were previously polyfilling Cloudflare worker functions for some things.
      // Now we could probably remove some since we're using Node.js in Vercel
      // instead of Cloudflare or Vercel Edge workers.
      nodePolyfills({
        include: ["buffer", "process", "stream"],
        globals: {
          Buffer: true,
          process: true,
          // this is actually require for some terminal stuff
          // like the shell tool
          global: true
        },
        protocolImports: true,
        // Exclude Node.js modules that shouldn't be polyfilled in Cloudflare
        exclude: ["child_process", "fs", "path"]
      }),
      // Required to run the file write tool locally
      {
        name: "buffer-polyfill",
        transform(code, id) {
          if (id.includes("env.mjs")) {
            return {
              code: `import { Buffer } from 'buffer';
${code}`,
              map: null
            };
          }
        }
      },
      remix({
        // Vercel presets move build outputs to ./build/server/nodejs-eyABC...
        // making it harder to serve them locally.
        // Hopefully it does nothing else important...
        ...process.env.VERCEL ? { presets: [vercelPreset()] } : {},
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true
        }
      }),
      tsconfigPaths(),
      config2.mode === "production" && optimizeCssModules({ apply: "build" }),
      wasm(),
      sentryVitePlugin({
        // TODO there's probably some correct environment variable name to use here instead
        authToken: process.env.SENTRY_VITE_PLUGIN_AUTH_TOKEN,
        org: "convex-dev",
        project: "4509097600811008",
        // Only upload source maps for production
        disable: process.env.VERCEL_ENV !== "production"
      })
    ],
    envPrefix: ["VITE_"],
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler"
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhYmRvMlxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXGNoZWZcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFiZG8yXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcY2hlZlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWJkbzIvRG9jdW1lbnRzL0dpdEh1Yi9jaGVmL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgdml0ZVBsdWdpbiBhcyByZW1peCB9IGZyb20gJ0ByZW1peC1ydW4vZGV2JztcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCB7IHZlcmNlbFByZXNldCB9IGZyb20gJ0B2ZXJjZWwvcmVtaXgvdml0ZSc7XHJcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gJ3ZpdGUtdHNjb25maWctcGF0aHMnO1xyXG5pbXBvcnQgKiBhcyBkb3RlbnYgZnJvbSAnZG90ZW52JztcclxuaW1wb3J0IHsgb3B0aW1pemVDc3NNb2R1bGVzIH0gZnJvbSAndml0ZS1wbHVnaW4tb3B0aW1pemUtY3NzLW1vZHVsZXMnO1xyXG5pbXBvcnQgd2FzbSBmcm9tICd2aXRlLXBsdWdpbi13YXNtJztcclxuaW1wb3J0IHsgbm9kZVBvbHlmaWxscyB9IGZyb20gJ3ZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzJztcclxuaW1wb3J0IHsgc2VudHJ5Vml0ZVBsdWdpbiB9IGZyb20gJ0BzZW50cnkvdml0ZS1wbHVnaW4nO1xyXG5cclxuZG90ZW52LmNvbmZpZygpO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKChjb25maWcpID0+IHtcclxuICByZXR1cm4ge1xyXG4gICAgZGVmaW5lOiB7XHJcbiAgICAgICdwcm9jZXNzLmVudi5WRVJDRUxfRU5WJzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYuVkVSQ0VMX0VOViksXHJcbiAgICAgICdwcm9jZXNzLmVudi5WRVJDRUxfR0lUX0NPTU1JVF9TSEEnOiBKU09OLnN0cmluZ2lmeShwcm9jZXNzLmVudi5WRVJDRUxfR0lUX0NPTU1JVF9TSEEpLFxyXG4gICAgfSxcclxuXHJcbiAgICAvKlxyXG4gICAgICogUmVtaXggVml0ZSBsaWtlcyB0byBhdm9pZCBidW5kbGluZyBzZXJ2ZXItc2lkZSBjb2RlLCBzbyB5b3UgY2FuIGVuZCB1cCB3aXRoIGVycm9ycyBpbiBWZXJjZWwgbGlrZVxyXG4gICAgICpcclxuICAgICAqIFtjb21tb25qcy0tcmVzb2x2ZXJdIENvdWxkIG5vdCBsb2FkIC9Vc2Vycy90b21iL3NpbXBsZS12ZXJjZWwtcmVtaXgvbm9kZV9tb2R1bGVzLy5wbnBtL3V0aWxAMC4xMi41L25vZGVfbW9kdWxlcy91dGlsL3R5cGVzOlxyXG4gICAgICogRU5PRU5UOiBubyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5LCBvcGVuICcvVXNlcnMvdG9tYi9zaW1wbGUtdmVyY2VsLXJlbWl4L25vZGVfbW9kdWxlcy8ucG5wbS91dGlsQDAuMTIuNS9ub2RlX21vZHVsZXMvdXRpbC90eXBlcydcclxuICAgICAqXHJcbiAgICAgKiBzbyB3ZSBtYXkgbmVlZCB0byBidW5kbGUgaW4gcHJvZC4gQnV0IHdlIG5lZWQgdG8gbWFrZSBzdXJlIHdlIGRvbid0IGJ1bmRsZSBkbyBpdCBpbiBkZXY6XHJcbiAgICAgKiBodHRwczovL2dpdGh1Yi5jb20vcmVtaXgtcnVuL3JlYWN0LXJvdXRlci9pc3N1ZXMvMTMwNzVcclxuICAgICAqXHJcbiAgICAgKiBJZiB3ZSBoYXZlIHRoaXMgaXNzdWUgd2UgbmVlZCB0byB0dXJuIG9uIGBub0V4dGVybmFsOiB0cnVlYCwgb3IgbWFudWFsbHkgYnVuZGxlIG1vcmUgbGlicmFyaWVzLlxyXG4gICAgICovXHJcbiAgICBzc3I6XHJcbiAgICAgIGNvbmZpZy5jb21tYW5kID09PSAnYnVpbGQnXHJcbiAgICAgICAgPyB7XHJcbiAgICAgICAgICAgIC8vIG5vRXh0ZXJuYWw6IHRydWUsXHJcbiAgICAgICAgICAgIC8vXHJcbiAgICAgICAgICAgIC8vIFNvbWUgZGVwZW5kZW5jaWVzIGFyZSBoYXJkIHRvIGJ1bmRsZXIuXHJcbiAgICAgICAgICAgIGV4dGVybmFsOiBbXHJcbiAgICAgICAgICAgICAgLy8gdGhlIGJ1bmRsZXIgbXVzdCB0aGluayB0aGlzIGhhcyBzaWRlIGVmZmVjdHMgYmVjYXVzZSBJIGNhbid0XHJcbiAgICAgICAgICAgICAgLy8gYnVuZGxlIGl0IHdpdGhvdXQgcHJvYmxlbXNcclxuICAgICAgICAgICAgICAnY2xvdWRmbGFyZScsXHJcbiAgICAgICAgICAgICAgLy8gc29tZXRoaW5nIGFib3V0IGV2YWxcclxuICAgICAgICAgICAgICAnQHByb3RvYnVmanMvaW5xdWlyZScsXHJcbiAgICAgICAgICAgICAgLy8gZG9lc24ndCBhY3R1YWxseSBoZWxwLCByZW1vdmUgdGhpc1xyXG4gICAgICAgICAgICAgICdAcHJvdG9idWZqcy9pbnF1aXJlP2NvbW1vbmpzLWV4dGVybmFsJyxcclxuXHJcbiAgICAgICAgICAgICAgLy8gdGhlc2Ugd2VyZSBndWVzc2VzIHRvIGZpeCBhIGJ1bmRsaW5nIGlzc3VlLCBtdXN0IGhhdmVcclxuICAgICAgICAgICAgICAvLyBuZWVkZWQgYXQgbGVhc3Qgb24gb2YgdGhlIG5vdCB0byBiZSBidW5kbGVkLlxyXG4gICAgICAgICAgICAgICdAc2VudHJ5L3JlbWl4JyxcclxuXHJcbiAgICAgICAgICAgICAgJ3ZpdGUtcGx1Z2luLW5vZGUtcG9seWZpbGxzJyxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgIH1cclxuICAgICAgICA6IHsgbm9FeHRlcm5hbDogWydAcHJvdG9idWZqcy9pbnF1aXJlJ10gfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIC8vIHRoaXMgZW5hYmxlZCB0b3AtbGV2ZWwgYXdhaXRcclxuICAgICAgdGFyZ2V0OiAnZXNuZXh0JyxcclxuICAgICAgLy8gb3VyIHNvdXJjZSBpc24ndCB2ZXJ5IHNlY3JldCwgYnV0IHRoaXMgZG9lcyBtYWtlIGl0IHZlcnkgaW1wb3J0YW50IG5vdCB0byBoYXJjb2RlIHNlY3JldHM6XHJcbiAgICAgIC8vIHNvdXJjZW1hcHMgbWF5IGluY2x1ZGUgYmFja2VuZCBjb2RlIVxyXG4gICAgICBzb3VyY2VtYXA6IHRydWUsXHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgIGZvcm1hdDogJ2VzbScsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgY29tbW9uanNPcHRpb25zOiB7XHJcbiAgICAgICAgdHJhbnNmb3JtTWl4ZWRFc01vZHVsZXM6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGluY2x1ZGU6IFtcclxuICAgICAgICAnam9zZScsIC8vIGRpc2NvdmVyZWQgbGF0ZSBkdXJpbmcgZGV2IHNvIGNhdXNlcyBhIHJlbG9hZCB3aGVuIG9wdGltaXppbmdcclxuICAgICAgICAnY2xhc3NuYW1lcycsIC8vIGZpeCBmb3IgQGNvbnZleC1kZXYvZGVzaWduLXN5c3RlbSB0byB3b3JrXHJcblxyXG4gICAgICAgIC8vIHRoZXNlIGFyZSBhbGwgdXNlZCBieSBAY29udmV4LWRldi9kZXNpZ24tc3lzdGVtL0NvbWJvYm94IChhbHNvIHNlZSBrbmlwLmpzb25jKVxyXG4gICAgICAgICdyZWFjdC1kb20nLFxyXG4gICAgICAgICdyZWFjdC1mYXN0LWNvbXBhcmUnLFxyXG4gICAgICAgICd3YXJuaW5nJyxcclxuICAgICAgICAnZnV6enknLFxyXG4gICAgICBdLFxyXG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xyXG4gICAgICAgIGRlZmluZToge1xyXG4gICAgICAgICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcycsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgYnVmZmVyOiAndml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHMvcG9seWZpbGxzL2J1ZmZlcicsXHJcbiAgICAgICAgLi4uKGNvbmZpZy5tb2RlID09PSAndGVzdCcgPyB7ICdsejQtd2FzbSc6ICdsejQtd2FzbS9kaXN0L2luZGV4LmpzJyB9IDoge30pLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBob3N0OiAnMTI3LjAuMC4xJyxcclxuICAgICAgLy8gZmVlbCBmcmVlIHRvIGRpc2FibGUsIGp1c3QgdXNpbmcgdGhpcyB0byBmb29scHJvb2YgZGV2XHJcbiAgICAgIHN0cmljdFBvcnQ6IHRydWUsXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICAvLyBUaGlzIGlzIGNvbXBsaWNhdGVkOiB3ZSdyZSBwb2x5ZmlsbGluZyB0aGUgYnJvd3NlciAoISkgZm9yIHNvbWUgdGhpbmdzXHJcbiAgICAgIC8vIGFuZCB3ZXJlIHByZXZpb3VzbHkgcG9seWZpbGxpbmcgQ2xvdWRmbGFyZSB3b3JrZXIgZnVuY3Rpb25zIGZvciBzb21lIHRoaW5ncy5cclxuICAgICAgLy8gTm93IHdlIGNvdWxkIHByb2JhYmx5IHJlbW92ZSBzb21lIHNpbmNlIHdlJ3JlIHVzaW5nIE5vZGUuanMgaW4gVmVyY2VsXHJcbiAgICAgIC8vIGluc3RlYWQgb2YgQ2xvdWRmbGFyZSBvciBWZXJjZWwgRWRnZSB3b3JrZXJzLlxyXG4gICAgICBub2RlUG9seWZpbGxzKHtcclxuICAgICAgICBpbmNsdWRlOiBbJ2J1ZmZlcicsICdwcm9jZXNzJywgJ3N0cmVhbSddLFxyXG4gICAgICAgIGdsb2JhbHM6IHtcclxuICAgICAgICAgIEJ1ZmZlcjogdHJ1ZSxcclxuICAgICAgICAgIHByb2Nlc3M6IHRydWUsIC8vIHRoaXMgaXMgYWN0dWFsbHkgcmVxdWlyZSBmb3Igc29tZSB0ZXJtaW5hbCBzdHVmZlxyXG4gICAgICAgICAgLy8gbGlrZSB0aGUgc2hlbGwgdG9vbFxyXG4gICAgICAgICAgZ2xvYmFsOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcHJvdG9jb2xJbXBvcnRzOiB0cnVlLFxyXG4gICAgICAgIC8vIEV4Y2x1ZGUgTm9kZS5qcyBtb2R1bGVzIHRoYXQgc2hvdWxkbid0IGJlIHBvbHlmaWxsZWQgaW4gQ2xvdWRmbGFyZVxyXG4gICAgICAgIGV4Y2x1ZGU6IFsnY2hpbGRfcHJvY2VzcycsICdmcycsICdwYXRoJ10sXHJcbiAgICAgIH0pLFxyXG4gICAgICAvLyBSZXF1aXJlZCB0byBydW4gdGhlIGZpbGUgd3JpdGUgdG9vbCBsb2NhbGx5XHJcbiAgICAgIHtcclxuICAgICAgICBuYW1lOiAnYnVmZmVyLXBvbHlmaWxsJyxcclxuICAgICAgICB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZW52Lm1qcycpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgY29kZTogYGltcG9ydCB7IEJ1ZmZlciB9IGZyb20gJ2J1ZmZlcic7XFxuJHtjb2RlfWAsXHJcbiAgICAgICAgICAgICAgbWFwOiBudWxsLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICByZW1peCh7XHJcbiAgICAgICAgLy8gVmVyY2VsIHByZXNldHMgbW92ZSBidWlsZCBvdXRwdXRzIHRvIC4vYnVpbGQvc2VydmVyL25vZGVqcy1leUFCQy4uLlxyXG4gICAgICAgIC8vIG1ha2luZyBpdCBoYXJkZXIgdG8gc2VydmUgdGhlbSBsb2NhbGx5LlxyXG4gICAgICAgIC8vIEhvcGVmdWxseSBpdCBkb2VzIG5vdGhpbmcgZWxzZSBpbXBvcnRhbnQuLi5cclxuICAgICAgICAuLi4ocHJvY2Vzcy5lbnYuVkVSQ0VMID8geyBwcmVzZXRzOiBbdmVyY2VsUHJlc2V0KCldIH0gOiB7fSksXHJcbiAgICAgICAgZnV0dXJlOiB7XHJcbiAgICAgICAgICB2M19mZXRjaGVyUGVyc2lzdDogdHJ1ZSxcclxuICAgICAgICAgIHYzX3JlbGF0aXZlU3BsYXRQYXRoOiB0cnVlLFxyXG4gICAgICAgICAgdjNfdGhyb3dBYm9ydFJlYXNvbjogdHJ1ZSxcclxuICAgICAgICAgIHYzX2xhenlSb3V0ZURpc2NvdmVyeTogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KSxcclxuICAgICAgdHNjb25maWdQYXRocygpLFxyXG4gICAgICBjb25maWcubW9kZSA9PT0gJ3Byb2R1Y3Rpb24nICYmIG9wdGltaXplQ3NzTW9kdWxlcyh7IGFwcGx5OiAnYnVpbGQnIH0pLFxyXG4gICAgICB3YXNtKCksXHJcbiAgICAgIHNlbnRyeVZpdGVQbHVnaW4oe1xyXG4gICAgICAgIC8vIFRPRE8gdGhlcmUncyBwcm9iYWJseSBzb21lIGNvcnJlY3QgZW52aXJvbm1lbnQgdmFyaWFibGUgbmFtZSB0byB1c2UgaGVyZSBpbnN0ZWFkXHJcbiAgICAgICAgYXV0aFRva2VuOiBwcm9jZXNzLmVudi5TRU5UUllfVklURV9QTFVHSU5fQVVUSF9UT0tFTixcclxuICAgICAgICBvcmc6ICdjb252ZXgtZGV2JyxcclxuICAgICAgICBwcm9qZWN0OiAnNDUwOTA5NzYwMDgxMTAwOCcsXHJcbiAgICAgICAgLy8gT25seSB1cGxvYWQgc291cmNlIG1hcHMgZm9yIHByb2R1Y3Rpb25cclxuICAgICAgICBkaXNhYmxlOiBwcm9jZXNzLmVudi5WRVJDRUxfRU5WICE9PSAncHJvZHVjdGlvbicsXHJcbiAgICAgIH0pLFxyXG4gICAgXSxcclxuICAgIGVudlByZWZpeDogWydWSVRFXyddLFxyXG4gICAgY3NzOiB7XHJcbiAgICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcclxuICAgICAgICBzY3NzOiB7XHJcbiAgICAgICAgICBhcGk6ICdtb2Rlcm4tY29tcGlsZXInLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH07XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTBTLFNBQVMsY0FBYyxhQUFhO0FBQzlVLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sbUJBQW1CO0FBQzFCLFlBQVksWUFBWTtBQUN4QixTQUFTLDBCQUEwQjtBQUNuQyxPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx3QkFBd0I7QUFFMUIsY0FBTztBQUVkLElBQU8sc0JBQVEsYUFBYSxDQUFDQSxZQUFXO0FBQ3RDLFNBQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxNQUNOLDBCQUEwQixLQUFLLFVBQVUsUUFBUSxJQUFJLFVBQVU7QUFBQSxNQUMvRCxxQ0FBcUMsS0FBSyxVQUFVLFFBQVEsSUFBSSxxQkFBcUI7QUFBQSxJQUN2RjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQWFBLEtBQ0VBLFFBQU8sWUFBWSxVQUNmO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFJRSxVQUFVO0FBQUE7QUFBQTtBQUFBLFFBR1I7QUFBQTtBQUFBLFFBRUE7QUFBQTtBQUFBLFFBRUE7QUFBQTtBQUFBO0FBQUEsUUFJQTtBQUFBLFFBRUE7QUFBQSxNQUNGO0FBQUEsSUFDRixJQUNBLEVBQUUsWUFBWSxDQUFDLHFCQUFxQixFQUFFO0FBQUEsSUFDNUMsT0FBTztBQUFBO0FBQUEsTUFFTCxRQUFRO0FBQUE7QUFBQTtBQUFBLE1BR1IsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLFFBQ2IsUUFBUTtBQUFBLFVBQ04sUUFBUTtBQUFBLFFBQ1Y7QUFBQSxNQUNGO0FBQUEsTUFDQSxpQkFBaUI7QUFBQSxRQUNmLHlCQUF5QjtBQUFBLE1BQzNCO0FBQUEsSUFDRjtBQUFBLElBQ0EsY0FBYztBQUFBLE1BQ1osU0FBUztBQUFBLFFBQ1A7QUFBQTtBQUFBLFFBQ0E7QUFBQTtBQUFBO0FBQUEsUUFHQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2QsUUFBUTtBQUFBLFVBQ04sUUFBUTtBQUFBLFFBQ1Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsR0FBSUEsUUFBTyxTQUFTLFNBQVMsRUFBRSxZQUFZLHlCQUF5QixJQUFJLENBQUM7QUFBQSxNQUMzRTtBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQTtBQUFBLE1BRU4sWUFBWTtBQUFBLElBQ2Q7QUFBQSxJQUNBLFNBQVM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BS1AsY0FBYztBQUFBLFFBQ1osU0FBUyxDQUFDLFVBQVUsV0FBVyxRQUFRO0FBQUEsUUFDdkMsU0FBUztBQUFBLFVBQ1AsUUFBUTtBQUFBLFVBQ1IsU0FBUztBQUFBO0FBQUE7QUFBQSxVQUVULFFBQVE7QUFBQSxRQUNWO0FBQUEsUUFDQSxpQkFBaUI7QUFBQTtBQUFBLFFBRWpCLFNBQVMsQ0FBQyxpQkFBaUIsTUFBTSxNQUFNO0FBQUEsTUFDekMsQ0FBQztBQUFBO0FBQUEsTUFFRDtBQUFBLFFBQ0UsTUFBTTtBQUFBLFFBQ04sVUFBVSxNQUFNLElBQUk7QUFDbEIsY0FBSSxHQUFHLFNBQVMsU0FBUyxHQUFHO0FBQzFCLG1CQUFPO0FBQUEsY0FDTCxNQUFNO0FBQUEsRUFBcUMsSUFBSTtBQUFBLGNBQy9DLEtBQUs7QUFBQSxZQUNQO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsTUFFQSxNQUFNO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFJSixHQUFJLFFBQVEsSUFBSSxTQUFTLEVBQUUsU0FBUyxDQUFDLGFBQWEsQ0FBQyxFQUFFLElBQUksQ0FBQztBQUFBLFFBQzFELFFBQVE7QUFBQSxVQUNOLG1CQUFtQjtBQUFBLFVBQ25CLHNCQUFzQjtBQUFBLFVBQ3RCLHFCQUFxQjtBQUFBLFVBQ3JCLHVCQUF1QjtBQUFBLFFBQ3pCO0FBQUEsTUFDRixDQUFDO0FBQUEsTUFDRCxjQUFjO0FBQUEsTUFDZEEsUUFBTyxTQUFTLGdCQUFnQixtQkFBbUIsRUFBRSxPQUFPLFFBQVEsQ0FBQztBQUFBLE1BQ3JFLEtBQUs7QUFBQSxNQUNMLGlCQUFpQjtBQUFBO0FBQUEsUUFFZixXQUFXLFFBQVEsSUFBSTtBQUFBLFFBQ3ZCLEtBQUs7QUFBQSxRQUNMLFNBQVM7QUFBQTtBQUFBLFFBRVQsU0FBUyxRQUFRLElBQUksZUFBZTtBQUFBLE1BQ3RDLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxXQUFXLENBQUMsT0FBTztBQUFBLElBQ25CLEtBQUs7QUFBQSxNQUNILHFCQUFxQjtBQUFBLFFBQ25CLE1BQU07QUFBQSxVQUNKLEtBQUs7QUFBQSxRQUNQO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsiY29uZmlnIl0KfQo=
