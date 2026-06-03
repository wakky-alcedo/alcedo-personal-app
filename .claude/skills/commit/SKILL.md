---
description: Stage changes and create a git commit with the correct prefix and a Japanese message following this project's commit convention
---

# Commit

Stage and commit changes with the appropriate prefix.

## Commit format

```
[scope] prefix: 日本語の説明
```

`[scope]` is optional. Use it when the change is confined to one subproject:

| Scope         | When to use                        |
|---------------|------------------------------------|
| `[pc-server]` | changes only under `pc-server/`    |
| `[web-app]`   | changes only under `web-app/`      |
| `[win-tracker]` | changes only under `win-tracker/`  |
| `[android-app]` | changes only under `android-app/`  |
| *(omit)*      | cross-cutting or repo-level change |

## Prefix rules

| Prefix      | Use when                                                      |
|-------------|---------------------------------------------------------------|
| `add:`      | new file, new feature, new dependency                         |
| `fix:`      | bug fix, broken behaviour corrected                           |
| `refactor:` | internal restructuring with no behaviour change               |
| `docs:`     | documentation only (`.md`, comments, specs)                   |
| `chore:`    | tooling, config, CI, dependency bumps — nothing users see     |

When a commit spans multiple categories, pick the **most significant** one (fix > add > refactor > docs > chore).

## Steps

1. Inspect changes:

```bash
git status
git diff HEAD
```

2. **仕様書の差分確認・同期**

   `docs/TECH_SPEC.md` を確認し、今回の変更内容が未反映の箇所があれば先に更新する（メインのコミットに含める）。

   確認観点：
   - スキーマ変更（テーブル追加・カラム追加）→ §6.2 PC (SQLite)
   - 新規 API エンドポイント → §7.2 エンドポイント
   - 新規コンポーネント・UI 変更 → §5.2 PC モジュール / §15 Phase1
   - win-tracker の動作変更 → §4.3

   コードを読めば分かる実装詳細は書かず、**設計上の決定・データモデル・API契約** のみを記載すること。

3. Choose prefix (and scope if applicable) based on the rules above.

4. Write a short Japanese description — one line, no period. Focus on **what changed and why**, not how.

5. Stage relevant files (prefer explicit paths over `git add .`):

```bash
git add <files>
# 仕様書を更新した場合は一緒にステージする
git add docs/TECH_SPEC.md
```

6. Commit:

```bash
git commit -m "prefix: 説明"
# or with scope:
git commit -m "[scope] prefix: 説明"
```

## Examples

```
add: タスク一覧のフィルタ機能を追加
fix: habits の streak が日付跨ぎで初期化されないバグを修正
refactor: db.ts の normalizeSubtasks を共通関数に切り出し
docs: TECH_SPEC にサブタスクのデータモデルを追記
chore: eslint を v9 に更新
[pc-server] fix: sync エンドポイントで version=0 のタスクが上書きされる問題を修正
[web-app] add: BeliefsPanel に編集モードを追加
```
