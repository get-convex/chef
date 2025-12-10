import { memo } from 'react';
import { Markdown } from './Markdown';
import type { UIMessage } from 'ai';

interface UserMessageProps {
  // AI SDK 5 uses parts array for UIMessage
  content: UIMessage['parts'];
}

export const UserMessage = memo(function UserMessage({ content }: UserMessageProps) {
  if (Array.isArray(content)) {
    const textItem = content.find((item): item is Extract<typeof item, { type: 'text' }> => item.type === 'text');
    const textContent = stripMetadata(textItem?.text || '');
    // In AI SDK 5, image parts have type 'file' with mediaType (not mimeType) starting with 'image/'
    // Cast to any for backwards compatibility with both formats
    const images = content.filter(
      (item: any) =>
        item.type === 'file' &&
        typeof (item.mediaType ?? item.mimeType) === 'string' &&
        (item.mediaType ?? item.mimeType).startsWith('image/'),
    );

    return (
      <div className="overflow-hidden text-sm">
        <div className="flex flex-col gap-4">
          {textContent && <Markdown html>{textContent}</Markdown>}
          {images.map((item: any, index: number) => {
            // In AI SDK 5, file parts have url property; older versions may have data
            const src =
              item.url ?? (typeof item.data === 'string' ? item.data : URL.createObjectURL(new Blob([item.data])));
            return (
              <img
                key={index}
                src={src}
                alt={`Image ${index + 1}`}
                className="h-auto max-w-full rounded-lg"
                style={{ maxHeight: '512px', objectFit: 'contain' }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // If content is not an array (undefined/null), show empty
  return (
    <div className="overflow-hidden text-sm">
      <Markdown html>{''}</Markdown>
    </div>
  );
});

export function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(artifactRegex, '');
}
