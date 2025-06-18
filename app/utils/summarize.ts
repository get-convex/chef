/**
 * Recursively processes an object and shortens all string fields to 100 characters with ellipses.
 * Useful for logging large objects without overwhelming Sentry.
 */
export function summarize<T>(obj: T, maxLength: number = 100): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    if (obj.length <= maxLength) {
      return obj;
    }
    return `${obj.slice(0, maxLength)}...` as T;
  }

  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map((item) => summarize(item, maxLength)) as T;
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = summarize(value, maxLength);
    }
    return result as T;
  }

  return obj;
}
