/**
 * Configuration management for the Playwright Slack Reporter
 */

import { DEFAULTS, ENV_VARS } from './constants.ts';
import type { PlaywrightSlackNotifyMode, PlaywrightSlackReporterOptions, ResolvedReporterOptions } from './reporterTypes.ts';

/**
 * Configuration class that manages reporter options and provides computed properties
 */
export class ReporterConfig {
  readonly notifyMode?: PlaywrightSlackNotifyMode;
  readonly showErrorDetails: boolean;
  readonly errorDetailsInThread: boolean;
  readonly splitThreadMessagePerTest: boolean;
  readonly maxFailures: number;
  readonly maxDetailLines: number;
  readonly maxDetailChars: number;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly retryDelayMs: number;
  readonly channel?: string;
  
  // Computed properties for Slack configuration
  readonly botToken?: string;
  readonly botChannel?: string;
  readonly canUseBotThread: boolean;

  /**
   * Creates a new ReporterConfig instance with defaults applied
   * 
   * @param options - User-provided configuration options
   */
  constructor(options: PlaywrightSlackReporterOptions = {}) {
    // Apply defaults
    this.notifyMode = options.notifyMode;
    this.showErrorDetails = options.showErrorDetails ?? DEFAULTS.SHOW_ERROR_DETAILS;
    this.errorDetailsInThread = options.errorDetailsInThread ?? DEFAULTS.ERROR_DETAILS_IN_THREAD;
    this.splitThreadMessagePerTest = options.splitThreadMessagePerTest ?? DEFAULTS.SPLIT_THREAD_MESSAGE_PER_TEST;
    this.maxFailures = options.maxFailures ?? DEFAULTS.MAX_FAILURES;
    this.maxDetailLines = options.maxDetailLines ?? DEFAULTS.MAX_DETAIL_LINES;
    this.maxDetailChars = options.maxDetailChars ?? DEFAULTS.MAX_DETAIL_CHARS;
    this.timeoutMs = options.timeoutMs ?? DEFAULTS.TIMEOUT_MS;
    this.retries = options.retries ?? DEFAULTS.RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULTS.RETRY_DELAY_MS;
    this.channel = options.channel;

    // Resolve bot configuration from options or environment
    this.botToken = (options.botToken ?? process.env[ENV_VARS.SLACK_BOT_TOKEN])?.trim();
    this.botChannel = (options.botChannel ?? process.env[ENV_VARS.SLACK_BOT_CHANNEL_ID] ?? this.channel)?.trim();
    
    // Compute whether bot thread mode is available
    this.canUseBotThread = this.errorDetailsInThread && !!this.botToken && !!this.botChannel;

    // Warn if thread mode is requested but not available
    if (this.errorDetailsInThread && !this.canUseBotThread) {
      console.warn(
        'PlaywrightSlackReporter: errorDetailsInThread is enabled but Slack Bot config is missing. ' +
        'Set botToken/botChannel or SLACK_BOT_TOKEN/SLACK_BOT_CHANNEL_ID. ' +
        'Falling back to webhook inline details.'
      );
    }
  }

  /**
   * Resolves the notify mode from options or environment variable
   * 
   * @param optionsMode - The mode specified in options
   * @returns The resolved notify mode
   */
  static resolveNotifyMode(optionsMode?: PlaywrightSlackNotifyMode): PlaywrightSlackNotifyMode {
    const envMode = (process.env[ENV_VARS.PLAYWRIGHT_SLACK_NOTIFY] ?? '').toLowerCase();
    if (envMode === 'always' || envMode === 'failure') return envMode;
    return optionsMode ?? DEFAULTS.NOTIFY_MODE;
  }

  /**
   * Gets the resolved notify mode for this configuration
   * 
   * @returns The notify mode to use
   */
  getNotifyMode(): PlaywrightSlackNotifyMode {
    return ReporterConfig.resolveNotifyMode(this.notifyMode);
  }

  /**
   * Determines if a notification should be sent based on test results
   * 
   * @param hasFailures - Whether there are any test failures
   * @param resultStatus - The overall test run status
   * @returns true if notification should be sent
   */
  shouldNotify(hasFailures: boolean, resultStatus: string): boolean {
    const mode = this.getNotifyMode();
    if (mode === 'always') return true;
    return hasFailures || resultStatus !== 'passed';
  }

  /**
   * Gets the webhook URL from environment
   * 
   * @returns The webhook URL or undefined if not set
   */
  getWebhookUrl(): string | undefined {
    const url = process.env[ENV_VARS.SLACK_WEBHOOK_URL];
    return url && url.trim().length > 0 ? url : undefined;
  }

  /**
   * Converts this config to a plain object matching ResolvedReporterOptions
   * 
   * @returns Plain object representation
   */
  toObject(): ResolvedReporterOptions {
    return {
      notifyMode: this.notifyMode,
      showErrorDetails: this.showErrorDetails,
      errorDetailsInThread: this.errorDetailsInThread,
      splitThreadMessagePerTest: this.splitThreadMessagePerTest,
      botToken: this.botToken,
      botChannel: this.botChannel,
      maxFailures: this.maxFailures,
      maxDetailLines: this.maxDetailLines,
      maxDetailChars: this.maxDetailChars,
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      retryDelayMs: this.retryDelayMs,
      channel: this.channel,
    };
  }
}
