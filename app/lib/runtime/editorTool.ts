import { z } from 'zod';
import { readPath } from '~/utils/fileUtils';
import { renderFile } from '~/utils/fileUtils';
import { renderDirectory } from '~/utils/fileUtils';
import { workDirRelative } from '~/utils/fileUtils';
import type { WebContainer } from '@webcontainer/api';

export const editorToolParameters = z.object({
  command: z.union([
    z.literal('view'),
    z.literal('create'),
    z.literal('str_replace'),
    z.literal('insert'),
    z.literal('undo_edit'),
  ]),
  path: z.string(),
  file_text: z.string().optional(),
  insert_line: z.number().optional(),
  new_str: z.string().optional(),
  old_str: z.string().optional(),
  view_range: z.tuple([z.number(), z.number()]).optional(),
});

export async function editor(
  container: WebContainer,
  args: z.infer<typeof editorToolParameters>,
  backupStack: BackupStack,
) {
  const relPath = workDirRelative(args.path);
  switch (args.command) {
    // The view command allows Claude to examine the contents of a file or list
    // the contents of a directory. It can read the entire file or a specific
    // range of lines.
    case 'view': {
      const result = await readPath(container, relPath);
      if (result.type === 'directory') {
        return renderDirectory(result.children);
      }
      return renderFile(result.content, args.view_range);
    }
    case 'str_replace': {
      const oldContent = await container.fs.readFile(relPath, 'utf-8');
      let newContent: string;
      if (args.old_str) {
        const matchPos = oldContent.indexOf(args.old_str);
        if (matchPos === -1) {
          throw new Error('No match found for replacement. Please check your text and try again.');
        }
        if (oldContent.slice(matchPos + 1).indexOf(args.old_str) !== -1) {
          throw new Error('Multiple matches found for replacement. Please specify a more specific search term.');
        }
        newContent = oldContent.replace(args.old_str, args.new_str ?? '');
      } else {
        newContent = args.new_str ?? '';
      }
      backupStack.pushBackup(args.path, oldContent);
      await container.fs.writeFile(relPath, newContent);
      return `Successfully replaced text at exactly one location.`;
    }
    case 'create': {
      const relPath = workDirRelative(args.path);
      if (relPath.includes('/')) {
        const dir = relPath.slice(0, relPath.lastIndexOf('/'));
        await container.fs.mkdir(dir, { recursive: true });
      }
      await container.fs.writeFile(relPath, args.file_text ?? '');
      return `Successfully created file ${args.path}`;
    }
    case 'insert': {
      const relPath = workDirRelative(args.path);
      const oldContent = await container.fs.readFile(relPath, 'utf-8');
      const lines = oldContent.split('\n');

      if (!args.insert_line || !args.new_str) {
        throw new Error('Insert line and new string are required');
      }

      // NB: `insert_line` is the 1-indexed line number after which to insert the
      // text (where 0 is the beginning of the file). `Array.splice(i, 0)` inserts
      // the line *before* zero-indexed line `i`. So, we can just pass
      // `args.insert_line` directly.
      lines.splice(args.insert_line, 0, args.new_str);
      const newContent = lines.join('\n');
      await container.fs.writeFile(relPath, newContent);

      backupStack.pushBackup(args.path, oldContent);
      return `Successfully inserted text at line ${args.insert_line}.`;
    }
    case 'undo_edit': {
      const relPath = workDirRelative(args.path);
      const oldContent = backupStack.popBackup(args.path);
      if (!oldContent) {
        throw new Error(`No backup found for ${args.path}`);
      }
      await container.fs.writeFile(relPath, oldContent);
      return `Successfully restored ${args.path} to its previous state.`;
    }
    default: {
      throw new Error(`Unknown command: ${JSON.stringify(args)}`);
    }
  }
}

export class BackupStack {
  backups: Record<string, string[]> = {};

  pushBackup(absPath: string, content: string) {
    let existing = this.backups[absPath];
    if (!existing) {
      existing = [];
      this.backups[absPath] = existing;
    }
    existing.push(content);
  }

  popBackup(absPath: string) {
    const existing = this.backups[absPath];
    if (!existing) {
      return null;
    }
    return existing.pop();
  }
}
