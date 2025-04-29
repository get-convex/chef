// TODO this was cool, do something to type our environment variables
export function getEnv(name: string): string | undefined {
  return globalThis.process.env[name];
}
