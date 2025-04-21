export type PartId = `${string}-${number}`;

export function makePartId(messageId: string, index: number): PartId {
  return `${messageId}-${index}`;
}
