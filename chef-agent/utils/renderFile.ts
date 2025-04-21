export function renderFile(content: string, viewRange?: [number, number]) {
  let lines = content.split('\n').map((line, index) => `${index + 1}: ${line}`);
  if (viewRange) {
    // An array of two integers specifying the start and end line numbers
    // to view. Line numbers are 1-indexed, and -1 for the end line means
    // read to the end of the file. This parameter only applies when
    // viewing files, not directories.
    const [start, end] = viewRange;
    if (start < 1) {
      throw new Error('Invalid range: start must be greater than 0');
    }
    if (end === -1) {
      lines = lines.slice(start - 1);
    } else {
      lines = lines.slice(start - 1, end);
    }
  }
  //  The view tool result includes file contents with line numbers prepended to each line
  // (e.g., “1: def is_prime(n):”). Line numbers are not required, but they are essential
  // for successfully using the view_range parameter to examine specific sections of files
  // and the insert_line parameter to add content at precise locations.
  return lines.join('\n');
}
