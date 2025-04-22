import { WORK_DIR } from '../constants.js';
import { path } from './path.js';

// Relative to `WORK_DIR`
export type RelativePath = string & { __brand: 'RelativePath' };
export type AbsolutePath = string & { __brand: 'AbsolutePath' };

export const getAbsolutePath = (pathString: string): AbsolutePath => {
  if (pathString.startsWith(WORK_DIR)) {
    return pathString as AbsolutePath;
  }
  return path.join(WORK_DIR, pathString) as AbsolutePath;
};

export const getRelativePath = (pathString: string): RelativePath => {
  if (pathString.startsWith(WORK_DIR)) {
    return path.relative(WORK_DIR, pathString) as RelativePath;
  }
  return pathString as RelativePath;
};
