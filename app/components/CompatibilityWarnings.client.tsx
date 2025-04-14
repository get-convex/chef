import { useState } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { chooseExperience, type Experience } from '~/utils/experienceChooser';

export function CompatibilityWarnings() {
  const searchParams = new URLSearchParams(window.location.search);
  const isDebug = searchParams.has('debug-experience');
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(
    isDebug ? 'marketing-page-only-for-desktop-safari' : null,
  );
  const [isOpen, setIsOpen] = useState(true);

  // Clear localStorage in debug mode, otherwise check if warning was dismissed
  if (isDebug) {
    localStorage.removeItem('hasDismissedMobileWarning');
  }
  const hasDismissedMobileWarning = !isDebug && localStorage.getItem('hasDismissedMobileWarning') === 'true';

  const experience =
    selectedExperience || chooseExperience(navigator.userAgent, searchParams, window.crossOriginIsolated);

  if (experience === 'the-real-thing' || (experience === 'mobile-warning' && hasDismissedMobileWarning)) {
    return null;
  }

  const isMarketingOnly = experience.startsWith('marketing-page-only');
  const isDismissable = !isMarketingOnly;

  const handleDismiss = () => {
    if (experience === 'mobile-warning') {
      alert(
        'Hey! 👋\n\n' +
          "We're serious, mobile and tablet experiences really are not supported. At all.\n\n" +
          "We'd love to hear feedback about how it goes, but please use the in-app feedback button instead of emailing support.\n\n" +
          "For the best experience, please use desktop Chrome or Firefox. We won't bother you again on this device. Good luck!",
      );
      localStorage.setItem('hasDismissedMobileWarning', 'true');
    }
    setIsOpen(false);
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={isMarketingOnly ? undefined : setIsOpen}>
      <Dialog showCloseButton={!isMarketingOnly} className="flex size-full" innerClassName="w-full">
        <div className="flex size-full">
          <div className="m-auto flex max-h-screen w-full flex-col items-center gap-8 overflow-auto px-4 sm:px-8">
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
              <div className="absolute right-4 top-4 z-50">
                <select
                  value={experience}
                  onChange={(e) => setSelectedExperience(e.target.value as Experience)}
                  className="rounded border bg-white px-2 py-1"
                >
                  <option value="marketing-page-only-for-mobile">marketing-page-only-for-mobile</option>
                  <option value="marketing-page-only-for-desktop">marketing-page-only-for-desktop</option>
                  <option value="marketing-page-only-for-desktop-safari">marketing-page-only-for-desktop-safari</option>
                  <option value="mobile-warning">mobile-warning</option>
                  <option value="the-real-thing">the-real-thing</option>
                </select>
              </div>
            )}

            <div className="text-center text-lg">
              <div className="text-bolt-elements-textPrimary">
                {experience === 'marketing-page-only-for-mobile' ? (
                  <>
                    <p>Grab your laptop!</p>
                    <p className="mt-4">
                      Chef supports desktop Firefox, Chrome, and some other Chromium-based browsers.
                    </p>
                  </>
                ) : experience === 'marketing-page-only-for-desktop-safari' ? (
                  <>
                    <p>You’re a few keystrokes away from cooking with Chef!</p>
                    <p className="mt-4">
                      Chef uses{' '}
                      <a
                        href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                        className="text-bolt-elements-messages-linkColor hover:underline"
                      >
                        WebContainers
                      </a>{' '}
                      in ways that require browsers like desktop Firefox, Chrome, and some other Chromium-based
                      browsers.
                    </p>
                  </>
                ) : experience === 'marketing-page-only-for-desktop' ? (
                  <>
                    <p>You’re a few keystrokes away from cooking with Chef!</p>
                    <p className="mt-4">
                      Chef uses{' '}
                      <a
                        href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                        className="text-bolt-elements-messages-linkColor hover:underline"
                      >
                        WebContainers
                      </a>{' '}
                      in ways that require desktop Firefox, Chrome, and some other Chromium-based browsers. Your current
                      browser does not support cross-origin isolation.
                    </p>
                  </>
                ) : experience === 'mobile-warning' ? (
                  <>
                    <p>Grab your laptop!</p>
                    <p className="mt-4">
                      Chef uses{' '}
                      <a
                        href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                        className="text-bolt-elements-messages-linkColor hover:underline"
                      >
                        WebContainers
                      </a>{' '}
                      in ways that require a browser that supports cross-origin isolation. Get cooking with desktop
                      Chrome or Firefox!
                    </p>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center">
              <video
                src="/Basic-Screencast.mp4"
                controls
                className="max-h-[calc(100vh-24rem)] w-auto max-w-full"
                autoPlay
                muted
                playsInline
              />
            </div>

            <div className="text-center text-bolt-elements-textSecondary">
              <div>
                Read more about{' '}
                <a
                  href="https://news.convex.dev/meet-chef/"
                  className="text-bolt-elements-messages-linkColor hover:underline"
                >
                  Chef
                </a>
                , check out{' '}
                <a href="https://convex.dev" className="text-bolt-elements-messages-linkColor hover:underline">
                  Convex
                </a>
                , and join our{' '}
                <a
                  href="https://www.convex.dev/community"
                  className="text-bolt-elements-messages-linkColor hover:underline"
                >
                  Discord community
                </a>
              </div>

              {isDismissable && (
                <button
                  onClick={handleDismiss}
                  className="mt-8 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                >
                  Let me use it even though it's designed for desktop and mobile / tablets are not supported
                </button>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
