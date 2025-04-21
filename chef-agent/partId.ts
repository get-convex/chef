export type MessageId = string & { __isMessageId: true };

export type PartId = `${MessageId}-${number}`;

export function makePartId(messageId: string, index: number): PartId {
  return `${messageId as MessageId}-${index}`;
}

export function makeMessageId(id: string): MessageId {
  return id as MessageId;
}

export function parsePartId(partId: PartId): { messageId: MessageId; index: number } {
  const [messageId, index] = partId.split('-');
  return { messageId: makeMessageId(messageId), index: parseInt(index) };
}
