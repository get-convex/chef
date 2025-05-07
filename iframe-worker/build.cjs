const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

(async function () {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'worker.mts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: false,
    write: false,
    absWorkingDir: __dirname,
    external: [],
  });

  const outputFiles = result.outputFiles;

  if (outputFiles && outputFiles.length > 0) {
    let code = outputFiles[0].text;
    const outputPath = path.join(__dirname, 'worker.bundled.mjs');
    fs.writeFileSync(outputPath, code, 'utf8');
    console.log(`Bundle written to ${outputPath}`);
  } else {
    throw new Error('no output');
  }
})();
