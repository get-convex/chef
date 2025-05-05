import UAParser from 'ua-parser-js';

/**
 * Returns true if Chef will run on the current browser, false if not supported.
 */
export function isCompatible(): boolean {
  const parser = new UAParser(navigator.userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();

  // iOS devices are not supported.
  if (os.name === 'iOS') {
    return false;
  }

  // Browsers must be crossOriginIsolated.
  if (!window.crossOriginIsolated) {
    return false;
  }

  // Safari on desktop is not supported.
  if (browser.name === 'Safari') {
    return false;
  }

  // Otherwise, it's supported.
  return true;
}
