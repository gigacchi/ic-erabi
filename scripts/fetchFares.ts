// scripts/fetchFares.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

// .env.local を読み込む
try {
  const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error('GOOGLE_MAPS_API_KEY が設定されていません');
  process.exit(1);
}

type Interchange = {
  id: string;
  name: string;
  roadId: string;
  roadName: string;
  lat: number;
  lng: number;
  entranceAvailable: boolean;
  exitAvailable: boolean;
  etcOnly: boolean;
  isSmart: boolean;
};

type FareRecord = {
  fromIcId: string;
  toIcId: string;
  vehicleType: string;
  useEtc: boolean;
  fareYen: number;
  distanceKm: number;
  durationMinutes: number;
};

/** NEXCO公式料金計算（距離逓減制）普通車基準 */
function calcNexcoFare(distanceKm: number): number {
  const brackets: [number, number][] = [
    [40,        26.6],
    [100,       24.6],
    [200,       23.7],
    [400,       22.6],
    [Infinity,  21.2],
  ];
  let toll = 150;
  let prev = 0;
  let remaining = distanceKm;
  for (const [limit, rate] of brackets) {
    if (remaining <= 0) break;
    const km = Math.min(remaining, limit - prev);
    toll += km * rate;
    remaining -= km;
    prev = limit;
  }
  return Math.round(toll / 10) * 10;
}

/** Google Routes API で距離・所要時間を取得（料金はNEXCO式で計算） */
async function getRouteWithToll(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<{ fareYen: number; distanceKm: number; durationMinutes: number } | null> {
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
  };

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY!,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!data.routes || data.routes.length === 0) {
    return null;
  }

  const route = data.routes[0];
  const distanceKm = Math.round((route.distanceMeters ?? 0) / 100) / 10;
  const durationMinutes = Math.round(parseInt(route.duration?.replace('s', '') ?? '0') / 60);
  const fareYen = calcNexcoFare(distanceKm);

  return { fareYen, distanceKm, durationMinutes };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const interchangesPath = path.join(process.cwd(), 'data', 'interchanges.json');
  const interchanges: Interchange[] = JSON.parse(fs.readFileSync(interchangesPath, 'utf-8'));

  // 降りるIC: 高速ボタンで使用する各路線の exitAvailable な IC すべてが対象
  const TARGET_ROAD_IDS = new Set([
    'tohoku', 'yamagata', 'hokuriku', 'tomei', 'shin_tomei',
    'joban', 'banetsu', 'tohoku_chuo', 'joshinetsu', 'chuo',
  ]);
  const exitIcs = interchanges.filter(
    ic => ic.exitAvailable && ic.lat !== 0 && TARGET_ROAD_IDS.has(ic.roadId)
  );
  const exitIcIds = exitIcs.map(ic => ic.id);

  // 乗るIC: entranceAvailable=true かつ 座標あり
  const entranceIcs = interchanges.filter(ic => ic.entranceAvailable && ic.lat !== 0);

  console.log(`乗るIC: ${entranceIcs.length}件, 降りるIC: ${exitIcs.length}件`);
  console.log(`総ペア数: ${entranceIcs.length * exitIcs.length * 2} (ETC/現金 各)`);

  // 既存データを読み込み（再実行時のスキップ用）
  const outPath = path.join(process.cwd(), 'data', 'fares.json');
  let fares: FareRecord[] = [];
  if (fs.existsSync(outPath)) {
    fares = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    console.log(`既存データ: ${fares.length}件`);
  }
  const existingKeys = new Set(fares.map(f => `${f.fromIcId}__${f.toIcId}`));

  let count = 0;
  let skipped = 0;
  const total = entranceIcs.length * exitIcs.length;

  for (const entrance of entranceIcs) {
    for (const exit of exitIcs) {
      if (entrance.id === exit.id) continue;
      count++;
      if (existingKeys.has(`${entrance.id}__${exit.id}`)) {
        skipped++;
        continue;
      }
      process.stdout.write(`  [${count}/${total}] ${entrance.name} → ${exit.name}... `);

      const etcResult = await getRouteWithToll(
        { lat: entrance.lat, lng: entrance.lng },
        { lat: exit.lat, lng: exit.lng },
      );

      if (etcResult) {
        fares.push({
          fromIcId: entrance.id,
          toIcId: exit.id,
          vehicleType: 'standard',
          useEtc: true,
          ...etcResult,
        });
        console.log(`✓ ${etcResult.fareYen}円 ${etcResult.distanceKm}km ${etcResult.durationMinutes}分`);
      } else {
        console.log('✗ 取得失敗');
      }

      await sleep(300);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(fares, null, 2), 'utf-8');
  console.log(`\n✅ ${fares.length}件を ${outPath} に保存しました（スキップ: ${skipped}件）`);
}

main().catch(console.error);
