import type { DirEnt } from '@webcontainer/api';
import { WORK_DIR } from './constants';
import type { WebContainer } from '@webcontainer/api';

export const generateId = () => Math.random().toString(36).substring(2, 15);

export const filesToArtifacts = (files: { [path: string]: { content: string } }, id: string): string => {
  return `
<boltArtifact id="${id}" title="User Updated Files">
${Object.keys(files)
  .map(
    (filePath) => `
<boltAction type="file" filePath="${filePath}">
${files[filePath].content}
</boltAction>
`,
  )
  .join('\n')}
</boltArtifact>
  `;
};

export function workDirRelative(absPath: string) {
  if (absPath === WORK_DIR) {
    return '';
  }
  const withSlash = `${WORK_DIR}/`;
  if (!absPath.startsWith(withSlash)) {
    throw new Error(`Path is not relative to the work directory: ${absPath}`);
  }
  return absPath.slice(withSlash.length);
}

async function readDir(container: WebContainer, relPath: string): Promise<DirEnt<string>[]> {
  const children = await container.fs.readdir(relPath, {
    withFileTypes: true,
  });
  children.sort((a, b) => {
    // Directories first, then files
    if (a.isDirectory() && !b.isDirectory()) {
      return -1;
    }
    if (!a.isDirectory() && b.isDirectory()) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return children;
}

export async function readPath(
  container: WebContainer,
  relPath: string,
): Promise<{ type: 'directory'; children: DirEnt<string>[] } | { type: 'file'; content: string; isBinary: boolean }> {
  // There isn't a way to stat a path in the container, so try reading
  // it as a directory first.
  try {
    const children = await readDir(container, relPath);
    return { type: 'directory', children };
  } catch (e: any) {
    if (typeof e.message !== 'string') {
      throw e;
    }
    if (!e.message.startsWith('ENOTDIR')) {
      throw e;
    }
    // If we made it here, the path isn't a directory, so let's
    // try it as a file below.
  }
  const content = await container.fs.readFile(relPath, 'utf-8');
  return { type: 'file', content, isBinary: false };
}

export function renderDirectory(children: DirEnt<string>[]) {
  return `Directory:\n${children.map((child) => `- ${child.name} (${child.isDirectory() ? 'dir' : 'file'})`).join('\n')}`;
}

export function renderFile(content: string, viewRange?: [number, number]) {
  let lines = content.split('\n').map((line, index) => `${index + 1}: ${line}`);
  if (viewRange) {
    // An array of two integers specifying the start and end line numbers
    // to view. Line numbers are 1-indexed, and -1 for the end line means
    // read to the end of the file. This parameter only applies when
    // viewing files, not directories.
    const [start, end] = viewRange;
    if (start < 1) {
      throw new Error('Invalid range: start must be greater than 0');
    }
    if (end === -1) {
      lines = lines.slice(start - 1);
    } else {
      lines = lines.slice(start - 1, end);
    }
  }
  //  The view tool result includes file contents with line numbers prepended to each line
  // (e.g., “1: def is_prime(n):”). Line numbers are not required, but they are essential
  // for successfully using the view_range parameter to examine specific sections of files
  // and the insert_line parameter to add content at precise locations.
  return lines.join('\n');
}
