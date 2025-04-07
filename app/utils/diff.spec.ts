import { describe, expect, it } from 'vitest';
import { getRelativePath } from '~/lib/stores/files';
import { WORK_DIR } from './constants';

describe('Diff', () => {
  it('should strip out Work_dir', () => {
    const filePath = `${WORK_DIR}/index.js`;
    const result = getRelativePath(filePath);
    expect(result).toBe('index.js');
  });
});
