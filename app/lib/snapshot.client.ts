import { IGNORED_RELATIVE_PATHS } from '~/utils/constants';
import { webcontainer } from './webcontainer';

export async function buildUncompressedSnapshot(): Promise<Uint8Array> {
  const container = await webcontainer;
  const start = Date.now();
  const snapshot = await container.export('.', {
    excludes: IGNORED_RELATIVE_PATHS,
    format: 'binary',
  });
  const end = Date.now();
  console.log(`Built snapshot in ${end - start}ms`);
  return snapshot;
}
