/**
 * Playwright Reporter entry point - exports PlaywrightSlackReporter as default
 * This file is used by Playwright's reporter loading mechanism which expects
 * a module with a default export that is a Reporter class.
 */
export { PlaywrightSlackReporter as default } from './playwrightReporter.ts';
