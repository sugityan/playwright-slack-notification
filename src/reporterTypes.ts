/**
 * Type definitions for the Playwright Slack Reporter
 */

export type PlaywrightSlackNotifyMode = 'failure' | 'always';

/**
 * Configuration options for PlaywrightSlackReporter
 */
export interface PlaywrightSlackReporterOptions {
  /** When to send notifications: 'failure' (default) or 'always' */
  notifyMode?: PlaywrightSlackNotifyMode;
  
  /** Whether to show error details in messages (default: true) */
  showErrorDetails?: boolean;
  
  /** Whether to post error details in a thread (requires Bot Token mode) */
  errorDetailsInThread?: boolean;
  
  /**
   * Whether to split thread messages per test case (only applies when errorDetailsInThread is true)
   * - false (default): Post all errors in one thread message
   * - true: Post each test error as a separate thread message
   * @default false
   */
  splitThreadMessagePerTest?: boolean;
  
  /** Slack Bot Token (alternative to webhook) */
  botToken?: string;
  
  /** Slack Bot Channel ID (required with botToken) */
  botChannel?: string;
  
  /** Maximum number of failures to display (default: 5) */
  maxFailures?: number;
  
  /** Maximum number of lines per error detail (default: 80) */
  maxDetailLines?: number;
  
  /** Maximum number of characters per error detail (default: 4000) */
  maxDetailChars?: number;
  
  /** Slack channel override (for webhooks) */
  channel?: string;
  
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  
  /** Number of retry attempts (default: 2) */
  retries?: number;
  
  /** Delay between retries in milliseconds (default: 500) */
  retryDelayMs?: number;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedReporterOptions {
  notifyMode?: PlaywrightSlackNotifyMode;
  showErrorDetails: boolean;
  errorDetailsInThread: boolean;
  splitThreadMessagePerTest: boolean;
  botToken?: string;
  botChannel?: string;
  maxFailures: number;
  maxDetailLines: number;
  maxDetailChars: number;
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  channel?: string;
}

/**
 * Represents a single test failure
 */
export interface Failure {
  /** Full title path joined with ' › ' */
  title: string;
  
  /** Test name only (last element of title path) */
  testName: string;
  
  /** Project/browser name (e.g., 'chromium') */
  project?: string;
  
  /** Relative file path with line and column (e.g., 'e2e/test.spec.ts:10:5') */
  location?: string;
  
  /** Full error message including stack trace and code snippet */
  error?: string;
}
