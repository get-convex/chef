import { useEffect, useState } from 'react';
import { chooseExperience, type Experience } from '~/utils/experienceChooser';
import { Button } from '@ui/Button';

export function CompatibilityWarnings({ setEnabled }: { setEnabled: (enabled: boolean) => void }) {
  const searchParams = new URLSearchParams(window.location.search);
  const isDebug = searchParams.has('debug-experience');
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(
    isDebug ? 'marketing-page-only-for-desktop-safari' : null,
  );

  // Clear localStorage in debug mode, otherwise check if warning was dismissed
  useEffect(() => {
    if (isDebug) {
      localStorage.removeItem('hasDismissedMobileWarning');
    }
  }, [isDebug, setEnabled, selectedExperience]);

  useEffect(() => {
    if (isDebug) {
      setEnabled(selectedExperience === 'the-real-thing');
    }
  }, [isDebug, setEnabled, selectedExperience]);

  const recommendedExperience = chooseExperience(navigator.userAgent, window.crossOriginIsolated);
  const experience = selectedExperience || recommendedExperience;

  if (experience === 'the-real-thing') {
    return null;
  }

  const dismiss = () => {
    if (experience === 'mobile-warning') {
      alert(
        'Hey! 👋\n\n' +
          "We're serious, mobile and tablet experiences really are not supported. At all.\n\n" +
          "We'd love to hear feedback about how it goes, but please use the in-app feedback button instead of emailing support.\n\n" +
          "For the best experience, please use desktop Chrome or Firefox. We won't bother you again on this device. Good luck!",
      );
      localStorage.setItem('hasDismissedMobileWarning', 'true');
    }
    setEnabled(true);
  };

  if (experience === 'mobile-warning') {
    return (
      <>
        <div className="my-2 text-balance rounded border border-neutral-1 bg-[#F7F3F1] p-4 text-center dark:border-neutral-10 dark:bg-neutral-11">
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

          <div className="flex flex-col items-center gap-6">
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
            <Button onClick={dismiss} className="mt-8 max-w-full text-wrap">
              Let me use it even though my device is not supported
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="my-2 text-balance rounded border border-neutral-1 bg-[#F7F3F1] p-4 text-center dark:border-neutral-10 dark:bg-neutral-11">
      <div>
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

        <div className="flex flex-col items-center gap-6">
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
        </div>
      </div>
    </div>
  );
}
