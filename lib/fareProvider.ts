import type { VehicleType } from '@/types';

// fares.json が存在すれば優先使用、なければ mockFares.json にフォールバック
let faresCache: Record<string, any>[] | null = null;

function loadFares(): Record<string, any>[] {
  if (faresCache) return faresCache;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    faresCache = require('@/data/fares.json');
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    faresCache = require('@/data/mockFares.json');
  }
  return faresCache!;
}

/**
 * NEXCO 公式料金計算式（距離逓減制）
 * 普通車を基準とし、車種係数を掛けて10円単位に丸める
 */
export function calcNexcoFare(distanceKm: number, vehicleType: VehicleType = 'standard'): number {
  const multiplier: Record<VehicleType, number> = {
    kei: 0.8,
    standard: 1.0,
    middle: 1.2,
    large: 1.65,
  };

  const brackets: [number, number][] = [
    [40,         26.6],
    [100,        24.6],
    [200,        23.7],
    [400,        22.6],
    [Infinity,   21.2],
  ];

  let toll = 150; // 基本料金
  let prev = 0;
  let remaining = distanceKm;

  for (const [limit, rate] of brackets) {
    if (remaining <= 0) break;
    const km = Math.min(remaining, limit - prev);
    toll += km * rate;
    remaining -= km;
    prev = limit;
  }

  return Math.round(toll * (multiplier[vehicleType] ?? 1.0) / 10) * 10;
}

export type FareResult = {
  fareYen: number;
  distanceKm: number;
  durationMinutes: number;
  source: 'precomputed' | 'google' | 'estimated';
};

export async function getHighwayFare(params: {
  fromIcId: string;
  toIcId: string;
  vehicleType: VehicleType;
  useEtc: boolean;
}): Promise<FareResult> {
  const fares = loadFares();

  // 1) プリコンピュート済みデータから距離・所要時間を取得し、料金はNEXCO式で再計算
  const found = fares.find(
    (item) =>
      item.fromIcId === params.fromIcId &&
      item.toIcId === params.toIcId &&
      item.vehicleType === 'standard' &&  // standard で距離を取得
      item.useEtc === true
  );

  if (found) {
    return {
      fareYen: calcNexcoFare(found.distanceKm, params.vehicleType),
      distanceKm: found.distanceKm,
      durationMinutes: found.durationMinutes,
      source: 'precomputed',
    };
  }

  // 2) Google Routes API でライブ取得（距離・時間のみ使用、料金はNEXCO式）
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const interchanges: any[] = require('@/data/interchanges.json');
      const from = interchanges.find(ic => ic.id === params.fromIcId);
      const to = interchanges.find(ic => ic.id === params.toIcId);

      if (from && to && from.lat && to.lat) {
        const body = {
          origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
          destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        };

        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
          },
          body: JSON.stringify(body),
        });

        const data = await res.json() as any;
        if (data.routes?.length) {
          const route = data.routes[0];
          const distanceKm = Math.round((route.distanceMeters ?? 0) / 100) / 10;
          const durationMinutes = Math.round(parseInt(route.duration?.replace('s', '') ?? '0') / 60);

          return {
            fareYen: calcNexcoFare(distanceKm, params.vehicleType),
            distanceKm,
            durationMinutes,
            source: 'google',
          };
        }
      }
    } catch {
      // フォールバックへ
    }
  }

  // 3) 推定値（NEXCO式）
  const estimatedDistanceKm = 130;
  return {
    fareYen: calcNexcoFare(estimatedDistanceKm, params.vehicleType),
    distanceKm: estimatedDistanceKm,
    durationMinutes: Math.round((estimatedDistanceKm / 80) * 60),
    source: 'estimated',
  };
}

export type HighwayStep = {
  instruction: string;
  distanceKm: number;
};

// Google Routes API から経路ステップ（JCT/IC通過）を取得
export async function getHighwayRouteSteps(params: {
  fromIcId: string;
  toIcId: string;
}): Promise<HighwayStep[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const interchanges: any[] = require('@/data/interchanges.json');
    const from = interchanges.find((ic) => ic.id === params.fromIcId);
    const to = interchanges.find((ic) => ic.id === params.toIcId);
    if (!from || !to || !from.lat || !to.lat) return [];

    const body = {
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      languageCode: 'ja',
    };

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as any;
    const steps = data.routes?.[0]?.legs?.[0]?.steps ?? [];

    // 1km 以上のステップだけ抽出（細かい曲がり指示を除外）
    return steps
      .filter((s: any) => (s.distanceMeters ?? 0) >= 1000)
      .map((s: any) => ({
        instruction: s.navigationInstruction?.instructions ?? '',
        distanceKm: Math.round((s.distanceMeters ?? 0) / 100) / 10,
      }))
      .filter((s: HighwayStep) => s.instruction.length > 0);
  } catch {
    return [];
  }
}
