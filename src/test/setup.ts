import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// The API's tests (api/) run in Node, the site's in jsdom: browser stand-ins only where there is one.
const browser = typeof window !== "undefined";

if (browser) {
  // jsdom has no media playback nor speech: silent stand-ins, so a test can press Play.
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  if (browser) localStorage.clear();
});
afterEach(() => {
  if (browser) cleanup();
});
