import { useState, useCallback, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Spinner } from '@ui/Spinner';
import { CameraIcon, CheckIcon, UploadIcon } from '@radix-ui/react-icons';
import { useConvexSessionId } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { toast } from 'sonner';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

type ThumbnailChooserProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestCapture?: () => Promise<string>;
};

export function ThumbnailChooser({ isOpen, onOpenChange, onRequestCapture }: ThumbnailChooserProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [lastUploadedPreview, setLastUploadedPreview] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [recentlyUploaded, setRecentlyUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useConvexSessionId();
  const chatId = useChatId();

  const currentShare = useQuery(api.socialShare.getCurrentSocialShare, {
    id: chatId,
    sessionId,
  });

  const thumbnailUrl = useQuery(
    api.socialShare.getSocialShare,
    currentShare?.code ? { code: currentShare.code } : 'skip',
  );
  const currentThumbnail = thumbnailUrl?.thumbnailUrl ?? null;

  // Reset local state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setLocalPreview(null);
      setLastUploadedPreview(null);
      setCaptureError(false);
      setIsDraggingImage(false);
    }
  }, [isOpen]);

  const captureNewImage = useCallback(async () => {
    if (!onRequestCapture) {
      return;
    }

    setIsCapturing(true);
    setCaptureError(false);
    try {
      const data = await onRequestCapture();
      setLocalPreview(data);
    } catch (error) {
      console.warn('Failed to capture preview:', error);
      setCaptureError(true);
    } finally {
      setIsCapturing(false);
    }
  }, [onRequestCapture]);

  // Auto-capture when modal opens with no image
  useEffect(() => {
    if (isOpen && !currentThumbnail && !localPreview && !isCapturing && onRequestCapture) {
      captureNewImage();
    }
  }, [isOpen, currentThumbnail, localPreview, isCapturing, captureNewImage, onRequestCapture]);

  const uploadImage = useCallback(
    async (imageData: string) => {
      setIsUploading(true);
      try {
        // Convert base64 to blob
        const response = await fetch(imageData);
        const blob = await response.blob();

        // Upload to Convex
        const convexUrl = getConvexSiteUrl();
        const uploadResponse = await fetch(`${convexUrl}/upload_thumbnail?sessionId=${sessionId}&chatId=${chatId}`, {
          method: 'POST',
          body: blob,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload thumbnail');
        }

        // Upload successful, update state
        setLastUploadedPreview(localPreview);
        setLocalPreview(null);
        setRecentlyUploaded(true);
        setTimeout(() => {
          setRecentlyUploaded(false);
          setLastUploadedPreview(null);
        }, 2000);
        toast.success('Thumbnail updated successfully');
      } catch (error) {
        console.error('Failed to upload thumbnail:', error);
        toast.error('Failed to upload thumbnail');
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, chatId, localPreview],
  );

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setLocalPreview(result);
        setCaptureError(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCancel = useCallback(() => {
    setLocalPreview(null);
    setCaptureError(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(() => {
    if (localPreview) {
      uploadImage(localPreview);
    }
  }, [localPreview, uploadImage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasImageFile = Array.from(e.dataTransfer.items).some(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    );
    setIsDraggingImage(hasImageFile);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingImage(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleImageFile(file);
      }
    },
    [handleImageFile],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    },
    [handleImageFile],
  );

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImageFile(file);
      }
    },
    [handleImageFile],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('paste', handlePaste);
      return () => {
        document.removeEventListener('paste', handlePaste);
      };
    }
    return undefined;
  }, [isOpen, handlePaste]);

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="z-max fixed inset-0 bg-black/50" />
      <Dialog.Content className="z-max fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bolt-elements-background-depth-1 p-6 shadow-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <Dialog.Title className="text-lg font-semibold">Sharing thumbnail</Dialog.Title>
          <p className="text-content-secondary">This image is used when you share your chat with a link.</p>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex h-[600px] w-[800px] flex-col items-center justify-center rounded ${
              isDraggingImage
                ? 'border-2 border-dashed border-blue-500 bg-blue-500/5'
                : `${isCapturing ? '' : captureError ? 'border-2 border-red-500/50' : ''}`
            } shadow-[inset_0_0_16px_rgba(0,0,0,0.08)] transition-colors duration-150`}
          >
            {localPreview || lastUploadedPreview || (!recentlyUploaded && currentThumbnail) ? (
              <div className="relative size-full">
                <img
                  src={localPreview || lastUploadedPreview || currentThumbnail || ''}
                  alt="Preview"
                  crossOrigin="anonymous"
                  className="absolute inset-0 size-full object-contain shadow-[0_0_16px_rgba(0,0,0,0.15)]"
                />
                {isDraggingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/5 backdrop-blur-[2px]">
                    <p className="text-lg font-medium text-blue-600">Drop image to replace</p>
                  </div>
                )}
              </div>
            ) : isCapturing ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner />
                <span className="text-sm text-content-secondary">Capturing preview...</span>
              </div>
            ) : (
              <div className="text-center text-content-secondary">
                <p>
                  {captureError
                    ? 'Failed to capture preview'
                    : isDraggingImage
                      ? 'Drop image here'
                      : 'No preview image available'}
                </p>
                <p className="mt-2 text-sm">
                  {captureError
                    ? 'Try uploading an image or taking a new screenshot'
                    : isDraggingImage
                      ? 'Release to add your image'
                      : 'Drop an image here, paste from clipboard, or use the buttons below'}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onRequestCapture && (
                <button
                  type="button"
                  onClick={captureNewImage}
                  disabled={isCapturing}
                  className={`flex min-w-44 items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors ${
                    isCapturing
                      ? 'cursor-not-allowed bg-bolt-elements-background-depth-4 text-content-secondary'
                      : 'bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4'
                  }`}
                >
                  <CameraIcon />
                  Take New Screenshot
                </button>
              )}

              <button
                type="button"
                onClick={handleFileSelect}
                className="flex items-center gap-2 rounded bg-bolt-elements-background-depth-3 px-4 py-2 text-sm font-medium text-content-primary hover:bg-bolt-elements-background-depth-4"
              >
                <UploadIcon />
                Paste, drag, or click to upload an image
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded px-4 py-2 text-sm font-medium text-content-secondary hover:bg-bolt-elements-background-depth-3"
              >
                Close
              </button>

              {localPreview && (
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Spinner className="size-4" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <CheckIcon />
                      <span>Use This Image</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
