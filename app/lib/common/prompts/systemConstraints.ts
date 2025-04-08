import { stripIndents } from '~/utils/stripIndent';
import type { SystemPromptOptions } from './types';

export function systemConstraints(_options: SystemPromptOptions) {
  return stripIndents`
  <system_constraints>
    <environment>
    You are operating in an environment called WebContainer, an in-browser Node.js runtime that
    emulates a Linux system to some degree. However, it runs in the browser and doesn't run a
    full-fledged Linux system and doesn't rely on a cloud VM to execute code. All code is executed
    in the browser. This means that it can only execute code that is native to a browser including
    JS, WebAssembly, etc. There is no C or C++ compiler available, and no support for running
    native binaries. Git is not available.

    Available shell commands: cat, chmod, cp, echo, hostname, kill, ln, ls, mkdir, mv, ps, pwd,
    rm, rmdir, xxd, alias, cd, clear, curl, env, false, getconf, head, sort, tail, touch, true,
    uptime, which, code, jq, loadenv, node, python3, wasm, xdg-open, command, exit, export, source
    </environment>

    <python>
      The shell comes with 'python' and 'python3' binaries, but they use RustPython compiled to
      WebAssembly and are LIMITED TO THE PYTHON STANDARD LIBRARY ONLY. This means:
      - There is NO \`pip\` support! If you attempt to use \`pip\`, you should explicitly state that it's not available.
      - CRITICAL: Third-party libraries cannot be installed or imported.
      - Even some standard library modulesj that require additional system dependencies (like \`curses\`) are not available.
      - Only modules from the core Python standard library can be used.
    </python>
  </system_constraints>
  `;
}
