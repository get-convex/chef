import { useState } from 'react';
import { chooseExperience, type Experience } from '~/utils/experienceChooser';
import { Modal } from '@ui/Modal';
import { Button } from '@ui/Button';

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

  if (!isOpen) {
    return null;
  }

  if (experience === 'the-real-thing' || (experience === 'mobile-warning' && hasDismissedMobileWarning)) {
    return null;
  }

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

  // Warning only - use Modal component
  if (experience === 'mobile-warning') {
    return (
      <Modal onClose={handleDismiss} title={<div className="sr-only">Mobile Device Warning</div>}>
        {isDebug && (
          <div className="absolute left-4 top-4 z-50">
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

        <div className="text-center">
          <div>
            <h3>Grab your laptop!</h3>
            <p className="my-2">
              Chef uses{' '}
              <a
                href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                className="text-bolt-elements-messages-linkColor hover:underline"
              >
                WebContainers
              </a>{' '}
              in ways that require a browser that supports cross-origin isolation. Get cooking with desktop Chrome or
              Firefox!
            </p>
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

        <div className="mt-2 text-center text-content-secondary">
          <div>
            Read more about{' '}
            <a href="https://news.convex.dev/meet-chef/" className="text-content-link hover:underline">
              Chef
            </a>
            , check out{' '}
            <a href="https://convex.dev" className="text-content-link hover:underline">
              Convex
            </a>
            , and join our{' '}
            <a href="https://www.convex.dev/community" className="text-content-link hover:underline">
              Discord community
            </a>
          </div>

          <Button onClick={handleDismiss} className="mt-8 max-w-full text-wrap">
            Let me use it even though my device is not supported
          </Button>
        </div>
      </Modal>
    );
  }

  // Marketing pages - use full-page overlay (not dismissable)
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background-secondary/95 bg-bolt-elements-background-depth-1 backdrop-blur-sm">
      {isDebug && (
        <div className="absolute left-4 top-4 z-50">
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

      <div className="flex max-w-lg flex-col items-center gap-6 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-bolt-elements-background-depth-2">
        <div>
          {experience === 'marketing-page-only-for-mobile' ? (
            <>
              <h3 className="text-xl font-bold">Grab your laptop!</h3>
              <p className="my-2">Chef supports desktop Firefox, Chrome, and some other Chromium-based browsers.</p>
            </>
          ) : experience === 'marketing-page-only-for-desktop-safari' ? (
            <>
              <h3 className="text-xl font-bold">You’re a few keystrokes away from cooking with Chef!</h3>
              <p className="my-2">
                Chef uses{' '}
                <a
                  href="https://webcontainers.io/guides/browser-support#web-platform-requirements"
                  className="text-bolt-elements-messages-linkColor hover:underline"
                >
                  WebContainers
                </a>{' '}
                in ways that require browsers like desktop Firefox, Chrome, and some other Chromium-based browsers.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold">You’re a few keystrokes away from cooking with Chef!</h3>
              <p className="my-2">
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
          )}
        </div>

        <div className="flex w-full items-center justify-center">
          <video
            src="/Basic-Screencast.mp4"
            controls
            className="max-h-[50vh] w-auto max-w-full rounded-lg"
            autoPlay
            muted
            playsInline
          />
        </div>

        <div className="text-center text-content-secondary">
          <div>
            Read more about{' '}
            <a href="https://news.convex.dev/meet-chef/" className="text-content-link hover:underline">
              Chef
            </a>
            , check out{' '}
            <a href="https://convex.dev" className="text-content-link hover:underline">
              Convex
            </a>
            , and join our{' '}
            <a href="https://www.convex.dev/community" className="text-content-link hover:underline">
              Discord community
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
