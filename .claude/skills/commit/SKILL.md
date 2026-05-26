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

2. Choose prefix (and scope if applicable) based on the rules above.

3. Write a short Japanese description — one line, no period. Focus on **what changed and why**, not how.

4. Stage relevant files (prefer explicit paths over `git add .`):

```bash
git add <files>
```

5. Commit:

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
