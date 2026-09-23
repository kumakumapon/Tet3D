# CUBE CASCADE / Tet3D

4 × 4 × 10 の立体フィールドで、2個1組の色Cubeを落とすWebパズルです。
**同じ色を左右・上下・前後の6方向に4個以上つなげると消去。落下後に次の色がつながれば連鎖になります。** 斜めはつながりません。

## 遊ぶ

Node.js 22.12 以降で実行します。

```sh
npm ci
npm run dev
```

表示されたURLをWebGL 2対応ブラウザで開いて `PLAY`。`はじめての方へ` から操作、初消去、2連鎖を実際に体験できます。チュートリアルは時間制限がなく、消去課題で置き間違えた場合は「やり直す」でその課題を再開できます。

| 操作           | PC                 | タッチ          |
| -------------- | ------------------ | --------------- |
| 左右           | A / D または ← / → | 左 / 右         |
| 奥・手前       | W / S または ↑ / ↓ | 奥 / 手前       |
| 回転           | Q / E              | ↶ / ↷           |
| Soft Drop      | Shift を押し続ける | 落下をタップ    |
| Hard Drop      | Space              | 配置            |
| Pause / Resume | Esc                | 一時停止 / 再開 |

座標はカメラに依存せず、+Xが右、+Zが手前、重力は−Yです。回転はSatelliteを上→右→手前→左→奥へ巡回させます。壁・Cubeにぶつかる操作は無効で、壁蹴りはありません。着地時に2個は分離し、それぞれ列の隙間を詰めます。

- 半透明Ghostは**分離後の最終位置**。配置でつながるCubeが明るくなり、`CONNECT ×n` / `CLEAR ×n!` を表示します。
- NEXTは2ペア。各8色の袋に4色を2個ずつ入れてシャッフルし、偏りを抑えます。
- TOP VIEWは最上部の色・記号と高さ。破線はGhostの列です。奥が上、手前が下です。
- ISO / FRONT / RIGHT / BACK / LEFT / TOP の視点を選べます。自由Orbitはありません。
- Spawn位置 `(1,8,1)` と `(1,9,1)` が塞がると終了。PLAY AGAINで再開できます。
- 10ペア配置ごとにレベルアップ。自然落下は1000msから100msずつ短縮し、最小150ms。Shift中は45ms。
- 同時に複数の色・Groupが消えた場合は1連鎖として数えます。
- BESTはブラウザのLocalStorageへ保存。保存が拒否されても、そのセッションでは保持します。
- 効果音は初期OFF。SOUND ONで有効化。別タブへの移動やウィンドウのフォーカス喪失時は自動Pauseします。
- 320px幅対応。キーボードフォーカス、色名・記号付きマップ、読み上げ用ステータス、動きを減らす設定に対応しています。

## 得点

Groupごとに `個数 × 10 × Group倍率` を足し、Chain倍率と同時色数倍率を掛け、最後に四捨五入します。

| Group個数 | 4   | 5   | 6   | 7   | 8   | 9以上 |
| --------- | --- | --- | --- | --- | --- | ----- |
| 倍率      | 1   | 1.2 | 1.5 | 2   | 2.5 | 3     |

| Chain | 1   | 2   | 3   | 4   | 5   | 6   | 7以上 |
| ----- | --- | --- | --- | --- | --- | --- | ----- |
| 倍率  | 1   | 2   | 4   | 8   | 16  | 24  | 32    |

同時色数倍率は1色=1、2色=1.25、3色=1.5、4色=1.75。連鎖解決後に盤面が空ならPERFECT CLEARで+5000点。空盤面に対して無条件に加点はしません。

## 開発・検証

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

CIでも型検査・ESLint・Vitest・本番ビルド・Playwright（PCと320px幅）を実行します。`npm run preview` で本番成果物を確認できます。ビルドのbaseは相対パスなので、サブディレクトリへの静的配置も可能です。

### デプロイ

`main` へのpushでQualityが成功すると、`.github/workflows/deploy.yml` がビルドして GitHub Pages（https://kumakumapon.github.io/Tet3D/ ）へ公開します。ActionsのDeploy to GitHub Pagesから手動でも実行できます。GitHub Pagesは `index.html` を `max-age=600` でキャッシュしますが、上の更新チェックにより新しい版へ切り替わります。

### 更新とキャッシュ

JS・CSSはViteがファイル名にハッシュを付けるため、古いものは読み込まれません。キャッシュされやすいのは `index.html` だけなので、ビルドごとに一意のBuild IDを埋め込み、同じIDを `version.json` として出力しています。

- 本番ビルドでは起動時、タブへ戻ったとき、10分ごとに `version.json` を `cache: "no-store"` で確認します。
- IDが違えば、`?v=<新ID>` を付けたURLへ移動します。URLが変わるので、ブラウザやCDNのキャッシュを通らず新しい `index.html` が読み込まれます。移動後は `v` を消します。
- 自動で再読み込みするのはタイトル画面だけで、1つのBuild IDにつき1回までです（sessionStorageで記録し、再読み込みのループを防ぎます）。プレイ中や、再読み込みしても古いページが返る場合は「更新する」ボタンを表示します。
- フッターにバージョンを表示し、マウスを乗せるとBuild IDが出ます。

配信側では `index.html` と `version.json` を `Cache-Control: no-cache`、`assets/*` を `max-age=31536000, immutable` にするのがおすすめです。ただし、この設定がなくても上の仕組みで更新されます。

### 構成

- `src/game/board.ts`: Uint8Arrayの盤面、6方向BFS、列単位の重力
- `src/game/pair.ts`: Pair・回転・袋方式Randomizer・分離Ghostと接続予測
- `src/game/resolve.ts`: 描画非依存の連鎖解決と得点
- `src/game/engine.ts`: 状態機械。操作、時間、Pause、消去→重力→次の判定を処理
- `src/renderer/renderer.ts`: Three.js。固定InstancedMeshを更新し、毎フレームMeshを作り直さない
- `src/main.ts`: DOM UI、入力、チュートリアル、アニメーションループ
- `src/storage/storage.ts`: 保存失敗に耐えるBEST保存とWeb Audio
- `src/update/update.ts`: `version.json` で新しいデプロイを検知し、キャッシュを通さず再読み込み

Game CoreはDOM・Three.js非依存。Rendererは切り離されたSnapshotだけを読み、Boardへ書き込みません。Randomizerは乱数を注入可能です。

### 決定論的テスト

Vitestで境界、XYZ/立体接続、斜めの除外、同時消去、分離落下、1〜3連鎖、得点、全消し、Spawn・操作・Pause・Game Over・Level・保存を検証します。

Playwrightは `vite --mode e2e` と本番previewを起動します。テストモードの `?e2e=1` でのみ `window.__cascade` が用意されます。`fixture('1'|'2'|'3'|'perfect'|'over')` と読み取り用 `snapshot()` により、ランダム操作に依存せず連鎖・終了・保存を検証します。Production buildはdebug adapterへの動的importを除去し、同じqueryを指定してもAPIは公開されません。E2Eでもこれを検証します。

## 範囲

Issue #1のv0.1 MVP（Phase 0〜5）。HOLD、特殊Cube、5色、対戦、オンラインランキング、PWA、WebXRは含みません。画像生成は使用せず、Cubeと盤面はThree.jsで描画します。
