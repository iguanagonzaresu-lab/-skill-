# Design Preflight v0.1

Figmaの設計と実装のズレを検査するSkillの初期設計と比較コアです。
**現時点ではJSON同士の比較が動きます。Figma取得・ブラウザ撮影は未接続です。**
SkillScout、preflight-regressionは変更していません。

## 動かす

Node.js 22以上。追加パッケージ・APIキー不要。

```powershell
npm test
npm run demo
node scripts/compare.mjs --design examples/design.json --actual examples/actual.json --json
```

デモは架空データです。高さ・文字サイズ・背景色に意図的なズレがあるため、
FAILと終了コード2が出るのが正常です。本物のサイトの測定結果ではありません。

実装済み：Layout／Typography／Color、許容差、要素の対応確認、欠測WARN、
Expected／Actual／Deltaと原因候補・修正方針・確認方法を出すCLI。

仕様のみ：Figma/MCP/API接続、Playwrightでの実測、注釈付きスクリーンショット。
画像比較・Shape・Content・token名判定・自動修正は今回含みません。
`npx design-preflight` としては未公開です。

## 構成

```text
design-preflight/
  SKILL.md
  scripts/compare.mjs
  references/cli.md
  references/rules.md
  references/integration.md
  examples/design.json
  examples/actual.json
  tests/compare.test.mjs
```

次の接続には、確認対象のFigmaフレームとローカル画面URLが必要です。
最初は「Figma node ID → DOM selector」を明示して、誤対応を防ぎます。

## 検証記録（2026-10-08）

Windows / Node.js 24で自動テスト15件成功。3ルールの差分、許容差境界、
欠測・不正値、重複ID／セレクタ、非表示、フォント未読込、条件不一致、
CLIのJSON・終了コード、入力不変、SKILL.md参照を検証しました。
実Figma、ブラウザ、スクリーンショット、他OSでの動作は未検証です。
Python環境がないためskill-creatorのPython validatorは使わず、Nodeで
frontmatter・参照ファイルを確認しています。公開・インストールはしていません。
