---
applyTo: '**/*.ts, **/*.js, **/*.tsx, **/*.jsx'
---
# Coding Guidelines

- Prefer TypeScript for new code, tests, and scripts.
- Do not add new JavaScript files when a TypeScript file can be used instead.
- If an existing JavaScript file must be updated, consider migrating it to TypeScript when the change scope is reasonable.

## 変数宣言ルール
**`let` を一切使用禁止**。常に `const` を使用してください。

- 再代入が必要な場合 → `for...of`、`map()`、`forEach()` 等で回避
- カウンタ変数が必要な場合 → `const i = 0; while(...)` 形式で対応
- ループ以外では99% `const` で十分

## 理由
```
悪い例（NG）：
let count = 0;
for(let i = 0; i < 10; i++) { ... }

良い例（OK）：
const arr = [1, 2, 3];
for(const item of arr) { ... }

良い例（OK）：
const count = { value: 0 };
count.value++;  // オブジェクト内は変更可
```

## コードレビュー基準
Copilotが提案するコードに `let` が含まれていたら：
1. 即座に `const` に修正提案
2. 再代入が必要なら、より関数型な書き換えを提案
3. `let` 検出時は「変数再代入は避けましょう」と警告

## 例外（滅多にない）
- `try-catch` の catch 節のみ `let e` を許可
- それ以外は原則 `const` のみ