export function stripIndents(value: string): string;
export function stripIndents(strings: TemplateStringsArray, ...values: any[]): string;
export function stripIndents(arg0: string | TemplateStringsArray, ...values: any[]) {
  if (typeof arg0 !== 'string') {
    const processedString = arg0.reduce((acc, curr, i) => {
      acc += curr + (values[i] ?? '');
      return acc;
    }, '');

    return _stripIndents(processedString);
  }

  return _stripIndents(arg0);
}

function _stripIndents(value: string) {
  let minIndent = Infinity;
  for (const line of value.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.length === 0) {
      continue;
    }
    minIndent = Math.min(minIndent, line.length - trimmed.length);
  }
  if (minIndent === Infinity) {
    return value;
  }
  return value
    .split('\n')
    .map((line) => line.slice(minIndent).trimEnd())
    .filter((line) => line.length > 0)
    .join('\n')
    .replace(/[\r\n]$/, '');
}
