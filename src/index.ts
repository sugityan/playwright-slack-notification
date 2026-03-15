import { ValidationError } from './errors.js';
import { sendSlackWebhook } from './slackClient.js';
import type { NotificationOptions, SlackWebhookPayload } from './types.js';
import { getEnv, validateNonEmptyString, validateWebhookUrl } from './utils.js';

export type { NotificationOptions, SlackAttachment, SlackBlock } from './types.js';
export { NetworkError, SlackApiError, SlackNotificationError, ValidationError } from './errors.js';

/**
 * Send a notification to Slack via Incoming Webhooks.
 */
export async function sendNotification(message: string, options: NotificationOptions = {}): Promise<void> {
  validateNonEmptyString(message, 'message');

  const webhookUrl = getEnv('SLACK_WEBHOOK_URL');
  if (webhookUrl === undefined) {
    throw new ValidationError('Missing Slack webhook URL. Set SLACK_WEBHOOK_URL');
  }
  validateWebhookUrl(webhookUrl);

  const payload: SlackWebhookPayload = {
    text: message,
    channel: options.channel,
    blocks: options.blocks,
    attachments: options.attachments,
  };

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
};