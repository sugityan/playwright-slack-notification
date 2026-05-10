/**
 * Notification sending logic for Slack
 * 
 * This module handles the actual sending of messages to Slack via either:
 * - Bot Token mode (with optional thread support)
 * - Webhook mode (inline messages only)
 */

import type { ReporterConfig } from './reporterConfig.ts';
import { sendSlackBotMessage } from './slackBotClient.ts';
import { sendSlackWebhook } from './slackClient.ts';
import type { SlackWebhookPayload } from './types.ts';
import { red, validateWebhookUrl } from './utils.ts';

/**
 * Sends a Slack notification using the appropriate method based on configuration
 * 
 * This function automatically determines whether to use:
 * - Bot Token mode with thread posting (only if errorDetailsInThread: true is set)
 * - Webhook mode (default when threads are not needed)
 * 
 * @param config - Reporter configuration
 * @param mainMessage - The main message text to send
 * @param threadMessages - Optional array of thread messages (only used in bot thread mode)
 * @throws {SlackApiError} If the Slack API returns an error
 * @throws {NetworkError} If there's a network issue
 * @throws {ValidationError} If the webhook URL is invalid
 */
export async function sendNotification(
  config: ReporterConfig,
  mainMessage: string,
  threadMessages?: string[],
): Promise<void> {
  try {
    if (config.useBotThread) {
      await sendViaBotWithThread(config, mainMessage, threadMessages);
      return;
    }

    await sendViaWebhook(config, mainMessage);
  } catch (err) {
    console.warn('PlaywrightSlackReporter: failed to send notification');
    console.warn(err);
    throw err;
  }
}

/**
 * Sends notification via Slack Bot with optional thread posting
 * Supports sending multiple thread messages sequentially
 * 
 * @param config - Reporter configuration
 * @param mainMessage - The main message text
 * @param threadMessages - Optional array of thread messages
 */
async function sendViaBotWithThread(
  config: ReporterConfig,
  mainMessage: string,
  threadMessages?: string[],
): Promise<void> {
  if (!config.botToken || !config.botChannel) {
    throw new Error('Bot token and channel are required for bot thread mode');
  }

  // Send main message
  const mainResponse = await sendSlackBotMessage(
    config.botToken,
    {
      channel: config.botChannel,
      text: mainMessage,
    },
    {
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      retryDelayMs: config.retryDelayMs,
    },
  );

  // Send thread details if available
  if (threadMessages && threadMessages.length > 0 && mainResponse.ts) {
    for (const threadMessage of threadMessages) {
      await sendSlackBotMessage(
        config.botToken,
        {
          channel: config.botChannel,
          text: threadMessage,
          threadTs: mainResponse.ts,
        },
        {
          timeoutMs: config.timeoutMs,
          retries: config.retries,
          retryDelayMs: config.retryDelayMs,
        },
      );
    }
  }
}

/**
 * Sends notification via Slack Webhook
 * 
 * @param config - Reporter configuration
 * @param message - The message text to send
 */
async function sendViaWebhook(config: ReporterConfig, message: string): Promise<void> {
  const webhookUrl = config.getWebhookUrl();
  
  if (!webhookUrl) {
    console.error(red('PlaywrightSlackReporter: SLACK_WEBHOOK_URL is not set'));
    return;
  }

  try {
    validateWebhookUrl(webhookUrl);
  } catch (err) {
    console.warn('PlaywrightSlackReporter: invalid SLACK_WEBHOOK_URL');
    console.warn(err);
    return;
  }

  const payload: SlackWebhookPayload = {
    text: message,
    channel: config.channel,
  };

  await sendSlackWebhook(webhookUrl, payload, {
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    retryDelayMs: config.retryDelayMs,
  });
}
