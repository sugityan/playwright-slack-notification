import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { DEFAULTS, EMOJIS, ENV_VARS } from './constants.ts';
import { formatErrorDetails } from './formatters.ts';
import { toRelativePath } from './pathUtils.ts';
import { sendSlackBotMessage } from './slackBotClient.ts';
import { sendSlackWebhook } from './slackClient.ts';
import type { SlackWebhookPayload } from './types.ts';
import { validateWebhookUrl } from './utils.ts';

export type PlaywrightSlackNotifyMode = 'failure' | 'always';

export interface PlaywrightSlackReporterOptions {
  notifyMode?: PlaywrightSlackNotifyMode;
  showErrorDetails?: boolean;
  errorDetailsInThread?: boolean;
  botToken?: string;
  botChannel?: string;
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
  testName: string;        
  project?: string;
  location?: string;
  error?: string;
};

function resolveNotifyMode(optionsMode?: PlaywrightSlackNotifyMode): PlaywrightSlackNotifyMode {
  const envMode = (process.env[ENV_VARS.PLAYWRIGHT_SLACK_NOTIFY] ?? '').toLowerCase();
  if (envMode === 'always' || envMode === 'failure') return envMode;
  return optionsMode ?? DEFAULTS.NOTIFY_MODE;
}

export class PlaywrightSlackReporter implements Reporter {
  private readonly failures: Failure[] = [];
  private passedCount = 0;
  private failedCount = 0;

  private readonly options: Required<
    Pick<PlaywrightSlackReporterOptions, 'maxFailures' | 'maxDetailLines' | 'maxDetailChars' | 'timeoutMs' | 'retries' | 'retryDelayMs'>
  > &
    Pick<PlaywrightSlackReporterOptions, 'channel' | 'notifyMode' | 'showErrorDetails' | 'errorDetailsInThread' | 'botToken' | 'botChannel'>;

  constructor(options: PlaywrightSlackReporterOptions = {}) {
    this.options = {
      notifyMode: options.notifyMode,
      showErrorDetails: options.showErrorDetails ?? DEFAULTS.SHOW_ERROR_DETAILS,
      errorDetailsInThread: options.errorDetailsInThread ?? DEFAULTS.ERROR_DETAILS_IN_THREAD,
      botToken: options.botToken,
      botChannel: options.botChannel,
      maxFailures: options.maxFailures ?? DEFAULTS.MAX_FAILURES,
      maxDetailLines: options.maxDetailLines ?? DEFAULTS.MAX_DETAIL_LINES,
      maxDetailChars: options.maxDetailChars ?? DEFAULTS.MAX_DETAIL_CHARS,
      timeoutMs: options.timeoutMs ?? DEFAULTS.TIMEOUT_MS,
      retries: options.retries ?? DEFAULTS.RETRIES,
      retryDelayMs: options.retryDelayMs ?? DEFAULTS.RETRY_DELAY_MS,
      channel: options.channel,
    };
  }

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
      const snippetSection = result.error?.snippet ? `\nCode snippet:\n${result.error.snippet}` : '';
      const error = (result.error?.stack ?? result.error?.message)
        ? `${result.error?.stack ?? result.error?.message}${snippetSection}`
        : undefined;


