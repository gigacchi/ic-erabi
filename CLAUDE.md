@AGENTS.md

---

# ic-erabi プロジェクト固有メモ

## プロジェクト概要

高速道路入口ICを自宅から検索するWebアプリ。  
出発地（自宅）を起点に近隣の入口ICを候補表示し、高速料金・距離・所要時間を比較する。

- **スタック**: Next.js 16 App Router / React 19 / TypeScript / Tailwind CSS
- **デプロイ**: Vercel（GitHub main ブランチ自動デプロイ）
- **外部API**: Google Maps Geocoding API / Google Routes API（`GOOGLE_MAPS_API_KEY`）

---

## ディレクトリ構成

```
app/                   Next.js App Router ページ
  page.tsx             トップページ（出発地入力 → SearchForm → ResultCard）
components/
  SearchForm.tsx       入口IC・出口IC選択UI（高速ボタン、矢印ナビ）
  ResultCard.tsx       検索結果カード（ETC料金・距離・所要時間）
lib/
  fareProvider.ts      料金・距離・所要時間の取得ロジック
  recommend.ts         ICスコアリング・候補選定ロジック
  ic.ts                interchanges.json の読み込みヘルパー
  geo.ts               緯度経度計算ユーティリティ
  routeProvider.ts     ルート（経路セクション）構築
  score.ts             候補スコア計算
data/
  interchanges.json    全ICマスター（座標・prevIcId/nextIcId など）
  fares.json           IC間の距離・所要時間キャッシュ（17,000件超）
  destinationAreas.json 目的地エリア定義
scripts/
  icList.ts            ICマスタ定義（ソースデータ）
  fetchIcData.ts       icList.ts → interchanges.json 生成（Geocoding API使用）
  fetchFares.ts        interchanges.json → fares.json 生成（Routes API使用）
types/
  index.ts             型定義（Interchange, RoadId, IcCandidateResult など）
```

---

## データモデル

### `Interchange`（types/index.ts）

```typescript
type Interchange = {
  id: string;              // 例: "tohoku_izumi"
  name: string;            // 例: "泉IC"
  roadId: RoadId;          // 例: "tohoku"
  roadName: string;        // 例: "東北自動車道"
  lat: number;
  lng: number;
  isSmart: boolean;        // スマートIC
  etcOnly: boolean;        // ETC専用
  entranceAvailable: boolean;
  exitAvailable: boolean;
  area: string;
  directionGroup: string;
  prevIcId?: string;       // 同一路線の前のIC id
  nextIcId?: string;       // 同一路線の次のIC id
  junctionPrevIcId?: string; // 路線端でJCT接続する別路線のIC id（prevがない場合の矢印ナビ用）
  junctionNextIcId?: string; // 同上（nextがない場合）
  availableHours: string;
  notes?: string;
};
```

### `RoadId`（現在登録済み路線）

| roadId | 路線名 | IC数 |
|--------|--------|------|
| `tohoku` | 東北自動車道 | 32 |
| `yamagata` | 山形自動車道 | 16 |
| `joban` | 常磐自動車道 | 9 |
| `banetsu` | 磐越自動車道 | 13 |
| `tohoku_chuo` | 東北中央自動車道 | 8 |
| `joshinetsu` | 上信越自動車道 | 18 |
| `chuo` | 中央自動車道 | 19 |
| `hokuriku` | 北陸自動車道 | 20 |
| `tomei` | 東名高速道路 | 14 |
| `shin_tomei` | 新東名高速道路 | 10 |
| `kanetsu` | 関越自動車道 | （一部） |
| `gaikan` | 首都圏中央連絡自動車道 | （一部） |
| `shuto` | 首都高速 | （一部） |

---

## 料金計算方針

**Google Routes APIの料金は使わない**（実際の約1.5倍になる）。

NEXCO公式の距離逓減制で計算する（`lib/fareProvider.ts`）：

```typescript
function calcNexcoFare(distanceKm: number, vehicleType: VehicleType): number {
  // 基本料金 150円 + 距離別単価
  const brackets: [number, number][] = [
    [40,       26.6],
    [100,      24.6],
    [200,      23.7],
    [400,      22.6],
    [Infinity, 21.2],
  ];
  // 車種倍率: kei=0.8, standard=1.0, middle=1.2, large=1.65
  return Math.round(toll * multiplier / 10) * 10;
}
```

`fares.json` に保存されるのは **距離(km)と所要時間(分)のみ**。  
料金はアクセスのたびに `calcNexcoFare` でリアルタイム計算する。

---

## データ更新フロー

### 1. ICマスタ更新

```bash
# icList.ts を編集してから実行
npm run fetch:ics
# → data/interchanges.json を更新（既存座標はAPIスキップ、メタ情報のみ更新）
```

