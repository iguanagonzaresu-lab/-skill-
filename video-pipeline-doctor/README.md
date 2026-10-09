# Video Pipeline Doctor — v0.1

AI動画の失敗ログから、原因候補・根拠・修正候補・再試行判断を返す **Agent Skill + オフラインCLI** です。

## すぐ試す

Node.js 22以上。追加パッケージ・APIキー不要です。このフォルダで実行します。

```sh
node scripts/cli.mjs diagnose --incident examples/comfyui-oom.json
node scripts/cli.mjs diagnose --incident examples/fal-unavailable.json --json
node --test tests/*.test.mjs
```

自分のログの場合：

```sh
node scripts/cli.mjs diagnose --log error.log --provider comfyui --workflow workflow.json --json
```

HTTPステータスも使う場合は、レスポンスを `{"http_status":503,"headers":{},"body":{...}}` で渡します。[入力仕様](references/cli.md)を参照してください。

## 実装済み

- ComfyUI / Runway / fal / Replicate / FFmpegの入力に対応（自動判定は限定的、明示指定可）。
- 構造化コードとローカル署名による分類、根拠の場所、修正候補。
- ComfyUIの該当ノード・前後の1ホップ、対応する既知ノードの処理段階。
- 入力不備・安全性・残高不足と、一時障害を区別する再試行判断。
- テキスト/JSON出力、[JSON Schema](schemas/diagnosis.schema.json)、架空サンプル、自動テスト。
- CLIの後にSkillを使うAIが文脈を検討する構成。ログ中の命令を実行しません。

## 現在の範囲

ローカルv0.1です。ライブAPI照会、環境情報の自動収集、動画の画質解析、実測に基づくVRAM削減量、専用LLM API、監視SaaS、自動修正・再試行は未実装です。未知のエラーは未知のまま返します。数値の確信度は出しません。

ファイル変更・外部通信・API利用料はCLIから発生しません。生ログ・プロンプト・署名付きURL・任意のラベルをレポートへ転載しない設計です。入力も事前に匿名化してください。

GitHub / skills.sh / npmにはこの作業では公開していません。Skillとして使う場合は、このフォルダの `SKILL.md` を対応エージェントへ指定してください。公開前にライセンス・実ログ評価・配布先を決める必要があります。

[Skill本体](SKILL.md) / [分類と制限](references/taxonomy.md) / [公式出典と再試行方針](references/providers.md)
