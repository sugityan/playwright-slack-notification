/**
 * Utility functions for formatting error messages and details
 */

import { convertStackTraceToRelativePaths } from './pathUtils.ts';

/**
 * Removes ANSI color codes and escape sequences from text.
 * This is useful for cleaning up terminal output before sending to Slack.
 * 
 * @param text - The text containing ANSI codes
 * @returns The cleaned text without ANSI codes
 * 
 * @example
 * stripAnsi('\u001b[31mError\u001b[0m') // Returns 'Error'
 */
export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Formats error details for display in Slack messages.
 * - Strips ANSI color codes
 * - Converts absolute paths to relative paths
 * - Truncates to specified line and character limits
 * - Adds truncation indicator when content is cut off
 * 
 * @param error - The raw error message/stack trace
 * @param maxLines - Maximum number of lines to include
 * @param maxChars - Maximum number of characters to include
 * @returns The formatted error details or undefined if empty
 * 
 * @example
 * const error = 'Error: Failed\n  at file.ts:10:5\n  at test.ts:20:3'
 * formatErrorDetails(error, 2, 100) // Returns first 2 lines with relative paths
 */
export function formatErrorDetails(
  error: string,
  maxLines: number,
  maxChars: number,
): string | undefined {
  const cleaned = stripAnsi(error).replace(/\r/g, '').trim();
  if (!cleaned) return undefined;

  // Convert absolute paths to relative paths in stack traces
  const withRelativePaths = convertStackTraceToRelativePaths(cleaned);

  const lines = withRelativePaths.split('\n');
  const sliced = lines.slice(0, maxLines);
  const truncatedByLines = lines.length > maxLines;
  const joined = sliced.join('\n');

  const truncatedByChars = joined.length > maxChars;
  const detail = truncatedByChars ? `${joined.slice(0, maxChars)}\n...(truncated)` : joined;

  if (truncatedByLines && !truncatedByChars) {
    return `${detail}\n...(truncated)`;
  }

  return detail;
}
