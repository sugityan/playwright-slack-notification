/**
 * Message building utilities for Slack notifications
 */

import type { FullResult } from '@playwright/test/reporter';

import { EMOJIS, ENV_VARS } from './constants.ts';
import { formatErrorDetails } from './formatters.ts';
import type { Failure } from './reporterTypes.ts';

/**
 * Options for building Slack messages
 */
export interface MessageBuilderOptions {
  /** Test result status */
  resultStatus: string;
  
  /** Number of passed tests */
  passedCount: number;
  
  /** Number of failed tests */
  failedCount: number;
  
  /** List of test failures */
  failures: Failure[];
  
  /** Maximum number of failures to include */
  maxFailures: number;
  
  /** Maximum lines per error detail */
  maxDetailLines: number;
  
  /** Maximum characters per error detail */
  maxDetailChars: number;
  
  /** Whether to show error details */
  showErrorDetails: boolean;
  
  /** Whether using bot thread mode (affects main message format) */
  useBotThreadMode: boolean;
  
  /** Whether to split thread messages per test case */
  splitThreadMessagePerTest: boolean;
}

/**
 * Builds the main Slack notification message
 * 
 * @param options - Message building options
 * @returns The formatted message text
 */
export function buildMainMessage(options: MessageBuilderOptions): string {
  const {
    resultStatus,
    passedCount,
    failedCount,
    failures,
    maxFailures,
    maxDetailLines,
    maxDetailChars,
    showErrorDetails,
    useBotThreadMode,
  } = options;

  const lines: string[] = [];

  // Header and test summary
  lines.push(`Playwright E2E result: ${resultStatus}`);
  lines.push(`${EMOJIS.GREEN_CIRCLE} Passed: ${passedCount} ${EMOJIS.RED_CIRCLE} Failed: ${failedCount}`);

  // GitHub CI information
  const repo = process.env[ENV_VARS.GITHUB_REPOSITORY];
  const sha = process.env[ENV_VARS.GITHUB_SHA];
  const runId = process.env[ENV_VARS.GITHUB_RUN_ID];
  const serverUrl = process.env[ENV_VARS.GITHUB_SERVER_URL];

  if (repo) lines.push(`repo: ${repo}`);
  if (sha) lines.push(`sha: ${sha}`);
  
  if (repo && runId && serverUrl) {
    const runUrl = `${serverUrl}/${repo}/actions/runs/${runId}`;
    lines.push(`run: ${runUrl}`);
  }

  // Failures section
  if (failures.length > 0) {
    lines.push('failures:');
    
    for (const failure of failures.slice(0, maxFailures)) {
      if (useBotThreadMode) {
        // Bot thread mode: show only test name in main message
        lines.push(`${EMOJIS.RED_CIRCLE} ${failure.testName}`);
      } else {
        // Webhook mode: show full details in main message
        const where = [failure.project, failure.location].filter(Boolean).join(' ');
        lines.push(`${EMOJIS.RED_CIRCLE} ${failure.title}${where ? ` (${where})` : ''}`);

        if (showErrorDetails && failure.error) {
          const details = formatErrorDetails(failure.error, maxDetailLines, maxDetailChars);
          if (details) {
            lines.push('  details:');
            lines.push('```');
            lines.push(details);
            lines.push('```');
          }
        }
      }
    }

    if (failures.length > maxFailures) {
      lines.push(`...and ${failures.length - maxFailures} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Builds thread detail messages for bot thread mode
 * Returns an array of messages - either one combined message or one per test
 * 
 * @param options - Message building options
 * @returns Array of formatted thread messages, or undefined if no details to show
 */
export function buildThreadDetailMessages(options: MessageBuilderOptions): string[] | undefined {
  const {
    failures,
    maxFailures,
    maxDetailLines,
    maxDetailChars,
    showErrorDetails,
    splitThreadMessagePerTest,
  } = options;

  if (!showErrorDetails || failures.length === 0) {
    return undefined;
  }

  if (splitThreadMessagePerTest) {
    return buildThreadDetailMessagesPerTest(options);
  }

  // Single combined message (original behavior)
  const singleMessage = buildThreadDetailMessageCombined(options);
  return singleMessage ? [singleMessage] : undefined;
}

/**
 * Builds a single combined thread message with all errors (original behavior)
 * 
 * @param options - Message building options
 * @returns The formatted thread message text, or undefined if no details to show
 */
function buildThreadDetailMessageCombined(options: MessageBuilderOptions): string | undefined {
  const {
    failures,
    maxFailures,
    maxDetailLines,
    maxDetailChars,
  } = options;

  const detailLines: string[] = [];

  for (const failure of failures.slice(0, maxFailures)) {
    // Test name and location
    const where = [failure.project, failure.location].filter(Boolean).join(' ');
    detailLines.push(`**${failure.title}**${where ? ` (${where})` : ''}`);

    // Error details with full stack trace
    if (failure.error) {
      const details = formatErrorDetails(failure.error, maxDetailLines, maxDetailChars);
      if (details) {
        detailLines.push('```');
        detailLines.push(details);
        detailLines.push('```');
      }
    }

    // Separator between errors (empty line)
    detailLines.push('');
  }

  if (failures.length > maxFailures) {
    detailLines.push(`...and ${failures.length - maxFailures} more`);
  }

  return detailLines.length > 0 ? detailLines.join('\n') : undefined;
}

