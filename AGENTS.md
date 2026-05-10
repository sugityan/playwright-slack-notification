# AGENTS.md

High-signal guidance for working in this repository.

## Commands

**Build order matters**: `npm run build` must run before tests or scripts can execute.

```bash
npm run build               # clean + tsc; required before test/scripts
npm test                    # runs build, then node --experimental-strip-types --test
npm run slack:test          # sends test notification (needs .env)
npm run slack:test -- "msg" # custom message
```

**Test runner quirk**: Uses Node.js native test runner with `--experimental-strip-types`, not Jest/Vitest.

## Architecture

**Dual export pattern**: Package exports both main API (`index.ts`) and Playwright reporter (`reporter.ts`).

- `lib/index.js` — main API: `sendNotification()`, `sendSlackBotMessage()`
- `lib/reporter.js` — Playwright reporter default export: `PlaywrightSlackReporter`

**Build artifacts**: TypeScript compiles `src/` into `lib/` (runtime code) and `lib/types/` (type declarations). The `lib/` directory is git-ignored and npm-packed.

## Slack modes

This package supports two Slack notification modes:

1. **Incoming Webhook mode** — uses `SLACK_WEBHOOK_URL`
2. **Bot Token mode** — uses `SLACK_BOT_TOKEN` and `SLACK_BOT_CHANNEL_ID`

The reporter auto-detects which mode to use from environment variables. Thread posting with `errorDetailsInThread: true` is only available in Bot Token mode.

**Mode selection**: When both webhook and bot credentials are configured, webhook mode is used by default. Bot Token mode with thread posting is only activated when `errorDetailsInThread: true` is explicitly set in the reporter options. This makes webhook the default notification method unless threads are specifically needed.

## Testing

Tests import from `lib/` (compiled output), not `src/`. Always run `npm run build` before `npm test` or script-based verification.

Mock `globalThis.fetch` in tests and restore it in `afterEach`.

## CI

`.github/workflows/tests.yml` runs on all branches with Node 22.x. On test failure, CI sends a Slack notification via `scripts/slack-send.mjs`.

## Style notes

- No linter or formatter config is installed (`ESLint`, `Prettier`, `Biome` are not present)
- Use `.ts` extensions in imports
- TypeScript is strict and uses `NodeNext` module resolution

## Comment policy

**Minimize comments**: Code should be self-explanatory through clear naming and structure.

### When to avoid comments:

- **Do not add inline comments that restate what the code does**
  - Bad: `// Bot thread mode: ONLY use when errorDetailsInThread is explicitly true`
  - The conditional `if (config.errorDetailsInThread && config.botToken && config.botChannel)` is clear
  - Good naming and structure eliminate the need for such comments

- **Do not add comments explaining simple validation or obvious logic**
  - Bad: `// Set useBotThread flag (only true when errorDetailsInThread is enabled with valid config)`
  - The code itself: `this.useBotThread = this.errorDetailsInThread && !!this.botToken && !!this.botChannel;`
  - Good naming makes the comment redundant

### When comments are necessary:

- **JSDoc comments for public functions and exported APIs**
  - Always add JSDoc to describe function behavior, parameters, return values, and exceptions
  - Example:
    ```typescript
    /**
     * Sends a Slack notification using the appropriate method based on configuration
     * 
     * @param config - Reporter configuration
     * @param mainMessage - The main message text to send
     * @throws {SlackApiError} If the Slack API returns an error
     */
    export async function sendNotification(config, mainMessage) { ... }
    ```

- **Complex algorithms that require explanation of the approach**
- **Non-obvious workarounds for browser/platform quirks**
- **References to external issues or documentation**
- **TODO/FIXME markers** (only when necessary and with context)

**Principle**: If you feel an inline comment is needed, first try to improve the code itself through better naming, clearer structure, or refactoring. JSDoc comments for functions are encouraged.

## Naming rules

Use names that clearly express intent. Prefer “名は体を表す” naming: a reader should understand what a variable, function, class, or type does just by reading its name.

### General rules

- Do not use vague names such as `data`, `info`, `tmp`, `val`, `obj`, `res`, or `result` unless the meaning is truly obvious in a very small scope
- Prefer explicit names such as `webhookUrl`, `failedTestCount`, `threadTimestamp`, or `mainMessageText`
- Avoid unnecessary abbreviations
  - use `error`, not `err`
  - use `message`, not `msg`
  - use `button`, not `btn`

### Variables and properties

- Boolean names must start with `is`, `has`, `can`, or `should`
  - `canUseBotThread`
  - `shouldNotify`
  - `hasSlackBotConfig`
- Arrays and collections should use plural names
  - `failures`
  - `messageLines`
  - `testResults`
- Count-like numeric values should end with `Count`, `Total`, `Limit`, or `Max` when appropriate
  - `failedTestCount`
  - `passedTestCount`
  - `maxFailureCount`

### Functions and methods

- Function names should start with a verb and describe behavior clearly
- Use:
  - `format...` for formatting
  - `build...` for string/object construction
  - `resolve...` for configuration resolution
  - `convert...` for value transformation
  - `send...` / `post...` / `notify...` for side effects
- Good examples:
  - `formatErrorDetails`
  - `buildMainMessage`
  - `resolveNotifyMode`
  - `convertStackTraceToRelativePaths`
  - `sendSlackWebhook`

### Types and interfaces

- Type names must describe what the type represents
- Avoid generic names like `Options`, `Config`, or `Payload` on their own
- Prefer specific names such as:
  - `PlaywrightSlackReporterOptions`
  - `ResolvedReporterOptions`
  - `SlackWebhookPayload`
- Do not use `I` prefixes such as `IOptions`
- Use `Resolved` for types whose defaults have already been applied

### Constants

- Replace magic numbers and repeated string literals with named constants
- Group environment variable names and default values into dedicated constants objects when they are reused
- Example:
  - `DEFAULTS.TIMEOUT_MS`
  - `ENV_VARS.SLACK_BOT_TOKEN`

### Naming review checklist

Before finishing a change, verify the following:

- Can the purpose of each important name be understood without extra context?
- Are booleans named with `is`, `has`, `can`, or `should`?
- Are function names verb-based?
- Are arrays named in plural form?
- Have vague names and unnecessary abbreviations been removed?

## Dev workflow

1. Edit `src/`
2. Run `npm run build`
3. Run `npm test` or `npm run slack:test`

Scripts such as `slack-send.mjs` expect built artifacts in `lib/`.