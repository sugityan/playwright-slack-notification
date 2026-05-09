/**
 * Environment variable names used throughout the application
 */
export const ENV_VARS = {
  SLACK_WEBHOOK_URL: 'SLACK_WEBHOOK_URL',
  SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',
  SLACK_BOT_CHANNEL_ID: 'SLACK_BOT_CHANNEL_ID',
  PLAYWRIGHT_SLACK_NOTIFY: 'PLAYWRIGHT_SLACK_NOTIFY',
  GITHUB_REPOSITORY: 'GITHUB_REPOSITORY',
  GITHUB_SHA: 'GITHUB_SHA',
  GITHUB_RUN_ID: 'GITHUB_RUN_ID',
  GITHUB_SERVER_URL: 'GITHUB_SERVER_URL',
} as const;

/**
 * Default configuration values for the Playwright reporter
 */
export const DEFAULTS = {
  MAX_FAILURES: 5,
  MAX_DETAIL_LINES: 80,
  MAX_DETAIL_CHARS: 4000,
  TIMEOUT_MS: 10_000,
  RETRIES: 2,
  RETRY_DELAY_MS: 500,
  SHOW_ERROR_DETAILS: true,
  ERROR_DETAILS_IN_THREAD: false,
  NOTIFY_MODE: 'failure' as const,
} as const;

/**
 * Emoji constants used in Slack messages
 */
export const EMOJIS = {
  GREEN_CIRCLE: ':large_green_circle:',
  RED_CIRCLE: ':red_circle:',
} as const;
