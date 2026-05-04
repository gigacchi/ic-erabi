// scripts/fetchIcData.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IC_LIST } from './icList';

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

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=jp&language=ja&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as any;
  if (data.status !== 'OK' || !data.results[0]) {
    console.warn(`  ⚠ geocode失敗: ${query} (${data.status})`);
    return null;
  }
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`${IC_LIST.length}件のICをジオコーディングします...`);

  const result = [];

  for (const ic of IC_LIST) {
    process.stdout.write(`  ${ic.name} (${ic.roadName})... `);
    const coords = await geocode(ic.geocodeQuery);

    if (coords) {
      const { geocodeQuery: _, ...icWithoutQuery } = ic;
      result.push({ ...icWithoutQuery, lat: coords.lat, lng: coords.lng });
      console.log(`✓ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    } else {
      // フォールバック: 既存データから座標を引き継ぐ
      const { geocodeQuery: _, ...icWithoutQuery } = ic;
      result.push({ ...icWithoutQuery, lat: 0, lng: 0 });
      console.log('✗ 座標取得失敗 (lat/lng=0 でスキップ)');
    }

    await sleep(200); // API レート制限対策
  }

  const outPath = path.join(process.cwd(), 'data', 'interchanges.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n✅ ${result.length}件を ${outPath} に保存しました`);

  const failed = result.filter(ic => ic.lat === 0).length;
  if (failed > 0) {
    console.log(`⚠ ${failed}件の座標取得に失敗しました。手動で座標を確認してください。`);
  }
}

main().catch(console.error);
