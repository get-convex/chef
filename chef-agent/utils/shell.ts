/**
 * Cleans and formats terminal output while preserving structure and paths
 * Handles ANSI, OSC, and various terminal control sequences
 */
export function cleanTerminalOutput(input: string): string {
  // Step 1: Remove OSC sequences (including those with parameters)
  const removeOsc = input
    .replace(/\x1b\](\d+;[^\x07\x1b]*|\d+[^\x07\x1b]*)\x07/g, '')
    .replace(/\](\d+;[^\n]*|\d+[^\n]*)/g, '');

  // Step 2: Remove ANSI escape sequences and color codes more thoroughly
  const removeAnsi = removeOsc
    // Remove all escape sequences with parameters
    .replace(/\u001b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    // Remove color codes
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    // Clean up any remaining escape characters
    .replace(/\u001b/g, '')
    .replace(/\x1b/g, '');

  // Step 3: Clean up carriage returns and newlines
  const cleanNewlines = removeAnsi
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Step 4: Add newlines at key breakpoints while preserving paths
  const formatOutput = cleanNewlines
    // Preserve prompt line
    .replace(/^([~\/][^\n❯]+)❯/m, '$1\n❯')
    // Add newline before command output indicators
    .replace(/(?<!^|\n)>/g, '\n>')
    // Add newline before error keywords without breaking paths
    .replace(/(?<!^|\n|\w)(error|failed|warning|Error|Failed|Warning):/g, '\n$1:')
    // Add newline before 'at' in stack traces without breaking paths
    .replace(/(?<!^|\n|\/)(at\s+(?!async|sync))/g, '\nat ')
    // Ensure 'at async' stays on same line
    .replace(/\bat\s+async/g, 'at async')
    // Add newline before npm error indicators
    .replace(/(?<!^|\n)(npm ERR!)/g, '\n$1');

  // Step 5: Clean up whitespace while preserving intentional spacing
  const cleanSpaces = formatOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  // Step 6: Final cleanup
  return cleanSpaces
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
    .replace(/:\s+/g, ': ') // Normalize spacing after colons
    .replace(/\s{2,}/g, ' ') // Remove multiple spaces
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/\u0000/g, ''); // Remove null characters
}

const BANNED_LINES = ['transforming (', 'computing gzip size', 'idealTree buildDeps', 'timing reify:unpack'];

// Taken from https://github.com/sindresorhus/cli-spinners
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Cleaning terminal output helps the agent focus on the important parts and
// not waste input tokens.
export function cleanConvexOutput(output: string) {
  output = cleanTerminalOutput(output);
  const normalizedNewlines = output.replace('\r\n', '\n').replace('\r', '\n');
  const rawLines = normalizedNewlines.split('\n');
  let lastSpinnerLine: string | null = null;
  let lines = [];
  for (const line of rawLines) {
    if (BANNED_LINES.some((bannedLine) => line.includes(bannedLine))) {
      continue;
    }
    if (SPINNER_FRAMES.some((spinnerFrame) => line.startsWith(spinnerFrame))) {
      const lineWithoutSpinner = line.slice(1).trim();
      if (lineWithoutSpinner === lastSpinnerLine) {
        continue;
      }
      lastSpinnerLine = lineWithoutSpinner;
      lines.push(lineWithoutSpinner);
      continue;
    }
    lines.push(line);
  }

  // Remove all esbuild "could not resolve" errors except the last one
  const firstEsbuildNodeErrror = lines.findIndex((line) => line.includes('[ERROR] Could not resolve'));
  if (firstEsbuildNodeErrror !== -1) {
    const lastEsbuildNodeError = lines.findLastIndex((line) => line.includes('[ERROR] Could not resolve'));
    if (lastEsbuildNodeError !== -1) {
      // just keep the last one
      lines = [...lines.slice(0, firstEsbuildNodeErrror), ...lines.slice(lastEsbuildNodeError)];
    }
  }

  const result = lines.join('\n');
  if (output !== result) {
    console.log(`Sanitized output: ${output.length} -> ${result.length}`);
  }
  return result;
}
