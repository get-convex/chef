import type { z, SafeParseReturnType, ZodTypeDef } from 'zod';

const previouslySeen: WeakSet<any> = new WeakSet();

export function loggingSafeParse<Output>(
  schema: z.ZodSchema<Output, ZodTypeDef>,
  args: any,
): SafeParseReturnType<any, Output> {
  const result = schema.safeParse(args);
  if (!result.success && !previouslySeen.has(args)) {
    if (typeof args === 'object' && args !== null) {
      console.error('Failed to parse zod', args, result.error);
      previouslySeen.add(args);
    }
  }
  return result;
}