**マージ動作**:
- `lat/lng` が既存にある → APIスキップ、`prevIcId`/`nextIcId` 等だけ更新
- `icList.ts` 未登録だが既存にある → そのまま保持
- 新規追加 → Geocoding APIで座標取得

### 2. 料金キャッシュ更新

```bash
npm run fetch:fares
# → data/fares.json を更新（既存ペアはスキップ、新規ペアのみAPIコール）
```

**スキップキー**: `${fromIcId}__${toIcId}`

**`TARGET_ROAD_IDS`**（`fetchFares.ts` 内）が出口IC対象路線。  
新路線を追加したらここに追記する：

```typescript
const TARGET_ROAD_IDS = new Set([
  'tohoku', 'yamagata', 'hokuriku', 'tomei', 'shin_tomei',
  'joban', 'banetsu', 'tohoku_chuo', 'joshinetsu', 'chuo',
]);
```

---

## 矢印ナビの仕組み（SearchForm.tsx）

```
prevIcId / nextIcId        → 同一路線内の隣接IC（優先）
junctionPrevIcId / junctionNextIcId → 路線端でのJCT先の別路線IC（フォールバック）
近傍ICリスト               → 上記どちらもない場合の最終フォールバック
```

**注意**: 路線の始端/終端IC（例: 宮城川崎IC）は `prevIcId` が無いので、  
`junctionPrevIcId` で東北道の隣接ICを指定することで左矢印が表示される。

---

## HIGHWAY_BUTTONS（SearchForm.tsx）

9個（3×3）のボタンで路線を切り替える：

```typescript
const HIGHWAY_BUTTONS = [
  { roadId: 'tohoku',      label: '東北道',   defaultExitIcId: 'tohoku_izumi' },
  { roadId: 'tohoku_chuo', label: '東北中央', defaultExitIcId: 'tohoku_chuo_yonezawa_kita' },
  { roadId: 'yamagata',    label: '山形道',   defaultExitIcId: 'yamagata_yamagata_zao' },
  { roadId: 'joban',       label: '常磐道',   defaultExitIcId: 'joban_iwaki_chuo' },
  { roadId: 'banetsu',     label: '磐越道',   defaultExitIcId: 'banetsu_aizu_wakamatsu' },
  { roadId: 'chuo',        label: '中央道',   defaultExitIcId: 'chuo_kofu_showa' },
  { roadId: 'joshinetsu',  label: '上信越',   defaultExitIcId: 'joshinetsu_nagano' },
  { roadId: 'hokuriku',    label: '北陸道',   defaultExitIcId: 'hokuriku_sanjo_tsubame' },
  { roadId: 'tomei',       label: '東名',     defaultExitIcId: 'tomei_numazu' },
];
```

---

## よくあるミスと対処法

| 問題 | 原因 | 対処 |
|------|------|------|
| 矢印が全然違うICに飛ぶ | `prevIcId`/`nextIcId` 未設定で近傍リスト順に動く | `icList.ts` に全IC分の prev/next を設定 |
| 料金が高すぎる | Google APIの料金を使っている | `fareProvider.ts` の `calcNexcoFare` を使う |
| 新路線のICが候補に出ない | `fares.json` に距離データがない | `npm run fetch:fares` を実行 |
| 路線端のICで矢印が出ない | `prevIcId`/`nextIcId` が無く junction も未設定 | `junctionPrevIcId`/`junctionNextIcId` を設定 |
| fetchIcData でも既存座標が消える | merge モードが効いていない | `icList.ts` の id が既存 json と一致しているか確認 |

---

## JCT接続（junctionPrevIcId / junctionNextIcId）設定済みIC

| IC | 設定 | 接続先 |
|----|------|--------|
| 宮城川崎IC（山形道始端） | `junctionPrevIcId` | `tohoku_sendai_minami` |
| 川口IC（東北道南端） | `junctionPrevIcId` | `gaikan_oizumi` |
| 流山IC（常磐道南端） | `junctionPrevIcId` | `gaikan_misato` |
| いわき中央IC（常磐道） | `junctionNextIcId` | `banetsu_iwaki_miwa` |
| いわき三和IC（磐越道東端） | `junctionPrevIcId` | `joban_iwaki_chuo` |
| 郡山東IC（磐越道） | `junctionPrevIcId` | `tohoku_koriyama` |
| 福島大笹生IC（東北中央道南端） | `junctionPrevIcId` | `tohoku_fukushima_nishi` |
| 山形上山IC（東北中央道） | `junctionNextIcId` | `yamagata_yamagata_chuo` |
| 藤岡IC（上信越道南端） | `junctionPrevIcId` | `kanetsu_takasaki` |

---

## 環境変数

| 変数 | 用途 |
|------|------|
| `GOOGLE_MAPS_API_KEY` | Geocoding API + Routes API（スクリプト用） |

`.env.local` に記載（`.gitignore` で除外済み）。
