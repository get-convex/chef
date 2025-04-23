interface DirEnt<T> {
  name: T;
  isFile(): boolean;
  isDirectory(): boolean;
}

export function renderDirectory(children: DirEnt<string>[]) {
  return `Directory:\n${children.map((child) => `- ${child.name} (${child.isDirectory() ? 'dir' : 'file'})`).join('\n')}`;
}
