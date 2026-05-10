## @sugityan/playwright-slack-notification

Playwright / CI スクリプトから Slack（Incoming Webhook）へ通知するための npm package です。

## 使い方

### 1. インストール

```bash
npm i @sugityan/playwright-slack-notification
```

### 2. 通知方式を選んで設定する

この package には 2 つの設定方式があります。

- **A. Incoming Webhook 方式**: シンプル。スレッド投稿は不可
- **B. Slack Bot Token 方式**: スレッド投稿（エラー理由）が可能

#### A. Incoming Webhook 方式

`.env` に Webhook URL を設定します（`webhookUrl` をコードで直接渡す場合は省略可能です）：

```env
SLACK_WEBHOOK_URL=YOUR_WEBHOOK_URL
```

#### B. Slack Bot Token 方式（スレッド投稿したい場合）

`.env` に Bot Token と Channel ID を設定します：

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_BOT_CHANNEL_ID=C1234567890
```

必要な Bot Scope（OAuth & Permissions）:

- `chat:write`（必須）
- `chat:write.public`（任意: Bot 未参加の public channel に投稿する場合）

Bot 方式を使う場合、Webhook URL (`SLACK_WEBHOOK_URL`) は不要です。

### 3. 任意のタイミングで通知を送る場合

```ts
import { sendNotification } from '@sugityan/playwright-slack-notification';

await sendNotification('E2E tests passed ✅');
```


### 4. Playwright の結果を自動通知する

####  Reporter を設定

Reporter を `playwright.config.ts` に設定します：

```ts
export default defineConfig({
  reporter: [
    ['list'],
    ['@sugityan/playwright-slack-notification/reporter', {
      notifyMode: 'failure', // 'failure' | 'always'
      showErrorDetails: true,

      
      channel: '#ci',
    }],
  ],
  // ... 他の設定
});
```

Webhook 方式で使う場合は上記のみで OK です。

Bot 方式でスレッド投稿したい場合は `errorDetailsInThread: true` を指定します：

```ts
export default defineConfig({
  reporter: [
    ['list'],
    ['@sugityan/playwright-slack-notification/reporter', {
      notifyMode: 'failure',
      showErrorDetails: true,
      errorDetailsInThread: true,
      splitThreadMessagePerTest: true, // 各テストごとに個別のスレッドメッセージを投稿
    }],
  ],
});
```

`notifyMode` の指定:

- `failure`（デフォルト）: 失敗時のみ Slack 通知
- `always`: 成功/失敗に関わらず Slack 通知

`errorDetailsInThread` の指定:

- `false` (デフォルト): エラー詳細をメイン通知本文に含める
- `true`: Slack bot user でエラー詳細をスレッド投稿する
  - スレッドには各テストの名前、ロケーション、完全なエラー詳細（スタックトレース含む）が表示されます

`splitThreadMessagePerTest` の指定:

- `false` (デフォルト): 全てのエラー詳細を1つのスレッドメッセージに統合
- `true`: 各失敗テストごとに個別のスレッドメッセージを投稿
  - 多数のテストが失敗した場合、Slackのメッセージサイズ制限（40,000文字）を超えないようにするために有効
  - Bot Token方式でのみ使用可能（`errorDetailsInThread: true` と併用）
  - Webhook方式では無視され、通常の本文表示になります

`showErrorDetails` の指定（Webhook / Bot 共通）:

- `true` (デフォルト): エラーの詳細情報（スタックトレース、コードスニペット含む）を表示
  - Webhook方式: テスト名 + `details:` セクションにコードブロックでエラー全文（コードスニペット、行番号付き）を表示
  - Bot Thread方式: メイン投稿はテスト名のみ、スレッドにエラーサマリー（コードスニペット含む）を投稿
  - **タイムアウトエラー**: タイムアウトの原因となった操作（例: `page.click()`, `page.waitForSelector()` など）のコードスニペットも含まれます
- `false`: エラーの詳細を非表示（テスト名とロケーションのみ通知）
  - どちらの方式でもエラー内容は表示されません

**表示例（Webhook方式、`showErrorDetails: true`）:**

<img src="assets/webhookURL_results_example.png" width="600" alt="Webhook通知例">

Slack bot user でスレッド投稿する場合は、以下を設定してください。

```env
SLACK_BOT_TOKEN=xoxb-...
```

`SLACK_BOT_TOKEN` が未指定の場合は、エラー詳細は本文表示にフォールバックします。

スレッド投稿は **Bot 方式のときのみ** 利用できます（Webhook 方式では不可）。

thread に投稿される内容は「失敗したテストのエラー理由のみ」です。

3) Playwright を実行します：

```bash
npx playwright test
```

### 5. このリポジトリでの動作確認

テスト通知を送るコマンド：

```bash
npm run slack:test
npm run slack:test -- "任意のメッセージ"
```
