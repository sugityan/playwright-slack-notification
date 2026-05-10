import { ValidationError } from './errors.ts';
import { PlaywrightSlackReporter } from './playwrightReporter.ts';
import { sendSlackBotMessage } from './slackBotClient.ts';
import { sendSlackWebhook } from './slackClient.ts';
import type { NotificationOptions, SlackWebhookPayload } from './types.ts';
import { getEnv, validateNonEmptyString, validateWebhookUrl } from './utils.ts';

export type { NotificationOptions, SlackAttachment, SlackBlock } from './types.ts';
export type { PlaywrightSlackReporterOptions } from './playwrightReporter.ts';
export { NetworkError, SlackApiError, SlackNotificationError, ValidationError } from './errors.ts';
export { PlaywrightSlackReporter } from './playwrightReporter.ts';
export { sendSlackBotMessage } from './slackBotClient.ts';

/**
 * Send a notification to Slack via Incoming Webhooks.
 */
export async function sendNotification(message: string, options: NotificationOptions = {}): Promise<void> {
  validateNonEmptyString(message, 'message');

  const webhookUrl = options.webhookUrl ?? getEnv('SLACK_WEBHOOK_URL');
  if (webhookUrl === undefined) {
    throw new ValidationError('Missing Slack webhook URL. Set options.webhookUrl or SLACK_WEBHOOK_URL');
  }
  validateWebhookUrl(webhookUrl);

  const payload: SlackWebhookPayload = {
    text: message,
    channel: options.channel,
    blocks: options.blocks,
    attachments: options.attachments,
  };

  // Defaults are tuned for CI/API usage:
  // - timeoutMs: avoid hanging too long on network stalls
  // - retries: recover from transient Slack/network issues
  // - retryDelayMs: short backoff to reduce immediate retry pressure
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 500;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ValidationError('timeoutMs must be a positive number');
  }
  if (!Number.isInteger(retries) || retries < 0) {
    throw new ValidationError('retries must be an integer >= 0');
  }
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
    throw new ValidationError('retryDelayMs must be a number >= 0');
  }

  await sendSlackWebhook(webhookUrl, payload, { timeoutMs, retries, retryDelayMs });
}

export default {
  sendNotification,
  PlaywrightSlackReporter,
  sendSlackBotMessage,
};