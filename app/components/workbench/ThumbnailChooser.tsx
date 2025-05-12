import { useState, useCallback, useEffect, useRef } from 'react';
import { Spinner } from '@ui/Spinner';
import { CameraIcon, CheckIcon, UploadIcon } from '@radix-ui/react-icons';
import { useConvexSessionId } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { toast } from 'sonner';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button } from '@ui/Button';
import { Modal } from '@ui/Modal';

export async function uploadThumbnail(imageData: string, sessionId: string, chatId: string): Promise<void> {
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
}

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
    if (isOpen && !currentThumbnail && !localPreview && onRequestCapture) {
      captureNewImage();
    }
  }, [isOpen, currentThumbnail, localPreview, captureNewImage, onRequestCapture]);

  const uploadImage = useCallback(
    async (imageData: string) => {
      setIsUploading(true);
      try {
        await uploadThumbnail(imageData, sessionId, chatId);

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

  return isOpen ? (
    <Modal
      onClose={() => onOpenChange(false)}
      title="Sharing thumbnail"
      description="This image is used when you share your chat with a link"
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex justify-center">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative flex h-[600px] max-w-[800px] flex-1 flex-col items-center justify-center rounded ${
              isDraggingImage
                ? 'border-2 border-dashed border-blue-500 bg-blue-500/5'
                : `${isCapturing ? '' : captureError ? 'border-2 border-red-500/50' : ''}`
            } transition-colors duration-150`}
          >
            {localPreview || lastUploadedPreview || (!recentlyUploaded && currentThumbnail) ? (
              <div className="relative size-full p-4">
                <div className="flex size-full items-center justify-center">
                  <img
                    src={localPreview || lastUploadedPreview || currentThumbnail || ''}
                    alt="Preview"
                    crossOrigin="anonymous"
                    className="max-h-full max-w-full object-contain shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                  />
                </div>
                {isDraggingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/5 backdrop-blur-[2px]">
                    <p className="text-lg font-medium text-blue-600">Drop image to replace</p>
                  </div>
                )}
              </div>
            ) : isCapturing ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner />
              </div>
            ) : (
              <div className="text-center text-content-secondary">
                <p>
                  {captureError
                    ? 'Upload an image to use as a thumbnail'
                    : isDraggingImage
                      ? 'Drop image here'
                      : 'No preview image available'}
                </p>
                <p className="mt-2 text-sm">
                  {captureError
                    ? ''
                    : isDraggingImage
                      ? 'Release to add your image'
                      : 'Drop an image here, paste from clipboard, or use the buttons below'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onRequestCapture && !captureError && (
              <Button
                variant="neutral"
                onClick={captureNewImage}
                disabled={isCapturing}
                tip="Take a screenshot of the current preview"
                icon={<CameraIcon />}
              >
                Take New Screenshot
              </Button>
            )}

            <Button
              variant="neutral"
              onClick={handleFileSelect}
              tip="Upload an image from your computer"
              icon={<UploadIcon />}
            >
              Paste, drag, or click to upload an image
            </Button>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>

          <div className="flex items-center gap-4">
            <Button variant="neutral" onClick={handleCancel} tip="Close without saving changes">
              Close
            </Button>

            {localPreview && (
              <Button
                type="submit"
                variant="primary"
                disabled={isUploading}
                tip="Use this image as the thumbnail"
                icon={isUploading ? <Spinner className="size-4" /> : <CheckIcon />}
              >
                {isUploading ? 'Uploading...' : 'Use This Image'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  ) : null;
}