/**
 * Builds separate thread messages for each test failure
 * 
 * @param options - Message building options
 * @returns Array of formatted thread messages, one per test failure
 */
function buildThreadDetailMessagesPerTest(options: MessageBuilderOptions): string[] | undefined {
  const {
    failures,
    maxFailures,
    maxDetailLines,
    maxDetailChars,
  } = options;

  const messages: string[] = [];

  for (const failure of failures.slice(0, maxFailures)) {
    const messageLines: string[] = [];

    // Test name and location
    const where = [failure.project, failure.location].filter(Boolean).join(' ');
    messageLines.push(`**${failure.title}**${where ? ` (${where})` : ''}`);

    // Error details with full stack trace
    if (failure.error) {
      const details = formatErrorDetails(failure.error, maxDetailLines, maxDetailChars);
      if (details) {
        messageLines.push('```');
        messageLines.push(details);
        messageLines.push('```');
      }
    }

    messages.push(messageLines.join('\n'));
  }

  if (failures.length > maxFailures) {
    messages.push(`...and ${failures.length - maxFailures} more test failures not shown`);
  }

  return messages.length > 0 ? messages : undefined;
}

/**
 * Convenience function to build both main and thread messages
 * 
 * @param result - Playwright test result
 * @param passedCount - Number of passed tests
 * @param failedCount - Number of failed tests
 * @param failures - List of test failures
 * @param config - Message configuration options
 * @returns Object containing main message and optional thread messages array
 */
export function buildMessages(
  result: FullResult,
  passedCount: number,
  failedCount: number,
  failures: Failure[],
  config: {
    maxFailures: number;
    maxDetailLines: number;
    maxDetailChars: number;
    showErrorDetails: boolean;
    useBotThreadMode: boolean;
    splitThreadMessagePerTest: boolean;
  }
): { mainMessage: string; threadMessages?: string[] } {
  const options: MessageBuilderOptions = {
    resultStatus: result.status,
    passedCount,
    failedCount,
    failures,
    maxFailures: config.maxFailures,
    maxDetailLines: config.maxDetailLines,
    maxDetailChars: config.maxDetailChars,
    showErrorDetails: config.showErrorDetails,
    useBotThreadMode: config.useBotThreadMode,
    splitThreadMessagePerTest: config.splitThreadMessagePerTest,
  };

  const mainMessage = buildMainMessage(options);
  const threadMessages = config.useBotThreadMode ? buildThreadDetailMessages(options) : undefined;

  return { mainMessage, threadMessages };
}
