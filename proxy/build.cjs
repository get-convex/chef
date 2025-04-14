const esbuild = require('esbuild');
const path = require('path');

// Create a plugin to stub follow-redirects with an empty object
const stubFollowRedirectsPlugin = {
  name: 'stub-follow-redirects-plugin',
  setup(build) {
    build.onResolve({ filter: /^follow-redirects$/ }, (args) => {
      return { path: args.path, namespace: 'stub-follow-redirects' };
    });

    build.onLoad({ filter: /.*/, namespace: 'stub-follow-redirects' }, () => {
      return {
        contents: 'module.exports = {};',
        loader: 'js',
      };
    });
  },
};

(async function () {
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'proxy.cjs')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    minify: false,
    outfile: path.join(__dirname, 'proxy.bundled.cjs'),
    absWorkingDir: __dirname,
    plugins: [stubFollowRedirectsPlugin],
    external: [],
  });
})();
