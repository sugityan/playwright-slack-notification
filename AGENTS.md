# AGENTS.md - Playwright Slack Notification

## Overview

This is a TypeScript library for sending Slack notifications via Incoming Webhooks and Bot tokens. It integrates with Playwright test runners to automatically report test failures.

## Build / Lint / Test Commands

### Build
```bash
npm run build          # Compile TypeScript to ./lib
npm run clean          # Remove ./lib directory
npm run prepack        # Runs build before npm pack
```

### Testing
```bash
npm run test           # Build and run all tests
```

Run a **single test file**:
```bash
npm run build && node --experimental-strip-types --test tests/index.test.ts
npm run build && node --experimental-strip-types --test tests/playwright-reporter.test.ts
```

Run a **single test**:
```bash
npm run build && node --experimental-strip-types --test tests/index.test.ts --test-name-pattern="throws ValidationError"
```

### Other Commands
```bash
npm run slack:test     # Send test notification to Slack (requires .env)
```

## Project Structure

```
src/
  index.ts           # Main exports: sendNotification
  reporter.ts        # Playwright reporter entry point
  playwrightReporter.ts  # PlaywrightReporter implementation
  slackClient.ts     # Incoming Webhook HTTP client
  slackBotClient.ts  # Bot token HTTP client
  errors.ts          # Custom error classes
  types.ts           # TypeScript interfaces
  utils.ts           # Utility functions

tests/
  index.test.ts               # Tests for sendNotification
  playwright-reporter.test.ts # Tests for PlaywrightReporter
```

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2024
- Module: NodeNext (ESM)
- Strict mode enabled
- All strict checks enabled (`strict: true`)

### Imports
- Use `.ts` extension for local imports: `import { x } from './file.ts'`
- Use `import type` for type-only imports
- Sort imports: external → internal → types

```typescript
// Good
import type { Foo } from './types.ts';
import { bar } from './utils.ts';
import { sendNotification } from './index.ts';

// Not good
import { bar } from './utils';
import type { Foo } from './types.ts';
```

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `SlackNotificationError` |
| Functions | camelCase | `sendSlackWebhook` |
| Variables | camelCase | `webhookUrl` |
| Constants | camelCase or SCREAMING_SNAKE_CASE | `retries`, `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `NotificationOptions` |
| Private class members | Prefix with `private` | `private readonly failures` |

### Error Handling
- Use custom error hierarchy extending `SlackNotificationError`
- Error classes: `ValidationError`, `SlackApiError`, `NetworkError`
- Set `name` property on error classes: `override name = 'ErrorName'`
- Include `cause` in error constructors for chainable errors

```typescript
export class SlackApiError extends SlackNotificationError {
  override name = 'SlackApiError';
  readonly status: number;

  constructor(message: string, options: { status: number }) {
    super(message);
    this.status = options.status;
  }
}
```

### Types and Interfaces
- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and aliases
- Export types alongside values using `export type { ... } from '...'`

### Async/Await
- Prefer `async/await` over `.then()` chains
- Use `AbortController` for timeout handling
- Always `clearTimeout` in `finally` block

### Validation
- Use assertion functions for input validation
- Throw `ValidationError` for invalid inputs
- Validate early and fail fast

```typescript
export function validateWebhookUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('webhookUrl must be a non-empty string');
  }
  // ...
}
```

### Retry Logic
- Distinguish retryable vs non-retryable errors
- Known non-retryable Slack errors should not be retried
- Implement exponential backoff when appropriate

### Testing
- Use Node.js built-in test runner (`node:test`)
- Use `assert.rejects()` for testing thrown errors
- Mock `globalThis.fetch` for HTTP tests
- Restore original fetch in `afterEach`

```typescript
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('throws ValidationError', async () => {
  await assert.rejects(() => sendNotification('hi'), (err: any) => {
    assert.equal(err?.name, 'ValidationError');
    return true;
  });
});
```

### Default Values
- Prefer `??` (nullish coalescing) over `||` for defaults
- Use numeric separators for readability: `10_000`

### Comments
- Do NOT add comments unless explicitly requested
- Code should be self-explanatory

### Console Output
- Use `console.warn()` for non-fatal issues (missing config, etc.)
- Use `console.error()` for actual errors
- Include context (timestamp, relevant data) in error logs

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SLACK_WEBHOOK_URL` | Incoming Webhook URL |
| `SLACK_BOT_TOKEN` | Bot OAuth token (xoxb-...) |
| `SLACK_BOT_CHANNEL_ID` | Channel ID for bot posting |
| `GITHUB_REPOSITORY` | Auto-detected in GitHub Actions |
| `GITHUB_SHA` | Auto-detected in GitHub Actions |
| `GITHUB_RUN_ID` | Auto-detected in GitHub Actions |
| `GITHUB_SERVER_URL` | Auto-detected in GitHub Actions |
| `PLAYWRIGHT_SLACK_NOTIFY` | Override notify mode (failure/always) |
