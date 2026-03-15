---
applyTo: '**'
---
# エラーハンドリング必須ルール - 全API実装
## 原則：すべての外部API呼び出しで完全なエラーハンドリングを実装

**例外なし**。`fetch()`、`axios`、Webhook送信など、**すべての非同期HTTPリクエスト**で以下を実装：

```
async function sendSlack(message) {
  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
    
    // 1. HTTPステータスチェック（必須）
    if (!response.ok) {
      const errorData = await response.text();  // JSON/テキスト両対応
      throw new Error(`Slack API Error: ${response.status} ${errorData}`);
    }
    
    // 2. Response本文確認（必須）
    const result = await response.json();
    console.log('Slack送信成功:', result);  // 成功時ログ
    
  } catch (error) {
    // 3. 詳細エラーログ（必須）
    console.error('Slack送信失敗:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // 4. 代替処理または通知（推奨）
    // await sendEmailFallback(message); 
    throw error;  // 上位に伝播
  }
}
```