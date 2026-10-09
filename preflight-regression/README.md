# Preflight Regression — v0.1

「今回の変更を、いま出して大丈夫か？」を確認するAgent Skillです。
SkillScoutとは独立しており、APIキー・課金・外部通信は不要です。

## 使う

必要なもの：Node.js 22以上、Git。npmパッケージのインストール不要。

```powershell
node scripts/run-preflight.mjs --repo C:\path\to\project
node scripts/run-preflight.mjs --repo C:\path\to\project --base <比較元コミット> --json
```

AIには「このフォルダのSKILL.mdを読み、変更のリリース前検査をして」と依頼します。
AIがDeploy／Design／Contentから関係する手順だけ読み、検査結果を解釈します。
通常は読み取り専用です。差分ゼロ・未実施・根拠不足はPASSにしません。

テスト・ビルドを実行する場合は、対象のpackage.jsonの内容を確認して明示指定します。

```powershell
node scripts/run-preflight.mjs --repo C:\path\to\project --run test,build --json
```

これは対象プロジェクトのプログラムを実行します。ファイル変更・通信などの
副作用があり得ます。信頼できるプロジェクトだけで使用してください。
npmのpre/postフックは実行しません。インストール・デプロイ・DB移行もしません。

## 判定

- PASS：実施した限定範囲の検査で問題なし。リリース全体の保証ではありません。
- WARN：検査不足、要確認のリスク、比較範囲が不明。
- BLOCK：実際の検査失敗など、根拠のある停止理由。

各指摘はEvidence／Risk／Fix／Verify付き。実行ログ・秘密値は出力しません。
デフォルトはHEADと作業ツリーの比較（ステージ済み・未追跡も含む）です。
最後のコミットやPRを検査する場合は比較元を指定してください。

## v0.1の範囲

Git差分分類、追加行の競合記号・仮文言、変更JSON、単純なローカルリンク、
ルートnpmのtest/build/lint/typecheck。ブラウザでの外観・操作、リンク先の内容、
本番環境、詳細なmigration安全性はAIが各check packに従って別途確認します。
モノレポの依存追跡、pnpm/yarn、外部リンク巡回、DB操作は自動化していません。

`npm test` でこのSkill自体のオフラインテストを実行できます。
GitHub公開・skills.sh掲載・利用環境へのインストールは、この作成作業には含みません。
