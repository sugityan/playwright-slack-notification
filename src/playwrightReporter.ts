import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { buildMessages } from './messageBuilder.ts';
import { sendNotification } from './notificationSender.ts';
import { toRelativePath } from './pathUtils.ts';
import { ReporterConfig } from './reporterConfig.ts';
import type { Failure, PlaywrightSlackReporterOptions } from './reporterTypes.ts';

// Re-export types for backward compatibility
export type { PlaywrightSlackReporterOptions } from './reporterTypes.ts';

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
 *     ['playwright-slack-notification/reporter', {
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
      
      const allErrors = result.errors && result.errors.length > 0
        ? result.errors
            .map(e => e.stack ?? e.message)
            .filter(Boolean)
            .join('\n\n---\n\n')
        : undefined;

      const errorText = allErrors ?? result.error?.stack ?? result.error?.message;

      const snippetSection = result.error?.snippet ? `\nCode snippet:\n${result.error.snippet}` : '';
      const error = errorText ? `${errorText}${snippetSection}` : undefined;

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
    const shouldNotify = this.config.shouldNotify(this.failures.length > 0, result.status);
    if (!shouldNotify) return;

    try {
      const { mainMessage, threadMessages } = buildMessages(
        result,
        this.passedCount,
        this.failedCount,
        this.failures,
        {
          maxFailures: this.config.maxFailures,
          maxDetailLines: this.config.maxDetailLines,
          maxDetailChars: this.config.maxDetailChars,
          showErrorDetails: this.config.showErrorDetails,
          useBotThreadMode: this.config.useBotThread,
          splitThreadMessagePerTest: this.config.splitThreadMessagePerTest,
        }
      );

      await sendNotification(this.config, mainMessage, threadMessages);
    } catch (err) {
      // TODO: add throw error handling
    }
  }
}

export default PlaywrightSlackReporter;
