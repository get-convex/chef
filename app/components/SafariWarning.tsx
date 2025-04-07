import { useEffect, useState } from 'react';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';

export function SafariWarning() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user is on Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    // Check if user is on mobile
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isSafari) {
      setIsOpen(true);
      setIsMobile(isMobileDevice);
    }
  }, []);

  return (
    <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
      <Dialog showCloseButton={false} className="max-w-[90vw] md:max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <DialogTitle className="flex items-center gap-2">
              <img src="/favicon.svg" className="size-6" alt="" />
              {isMobile ? 'Grab your laptop' : 'You’re a couple keystrokes away'}
            </DialogTitle>
          </div>
          <DialogDescription className="mt-4">
            {isMobile ? (
              <>
                Chef uses{' '}
                <a
                  href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                  className="text-blue-500 hover:text-blue-600 underline"
                >
                  WebContainers
                </a>{' '}
                in ways that require a desktop browser. Get cooking with desktop Chrome or Firefox!
              </>
            ) : (
              <>
                Chef uses{' '}
                <a
                  href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                  className="text-blue-500 hover:text-blue-600 underline"
                >
                  WebContainers
                </a>{' '}
                in ways that are only supported in Firefox, Google Chrome, and some other Chromium-based browsers.
              </>
            )}
          </DialogDescription>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
