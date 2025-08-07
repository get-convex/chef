import type { DirEnt } from '@webcontainer/api';
import { WORK_DIR } from 'chef-agent/constants';
import type { WebContainer } from '@webcontainer/api';

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
  // The agent often sends relative paths instead of absolute paths, so we should just return that.
  if (!absPath.startsWith(withSlash)) {
    return absPath;
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
  return {
    type: 'file',

    file: {
      content,
      isBinary: false
    }
  };
}
