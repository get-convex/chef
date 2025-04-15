const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

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
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'proxy.cjs')],
    bundle: true,
    platform: 'node',
    target: 'node16',
    minify: false,
    write: false,
    absWorkingDir: __dirname,
    plugins: [stubFollowRedirectsPlugin],
    external: [],
  });

  const outputFiles = result.outputFiles;

  if (outputFiles && outputFiles.length > 0) {
    let code = outputFiles[0].text;

    const singleQuoteCount = (code.match(/'/g) || []).length;
    code = code.replaceAll("'", '"');
    code = code.replaceAll('"\\r\\n\\r\\n"', 'String.fromCharCode(13, 10, 13, 10)');
    code = code.replaceAll('"\\r\\n"', 'String.fromCharCode(13, 10)');
    const outputPath = path.join(__dirname, 'proxy.bundled.cjs');
    fs.writeFileSync(outputPath, code, 'utf8');

    console.log(`Bundle written to ${outputPath}`);

    const expected = 2;
    if (singleQuoteCount !== expected) {
      console.log(
        `Found ${singleQuoteCount} single quote (') characters, expected ${expected}. Make sure transformation still produces valid JS.`,
      );
      process.exit(1);
    }
  } else {
    throw new Error('no output');
  }
})();
