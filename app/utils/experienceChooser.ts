import { UAParser } from 'ua-parser-js';

/**
 * The full Chef experience doesn't work in Safari.
 * The biggest limitation is the preview iframe: if this popped out, it seems like Safari
 * could be supported.
 * - https://webcontainers.io/guides/browser-support#web-platform-requirements
 * - https://blog.stackblitz.com/posts/cross-browser-with-coop-coep/
 *
 * For now we're not even trying on Safari.
 */
export type Experience =
  // This mobile device WILL NOT WORK, force marketing page
  | 'marketing-page-only-for-mobile'
  // We've never seen Safari work on Bolt.new, don't even try until that works
  | 'marketing-page-only-for-desktop-safari'
  // If we know it won't work (e.g. no window.crossOriginIsolated) don't even try
  | 'marketing-page-only-for-desktop'
  // Recent Chrome on Android works, but it's a bad experience
  | 'mobile-warning'
  | 'the-real-thing';

// This code works client and server side but we can't get crossOriginIsolated on the server.
// It's currently only used on the client.
export function chooseExperience(userAgent: string, crossOriginIsolated: boolean | 'dunno' = 'dunno'): Experience {
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const device = parser.getDevice();
  const os = parser.getOS();

  // iOS devices get marketing page regardless: all iOS browsers use WebKit
  // so they're going to give us
  //   Sandbox access violation: Blocked a frame at "http://127.0.0.1:5173" from accessing a frame at "https://stackblitz.com".  The frame being accessed is sandboxed and lacks the "allow-same-origin" flag.
  // and
  //   Refused to display 'https://stackblitz.com/headless?version=1.5.1-internal.10&coep=credentialless' in a frame because of Cross-Origin-Embedder-Policy.
  if (os.name === 'iOS') {
    return 'marketing-page-only-for-mobile';
  }

  if (device.type === 'mobile' || device.type === 'tablet') {
    // this browser isn't crossOriginIsolated, it's DEFINITELY not going to work.
    if (!crossOriginIsolated) {
      return 'marketing-page-only-for-mobile';
    }
    return 'mobile-warning';
  }

  if (!crossOriginIsolated) {
    return 'marketing-page-only-for-desktop';
  }

  // We've never seen Bolt work in Safari so don't even try.
  // There is no real Chrome for iOS, Chrome and Firefox are just Safari.
  if (browser.name === 'Safari') {
    return 'marketing-page-only-for-desktop-safari';
  }

  // The mobile experience is bad, but let's let them try.
  if (device.type === 'mobile' || device.type === 'tablet') {
    return 'mobile-warning';
  }

  return 'the-real-thing';
}
