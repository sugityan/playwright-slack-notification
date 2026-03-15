# Verification TODO (for GitHub Copilot / CI)

This memo describes what “verified” means for this package and what additional work is required if we need stronger guarantees.

## TODO 1: Define the success criteria for Incoming Webhooks (current approach)

- Treat “Slack notified successfully” as: the Incoming Webhook HTTP response is `2xx` (ideally `200`).
- Optionally (stricter), also validate the response body is exactly `"ok"`.
  - Note: this can be brittle if Slack changes the response format; decide the acceptable strictness.
- In GitHub Actions, rely on process exit code (`0` = success, non-zero = failure) from the notification script.

## TODO 2: If we need to verify the message is visible in Slack (requires additional Slack permissions)

Incoming Webhooks are write-only; they do not provide a reliable way to confirm that a specific message is displayed in a channel.

If we need a machine-verifiable “message exists in Slack” check, implement a Slack Web API path (or a verification-only companion path):

- Post message with `chat.postMessage` using a Bot token.
- Capture the returned `ts` (timestamp) and channel identifier.
- Verify the message exists by fetching history (e.g., `conversations.history`) and checking the returned messages contain the `ts`.
- Document required secrets and scopes (e.g., `SLACK_BOT_TOKEN`, channel ID, scopes like `chat:write`, `channels:history` or `conversations:history` depending on channel type).

## TODO 3: Make CI notification verification reliable and low-noise

- Skip notification step when the secret `SLACK_WEBHOOK_URL` is not configured.
- Notify only on `push` to `main` (avoid PR noise unless explicitly desired).
- Include helpful context in the message:
  - repository, commit SHA
  - workflow run URL (or build URL) to quickly jump to logs

