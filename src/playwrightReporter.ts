import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { sendSlackWebhook } from './slackClient.ts';
import type { SlackWebhookPayload } from './types.ts';
import { validateWebhookUrl } from './utils.ts';

export type PlaywrightSlackNotifyMode = 'failure' | 'always';

export interface PlaywrightSlackReporterOptions {
  notifyMode?: PlaywrightSlackNotifyMode;
  maxFailures?: number;
  maxDetailLines?: number;
  maxDetailChars?: number;
  channel?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

type Failure = {
  title: string;
  project?: string;
  location?: string;
  error?: string;
};

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9;]*m/g, '');
}

function formatErrorSummary(error?: string): string | undefined {
  if (!error) return undefined;

  const cleaned = stripAnsi(error).replace(/\r/g, '');
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return undefined;

  const summary = lines
    .filter((line) => !line.startsWith('at '))
    .slice(0, 3)
    .join(' | ');

  return summary.length > 0 ? summary : lines[0];
}

function formatErrorDetails(error: string, maxLines: number, maxChars: number): string | undefined {
  const cleaned = stripAnsi(error).replace(/\r/g, '').trim();
  if (!cleaned) return undefined;

  const lines = cleaned.split('\n');
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

function resolveNotifyMode(optionsMode?: PlaywrightSlackNotifyMode): PlaywrightSlackNotifyMode {
  const envMode = (process.env.PLAYWRIGHT_SLACK_NOTIFY ?? '').toLowerCase();
  if (envMode === 'always' || envMode === 'failure') return envMode;
  return optionsMode ?? 'failure';
}

export class PlaywrightSlackReporter implements Reporter {
  private readonly failures: Failure[] = [];

  private readonly options: Required<
    Pick<PlaywrightSlackReporterOptions, 'maxFailures' | 'maxDetailLines' | 'maxDetailChars' | 'timeoutMs' | 'retries' | 'retryDelayMs'>
  > &
    Pick<PlaywrightSlackReporterOptions, 'channel' | 'notifyMode'>;

  constructor(options: PlaywrightSlackReporterOptions = {}) {
    this.options = {
      notifyMode: options.notifyMode,
      maxFailures: options.maxFailures ?? 5,
      maxDetailLines: options.maxDetailLines ?? 40,
      maxDetailChars: options.maxDetailChars ?? 2500,
      timeoutMs: options.timeoutMs ?? 10_000,
      retries: options.retries ?? 2,
      retryDelayMs: options.retryDelayMs ?? 500,
      channel: options.channel,
    };
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

    const title = test.titlePath().join(' › ');
    const project = test.parent.project()?.name;
    const location = test.location
      ? `${test.location.file}:${test.location.line}:${test.location.column}`
      : undefined;
    const error = result.error?.message;

    this.failures.push({ title, project, location, error });
  }

  async onEnd(result: FullResult): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.trim().length === 0) return;

    try {
      validateWebhookUrl(webhookUrl);
    } catch (err) {
      console.warn('PlaywrightSlackReporter: invalid SLACK_WEBHOOK_URL');
      console.warn(err);
      return;
    }

    const notifyMode = resolveNotifyMode(this.options.notifyMode);
    const shouldNotify = notifyMode === 'always' ? true : this.failures.length > 0 || result.status !== 'passed';
    if (!shouldNotify) return;

    const header = `Playwright E2E result: ${result.status} (failures: ${this.failures.length})`;

    const repo = process.env.GITHUB_REPOSITORY;
    const sha = process.env.GITHUB_SHA;
    const runId = process.env.GITHUB_RUN_ID;
    const serverUrl = process.env.GITHUB_SERVER_URL;

    const runUrl =
      repo && runId && serverUrl ? `${serverUrl}/${repo}/actions/runs/${runId}` : undefined;

    const lines: string[] = [header];
    if (repo) lines.push(`repo: ${repo}`);
    if (sha) lines.push(`sha: ${sha}`);
    if (runUrl) lines.push(`run: ${runUrl}`);

    if (this.failures.length > 0) {
      lines.push('failures:');
      for (const failure of this.failures.slice(0, this.options.maxFailures)) {
        const where = [failure.project, failure.location].filter(Boolean).join(' ');
        lines.push(`- ${failure.title}${where ? ` (${where})` : ''}`);

        const summary = formatErrorSummary(failure.error);
        if (summary) lines.push(`  reason: ${summary}`);

        if (failure.error) {
          const details = formatErrorDetails(
            failure.error,
            this.options.maxDetailLines,
            this.options.maxDetailChars,
          );
          if (details) {
            lines.push('  details:');
            lines.push('```');
            lines.push(details);
            lines.push('```');
          }
        }
      }
      if (this.failures.length > this.options.maxFailures) {
        lines.push(`...and ${this.failures.length - this.options.maxFailures} more`);
      }
    }

    const payload: SlackWebhookPayload = {
      text: lines.join('\n'),
      channel: this.options.channel,
    };

    try {
      await sendSlackWebhook(webhookUrl, payload, {
        timeoutMs: this.options.timeoutMs,
        retries: this.options.retries,
        retryDelayMs: this.options.retryDelayMs,
      });
    } catch (err) {
      console.warn('PlaywrightSlackReporter: failed to send notification');
      console.warn(err);
    }
  }
}

export default PlaywrightSlackReporter;
