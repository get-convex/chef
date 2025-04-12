import { useState, useEffect } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { chooseExperience, type Experience } from '~/utils/experienceChooser';

export function CompatibilityWarnings() {
  const searchParams = new URLSearchParams(window.location.search);
  const isDebug = searchParams.has('debug-experience');
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(
    isDebug ? 'marketing-page-only-for-desktop-safari' : null,
  );
  const [hasDismissedMobileWarning, setHasDismissedMobileWarning] = useState(false);

  useEffect(() => {
    if (isDebug) {
      // Clear localStorage when in debug mode
      localStorage.removeItem('hasDismissedMobileWarning');
      setHasDismissedMobileWarning(false);
    } else {
      // Check localStorage on mount (only when not in debug mode)
      const dismissed = localStorage.getItem('hasDismissedMobileWarning') === 'true';
      setHasDismissedMobileWarning(dismissed);
    }
  }, [isDebug]); // Re-run when debug status changes

  const experience =
    selectedExperience || chooseExperience(navigator.userAgent, searchParams, window.crossOriginIsolated);

  if (experience === 'the-real-thing' || (experience === 'mobile-warning' && hasDismissedMobileWarning)) {
    return null;
  }

  return (
    <CompatibilityDialog
      experience={experience}
      setSelectedExperience={setSelectedExperience}
      isDebug={isDebug}
      onDismiss={() => {
        if (experience === 'mobile-warning') {
          localStorage.setItem('hasDismissedMobileWarning', 'true');
          setHasDismissedMobileWarning(true);
        }
      }}
    />
  );
}

function CompatibilityDialog({
  experience,
  setSelectedExperience,
  isDebug,
  onDismiss,
}: {
  experience: Experience;
  setSelectedExperience: (exp: Experience | null) => void;
  isDebug: boolean;
  onDismiss: () => void;
}) {
  const [isOpen, setIsOpen] = useState(experience !== 'the-real-thing');
  const isMarketingOnly = experience.startsWith('marketing-page-only');
  const isDismissable = !isMarketingOnly;

  const handleDismiss = () => {
    if (experience === 'mobile-warning') {
      alert(
        'Hey! 👋\n\n' +
          "We're serious, mobile and tablet experiences really are not supported. At all.\n\n" +
          "We'd love to hear feedback about how it goes, but please use the in-app feedback button instead of emailing support.\n\n" +
          "For the best experience, please use desktop Chrome or Firefox. We won't bother you about it again on this device. Good luck!",
      );
    }
    setIsOpen(false);
    onDismiss();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={isMarketingOnly ? undefined : setIsOpen}>
      <Dialog showCloseButton={!isMarketingOnly} className="w-full h-full">
        <div className="w-full h-full grid grid-rows-[auto_auto_1fr_auto] max-h-screen gap-4">
          <DialogTitle className="sr-only">
            {experience === 'marketing-page-only-for-mobile'
              ? 'Mobile Browser Compatibility Notice'
              : experience === 'marketing-page-only-for-desktop-safari'
                ? 'Safari Browser Compatibility Notice'
                : experience === 'marketing-page-only-for-desktop'
                  ? 'Desktop Browser Compatibility Notice'
                  : experience === 'mobile-warning'
                    ? 'Mobile Device Warning'
                    : 'Browser Compatibility Notice'}
          </DialogTitle>
          {isDebug && (
            <div className="absolute top-4 right-4 z-50">
              <select
                value={experience}
                onChange={(e) => {
                  const newExperience = e.target.value as Experience;
                  setSelectedExperience(newExperience);
                }}
                className="bg-white border rounded px-2 py-1"
              >
                <option value="marketing-page-only-for-mobile">marketing-page-only-for-mobile</option>
                <option value="marketing-page-only-for-desktop">marketing-page-only-for-desktop</option>
                <option value="marketing-page-only-for-desktop-safari">marketing-page-only-for-desktop-safari</option>
                <option value="mobile-warning">mobile-warning</option>
                <option value="the-real-thing">the-real-thing</option>
              </select>
            </div>
          )}

          <div className="h-12"></div>
          <div className="text-center px-4 sm:px-8 md:px-16 text-lg">
            <div className="text-gray-800">
              {experience === 'marketing-page-only-for-mobile' ? (
                <>
                  <p>Grab you laptop!</p>
                  <p className="mt-4">Chef supports desktop Firefox, Chrome, and some other Chromium-based browsers.</p>
                </>
              ) : experience === 'marketing-page-only-for-desktop-safari' ? (
                <>
                  <p>You're a few keystrokes away from cooking with Chef!</p>
                  <p className="mt-4">
                    Chef uses{' '}
                    <a
                      href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                      className="text-blue-500 hover:text-blue-600 underline"
                    >
                      WebContainers
                    </a>{' '}
                    in ways that require browsers like desktop Firefox, Chrome, and some other Chromium-based browsers.
                  </p>
                </>
              ) : experience === 'marketing-page-only-for-desktop' ? (
                <>
                  <p>You're a few keystrokes away from cooking with Chef!</p>
                  <p className="mt-4">
                    Chef uses{' '}
                    <a
                      href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                      className="text-blue-500 hover:text-blue-600 underline"
                    >
                      WebContainers
                    </a>{' '}
                    in ways that require desktop Firefox, Chrome, and some other Chromium-based browsers. Your current
                    browser does not support cross-origin isolation.
                  </p>
                </>
              ) : experience === 'mobile-warning' ? (
                <>
                  <p>Grab you laptop!</p>
                  <p className="mt-4">
                    Chef uses{' '}
                    <a
                      href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                      className="text-blue-500 hover:text-blue-600 underline"
                    >
                      WebContainers
                    </a>{' '}
                    in ways that require a browser that supports cross-origin isolation. Get cooking with desktop Chrome
                    or Firefox!
                  </p>
                </>
              ) : null}
            </div>
          </div>

          <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 2xl:px-40 overflow-hidden">
            <div className="max-h-[50vh] h-full">
              <video
                src="/Basic-Screencast.mp4"
                controls
                className="w-full h-full object-contain"
                autoPlay
                muted
                playsInline
              />
            </div>
          </div>

          <div className="text-center px-4 sm:px-8">
            <p className="text-gray-600">
              Read more about{' '}
              <a href="https://news.convex.dev/meet-chef/" className="text-blue-500 hover:text-blue-600 underline">
                Chef
              </a>
              , check out{' '}
              <a href="https://convex.dev" className="text-blue-500 hover:text-blue-600 underline">
                Convex
              </a>
              , and join our{' '}
              <a href="https://www.convex.dev/community" className="text-blue-500 hover:text-blue-600 underline">
                Discord community
              </a>
            </p>
          </div>

          {isDismissable && (
            <div className="w-full flex flex-col items-center justify-center p-8">
              <div className="text-center space-y-4">
                <button onClick={handleDismiss} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                  Let me use it even though it's designed for desktop and mobile / tablets are not supported
                </button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </DialogRoot>
  );
}
