# アンプラグド・プログラミング教材メーカー

公開 URL: **https://yorozu-craft.com/unplugged/**（英語版: https://yorozu-craft.com/unplugged/en/）

アンプラグド・プログラミングの教材を無料で印刷。ロボットの盤面・命令カード・先生用の答え。じゅんばん・くりかえし・もしの3段階で、毎回ちがう盤面。登録なし。
yorozu-craft のツールの1つです（共通ルールは [youheioonuki.github.io の README](https://github.com/YouheiOonuki/youheioonuki.github.io) を参照）。

## 機能

- ロボットを動かす盤面（4×4・5×5・6×6）を、もんだい ばんごう（種 1〜99999）から作る。同じ設定・同じ番号なら同じ盤面
- 3 段階: じゅんばん（順次）・くりかえし（反復）・もし（分岐。「もし まえが とおれない なら」）。カードは やじるし（うえ・みぎ・した・ひだり）か まえ・みぎ・ひだり（その場で回る）
- 印刷（A4 縦）: 盤面（プログラムを書くらん・切り取るロボットのコマ）、命令カード（切り取り線。大きいカードは 1 ページ 6 まい）、こたえ（道の番号と答えのプログラム）
- ためす画面（`try.html`）: カードを押して並べ、ロボットを動かす。ぶつかったカードの番号・カードの上限を出す
- 授業の流れ（`jugyou.html`）: 3 つの例（このサイトで考えたもの）
- **英語版**（`en/`。K83 の英語、yorozu-plans の企画書 49）: 「Unplugged coding printables」。同じ生成器（`puzzle.js`）と同じ印刷ページ（`sheets.js` に `lang: 'en'`）で、文だけ英語（カード: Forward / Turn right / Turn left / Up・Right・Down・Left / Repeat / If blocked / End）。用紙を A4 と US Letter から選ぶ（既定は言語設定が -US・-CA・-MX・-PH なら Letter）。使い方（`en/guide.html`）と授業の例（`en/lessons.html`。文部科学省の手引には触れない一般的な例）。ためす画面の英語版は無い。保存は `unplugged_en_settings`・`unplugged_en_paper`。日本語版と hreflang で対
- 設定はこの端末のブラウザ（`unplugged_settings`）にだけ保存。共有リンク `#s=`（base64url の JSON。なまえは入れない）、JSON ファイルへの書き出し・読み込み

## 盤面の作り方（`puzzle.js`）

- じゅんばん: スタート・ゴール・いわを置き、いちばん短いプログラム（幅優先探索。まえ・みぎ・ひだりは向きも状態に入れる）が むずかしさの範囲に入るものだけ使う。ふつう・むずかしいは、いわで回り道になる盤面だけ。カードの上限 ＝ いちばん短い枚数 ＋ 余り（かんたん 2・ふつう 1・むずかしい 0）
- くりかえし: 先に答えのプログラム（例 `4[FLFR]`）を決めて動かし、止まった所をゴールにする。道の外にいわを置き、じゅんばんのカードだけのいちばん短いプログラムが上限を超えるまで足す（くりかえしを使わないと解けない）。置くたびに答えでゴールに着くことを確かめる
- もし: 「曲がる所の前はふさがっている・まっすぐの所は空いている」道を作り、答え `n[?[R]F]` で着くことを確かめる。あとは くりかえしと同じ
- テスト（`tests/puzzle.test.js`）で 15 通り（段階×むずかしさ×カード）× 種 300 の全盤面について、答えを実行してゴール・上限いない・探索でも着ける・くりかえし（もし）が要ることを確かめる

## 根拠

文部科学省「小学校プログラミング教育の手引（第三版）」（令和2年2月）。値と確認日は `constants.js`（`CHECKED`）。使っている箇所: p.9・p.13「プログラミング的思考」、p.20「コンピュータを用いずに行う指導の考え方」、p.62 Q4。

## 保守

| 時期 | 確認すること | 直す場所 |
|------|------------|---------|
| 確認日から 12 か月まで（check-site のメモ 10 か月） | 文部科学省の手引のページに改訂（第四版など）が出ていないか | `constants.js` の `CHECKED`、`guide.html`・`jugyou.html` の確認日とページ番号 |
| 学習指導要領の改訂時 | プログラミング教育の位置づけ | `jugyou.html` |

直したら、`guide.html` の「更新履歴」に日付と内容を 1 行足す。

## ファイル

| ファイル | 役割 |
|---------|------|
| `index.html` / `main.js` | 本体（設定 → 印刷ボタン → 見本 → くわしい設定・共有・保存） |
| `try.html` / `try.js` | ためす画面（こどもが操作する。AdSense は meta だけ） |
| `jugyou.html` | 授業の流れ（3 つの例） |
| `guide.html` | 使い方・カードのきまり・よくある質問・ご利用上の注意・更新履歴 |
| `en/index.html` / `en/main-en.js` / `en/guide.html` / `en/lessons.html` | 英語版の本体 / 画面の制御（用紙の選択つき）/ 使い方・FAQ / 授業の例（`index.html`・`guide.html`・`jugyou.html` と hreflang で対） |
| `print/index.html` | 印刷物のクレジットの着地ページ（noindex・sitemap に載せない） |
| `puzzle.js` | 盤面の生成・プログラムの実行・いちばん短い道の探索（純粋関数） |
| `sheets.js` | 印刷するページと盤面・カードの SVG（HTML の文字列）。文は `TXT.ja`・`TXT.en`、用紙は `paper`（`a4`・`letter`） |
| `calc.js` | 設定の正規化・共有リンク・バックアップファイル |
| `constants.js` | 出典と確認日（`CHECKED`） |
| `screen.js` | 画面の部品（上端の固定バー、`details` の `summary` の状態表示） |
| `style.css` | 見た目（ダークモード対応。プリントは白地のまま） |
| `sw.js` / `manifest.webmanifest` | オフライン対応（キャッシュ `unplugged-v3`。英語版のページも） |
| `404.html` | ツール配下の存在しない URL で出るページ（サイト共通のもの） |
| `favicon.svg` / `apple-touch-icon.png` / `og-image.png` | アイコン / ホーム画面用アイコン / SNS 共有用画像（1200×630） |
| `sitemap.xml` | サイトマップ（本体・使い方・ためす・授業の流れと、その英語版 3 ページ。hreflang つき） |
| `tests/*.test.js` | テスト（`node --test tests/*.test.js`） |

## ライセンス

MIT License（`LICENSE`）。
