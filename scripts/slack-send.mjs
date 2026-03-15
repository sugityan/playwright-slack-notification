import { sendNotification } from '../lib/index.js';

const messageFromArgs = process.argv.slice(2).join(' ').trim();
const message = messageFromArgs.length > 0 ? messageFromArgs : `Slack通知の動作検証: ${new Date().toISOString()}`;

try {
  await sendNotification(message);
  console.log('Slack notification sent:', message);
} catch (err) {
  console.error('Failed to send Slack notification');
  console.error(err);
  process.exitCode = 1;
}
