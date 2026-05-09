---
name: pr-create
description: "main との変更差分を見て PR を作成します。-p: 現在のブランチをプッシュし PR を作成 -u: 既存の PR の説明のみを更新"
allowed-tools: Bash(gh:*), Bash(git:*)
---

main との変更差分を見て、PR を作成してください。

## Context

- Current git status: !`git status`
- Changes in this PR: !`git diff main...HEAD --stat`
- Commits in this PR: !`git log --oneline main..HEAD`

## タスク

提供されたオプションに基づき、以下のいずれかのアクションを実行してください：

### オプション:

- **オプションなし または デフォルト**: PR の説明を生成しプルリクエストを作成
- **-p**: 現在のブランチをプッシュしプルリクエストを作成
- **-u**: 既存のプルリクエストの説明のみを更新

### デフォルト動作（オプションなし）：

1. 日本語の PR テンプレートの**正確な形式**に従って PR の説明を作成し、一時ファイルに書き出す
2. `gh pr create --draft --title "..." --body-file /tmp/pr_body.md` を実行する

### -p オプション使用時:

1. `git push -u origin <current-branch>` で現在のブランチをリモートリポジトリにプッシュ
2. 日本語の PR テンプレートの**正確な形式**に従って PR の説明を作成し、一時ファイルに書き出す
3. `gh pr create --draft --title "..." --body-file /tmp/pr_body.md` を実行

### -u オプション使用時:

1. 日本語のプルリクエストテンプレートの**正確な形式**に従ってプルリクエストの説明を作成し、一時ファイルに書き出す
2. `gh pr edit --body-file PROJECT_ROOT/tmp/pr_body.md` で既存のプルリクエストの説明を更新する

## ルール:

- PR テンプレート
  - `.github/pull_request_template.md` を参照し、このテンプレートに従った PR を作成する
  - 修正差分が複雑な場合、適切なダイアグラム（e.g. シーケンス図、フローチャート）を mermaid 記法で追加する
  - PR の先頭に `Generated with Claude Code` の文字列を付与する
- PR の作成
  - PR は draft で作成する
- PR 本文の受け渡し
  - PR の本文（description）は一時ファイル（e.g. `/tmp/pr_body.md`）に書き出し、`--body-file` オプションで渡すこと
    - `gh pr create --draft --title "..." --body-file /tmp/pr_body.md`
    - `gh pr edit --body-file /tmp/pr_body.md`
  - `--body` オプションを直接使うとシェルがバッククオートをエスケープするため、使用禁止
