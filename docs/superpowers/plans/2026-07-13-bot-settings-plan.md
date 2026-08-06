# 実装計画: Bot設定機能 (ブラックリスト・ホワイトリスト制御)

この計画書では、Botの設定機能を段階的に実装し、リンクプレビュー制限を機能させるためのタスクを定義します。

## グローバル制約 (Global Constraints)

- 設定データは `data/settings.json` に保存・永続化すること。
- コードは TypeScript に準拠し、`bun run check`（フォーマット & リンター）をパスすること。
- 各モジュールの実装時に対応するユニットテストを作成、または既存のテストを拡張し、`bun run test` がすべてパスすること。
- Discord.js の最新仕様 (ComponentV2) を考慮した `ContainerBuilder` などの使用箇所において、`MessageFlags.IsComponentsV2` などの適切なフラグを使用すること。

---

## タスク一覧

### Task 1: SettingsManager の実装と単体テスト

- **目的**: 設定データの読み書きとアクセス可否判定を行うモジュールを作成する。
- **実装内容**:
  - `src/utils/settingsManager.ts` を作成。
  - `SettingsManager` クラスを実装。
    - メモリキャッシュの保持。
    - `data/settings.json` からのロード・セーブ処理（ファイル自動生成含む）。
    - 判定ロジック `isAllowed(guildId, channelId, userId, roleIds)` の実装。
      - ホワイトリストが空でない場合: ホワイトリストに一致する対象のみ許可。
      - ホワイトリストが空の場合: ブラックリストに一致する対象のみ除外。
  - `tests/settingsManager.test.ts` を作成し、判定ロジックやファイル入出力をテストする。

### Task 2: `/settings` スラッシュコマンドの定義と直接変更ロジックの実装

- **目的**: パラメータを入力した直接の設定変更コマンドを実装する。
- **実装内容**:
  - `src/commands/settings.ts` にて、`/settings` コマンドの定義（オプション: `type`, `action`, `channel`, `user`, `role`）を完成させる。
  - コマンド登録処理（`src/commands/preview.ts` の `registerSlashCommands`）に `settings` コマンドを含める。
  - `src/index.ts` の `InteractionCreate` イベントで `/settings` コマンドのハンドラ（`handleSettingCommand`）を呼び出すルーティングを追加。
  - `handleSettingCommand` 内で、オプション入力時の引数バリデーションと、`SettingsManager` を使った設定追加・削除処理を実装。
  - 変更成功メッセージを返答する処理を実装。

### Task 3: `/settings` 対話的UIとインタラクションハンドラの実装

- **目的**: パラメータ未指定時の設定表示および対話的な削除機能を提供する。
- **実装内容**:
  - `/settings` が引数なしで実行された際、現在の設定一覧を取得。
  - `ContainerBuilder` を使って設定一覧を美しく表示するメッセージを構築。
  - 登録されているチャンネル・ユーザー・ロールを削除するためのセレクトメニュー（`StringSelectMenuBuilder`）を生成し、メッセージに付与。
  - `src/index.ts` の `InteractionCreate` イベントで、設定削除セレクトメニューのインタラクションを捕捉するハンドラを実装し、選択された項目を設定から削除・更新する。

### Task 4: リンクプレビュー機能への設定チェックの統合

- **目的**: プレビュー実行前に設定を確認し、不許可の場合はプレビューを行わないようにする。
- **実装内容**:
  - `src/events/messageCreate.ts`（メンションプレビュー時）に `SettingsManager.isAllowed` によるチェックを挿入。
  - `src/commands/preview.ts`（手動プレビューコマンド時）に同様のチェックを挿入し、不許可の場合はエラーメッセージを返す。
  - 設定の動作を検証するための結合テストやシミュレーションテストを実行・調整。