      this.failures.push({ title, testName, project, location, error });
    } else if (result.status === 'passed') {
      this.passedCount++;
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const notifyMode = resolveNotifyMode(this.options.notifyMode);
    const shouldNotify = notifyMode === 'always' ? true : this.failures.length > 0 || result.status !== 'passed';
    if (!shouldNotify) return;

    const botToken = (this.options.botToken ?? process.env[ENV_VARS.SLACK_BOT_TOKEN])?.trim();
    const botChannel = (this.options.botChannel ?? process.env[ENV_VARS.SLACK_BOT_CHANNEL_ID] ?? this.options.channel)?.trim();
    const canUseBotThread = this.options.errorDetailsInThread && !!botToken && !!botChannel;

    if (this.options.errorDetailsInThread && !canUseBotThread) {
      console.warn('PlaywrightSlackReporter: errorDetailsInThread is enabled but Slack Bot config is missing. Set botToken/botChannel or SLACK_BOT_TOKEN/SLACK_BOT_CHANNEL_ID. Falling back to webhook inline details.');
    }

    const header = `Playwright E2E result: ${result.status}`;
    const testSummary = `${EMOJIS.GREEN_CIRCLE} Passed: ${this.passedCount} ${EMOJIS.RED_CIRCLE} Failed: ${this.failedCount}`;

    const repo = process.env[ENV_VARS.GITHUB_REPOSITORY];
    const sha = process.env[ENV_VARS.GITHUB_SHA];
    const runId = process.env[ENV_VARS.GITHUB_RUN_ID];
    const serverUrl = process.env[ENV_VARS.GITHUB_SERVER_URL];

    const runUrl =
      repo && runId && serverUrl ? `${serverUrl}/${repo}/actions/runs/${runId}` : undefined;

    const lines: string[] = [header, testSummary];
    if (repo) lines.push(`repo: ${repo}`);
    if (sha) lines.push(`sha: ${sha}`);
    if (runUrl) lines.push(`run: ${runUrl}`);

    if (this.failures.length > 0) {
      lines.push('failures:');
      for (const failure of this.failures.slice(0, this.options.maxFailures)) {
        if (canUseBotThread) {
          lines.push(`${EMOJIS.RED_CIRCLE} ${failure.testName}`);
        } else {
          const where = [failure.project, failure.location].filter(Boolean).join(' ');
          lines.push(`${EMOJIS.RED_CIRCLE} ${failure.title}${where ? ` (${where})` : ''}`);

          if (this.options.showErrorDetails && failure.error) {
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
      // TODO: READMEにenvにbot_tokenとwebhoo_urlどちらも設定してある場合は、thread方式になることを明記するべき
      if (canUseBotThread && botToken && botChannel) {
        const summary = await sendSlackBotMessage(
          botToken,
          {
            channel: botChannel,
            text: payload.text,
          },
          {
            timeoutMs: this.options.timeoutMs,
            retries: this.options.retries,
            retryDelayMs: this.options.retryDelayMs,
          },
        );

        if (this.options.showErrorDetails && this.failures.length > 0 && summary.ts) {
        const detailLines: string[] = [];

        for (const failure of this.failures.slice(0, this.options.maxFailures)) {
          // Test name and location
          const where = [failure.project, failure.location].filter(Boolean).join(' ');
          detailLines.push(`**${failure.title}**${where ? ` (${where})` : ''}`);
          
          // Error details with full stack trace
          if (failure.error) {
            const details = formatErrorDetails(
              failure.error,
              this.options.maxDetailLines,
              this.options.maxDetailChars,
            );
            if (details) {
              detailLines.push('```');
              detailLines.push(details);
              detailLines.push('```');
            }
          }
          
          // Separator between errors (empty line)
          detailLines.push('');
        }

        if (this.failures.length > this.options.maxFailures) {
          detailLines.push(`...and ${this.failures.length - this.options.maxFailures} more`);
        }

        const detailPayload: SlackWebhookPayload = {
          text: detailLines.join('\n'),
          channel: botChannel,
        };

          await sendSlackBotMessage(
            botToken,
            {
              channel: botChannel,
              text: detailPayload.text,
              threadTs: summary.ts,
            },
            {
              timeoutMs: this.options.timeoutMs,
              retries: this.options.retries,
              retryDelayMs: this.options.retryDelayMs,
            },
          );
        }
        return;
      }

      const webhookUrl = process.env[ENV_VARS.SLACK_WEBHOOK_URL];
      if (!webhookUrl || webhookUrl.trim().length === 0) return;

      try {
        validateWebhookUrl(webhookUrl);
      } catch (err) {
        console.warn('PlaywrightSlackReporter: invalid SLACK_WEBHOOK_URL');
        console.warn(err);
        return;
      }

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
