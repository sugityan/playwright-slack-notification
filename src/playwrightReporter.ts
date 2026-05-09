import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { buildMessages } from './messageBuilder.ts';
import { sendNotification } from './notificationSender.ts';
import { toRelativePath } from './pathUtils.ts';
import { ReporterConfig } from './reporterConfig.ts';
import type { Failure, PlaywrightSlackReporterOptions } from './reporterTypes.ts';

// Re-export types for backward compatibility
export type { PlaywrightSlackNotifyMode, PlaywrightSlackReporterOptions } from './reporterTypes.ts';

/**
 * Playwright reporter that sends test results to Slack
 * 
 * Supports two notification modes:
 * 1. Webhook mode: Sends inline messages with full error details
 * 2. Bot Token mode: Can post main message + error details in thread
 * 
 * @example
 * // In playwright.config.ts
 * export default defineConfig({
 *   reporter: [
 *     ['@sugityan/playwright-slack-notification/reporter', {
 *       notifyMode: 'failure',
 *       showErrorDetails: true,
 *       errorDetailsInThread: true, // Requires bot token
 *     }],
 *   ],
 * });
 */
export class PlaywrightSlackReporter implements Reporter {
  private readonly config: ReporterConfig;
  private readonly failures: Failure[] = [];
  private passedCount = 0;
  private failedCount = 0;

  /**
   * Creates a new PlaywrightSlackReporter
   * 
   * @param options - Configuration options
   */
  constructor(options: PlaywrightSlackReporterOptions = {}) {
    this.config = new ReporterConfig(options);
  }

  /**
   * Called when a test ends
   * Collects test results and failure information
   * 
   * @param test - The test case
   * @param result - The test result
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'failed' || result.status === 'timedOut') {
      this.failedCount++;
      
      const titlePath = test.titlePath();
      const title = titlePath.join(' › ');
      // Extract only the test name (last element of titlePath)
      const testName = titlePath[titlePath.length - 1] ?? title;
      
      const project = test.parent.project()?.name;
      const location = test.location
        ? `${toRelativePath(test.location.file)}:${test.location.line}:${test.location.column}`
        : undefined;
      
      // Combine error stack/message with snippet if available
      const snippetSection = result.error?.snippet ? `\nCode snippet:\n${result.error.snippet}` : '';
      const error = (result.error?.stack ?? result.error?.message)
        ? `${result.error?.stack ?? result.error?.message}${snippetSection}`
        : undefined;

      this.failures.push({ title, testName, project, location, error });
    } else if (result.status === 'passed') {
      this.passedCount++;
    }
  }

  /**
   * Called when all tests have finished
   * Sends notification to Slack if conditions are met
   * 
   * @param result - The full test result
   */
  async onEnd(result: FullResult): Promise<void> {
    // Check if we should send notification
    const shouldNotify = this.config.shouldNotify(this.failures.length > 0, result.status);
    if (!shouldNotify) return;

    try {
      // Build messages
      const { mainMessage, threadMessage } = buildMessages(
        result,
        this.passedCount,
        this.failedCount,
        this.failures,
        {
          maxFailures: this.config.maxFailures,
          maxDetailLines: this.config.maxDetailLines,
          maxDetailChars: this.config.maxDetailChars,
          showErrorDetails: this.config.showErrorDetails,
          useBotThreadMode: this.config.canUseBotThread,
        }
      );

      // Send notification
      await sendNotification(this.config, mainMessage, threadMessage);
    } catch (err) {
      // Error already logged by sendNotification, just swallow it here
      // to prevent Playwright from failing due to reporter errors
    }
  }
}

export default PlaywrightSlackReporter;
