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

  // 1) プリコンピュート済みデータを探す
  const found = fares.find(
    (item) =>
      item.fromIcId === params.fromIcId &&
      item.toIcId === params.toIcId &&
      item.vehicleType === params.vehicleType &&
      item.useEtc === params.useEtc
  );

  if (found) {
    return {
      fareYen: found.fareYen,
      distanceKm: found.distanceKm,
      durationMinutes: found.durationMinutes,
      source: 'precomputed',
    };
  }

  // 2) Google Routes API でライブ取得 (サーバーサイドのみ)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      // IC の座標を取得するために interchanges.json を参照
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const interchanges: any[] = require('@/data/interchanges.json');
      const from = interchanges.find(ic => ic.id === params.fromIcId);
      const to = interchanges.find(ic => ic.id === params.toIcId);

      if (from && to && from.lat && to.lat) {
        const tollPasses = params.useEtc ? ['JP_ETC', 'JP_ETC2'] : [];
        const body = {
          origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
          destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
          extraComputations: ['TOLLS'],
          ...(tollPasses.length > 0 ? { routeModifiers: { tollPasses } } : {}),
        };

        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.travelAdvisory.tollInfo',
          },
          body: JSON.stringify(body),
        });

        const data = await res.json() as any;
        if (data.routes?.length) {
          const route = data.routes[0];
          const distanceKm = Math.round((route.distanceMeters ?? 0) / 100) / 10;
          const durationMinutes = Math.round(parseInt(route.duration?.replace('s', '') ?? '0') / 60);
          let fareYen = parseInt(route.travelAdvisory?.tollInfo?.estimatedPrice?.[0]?.units ?? '0');
          if (!fareYen) fareYen = Math.round((distanceKm * 35 + 300) / 10) * 10;

          return { fareYen, distanceKm, durationMinutes, source: 'google' };
        }
      }
    } catch {
      // フォールバックへ
    }
  }

  // 3) 推定値
  const estimatedDistanceKm = 130;
  return {
    fareYen: Math.round((estimatedDistanceKm * 35 + 300) / 10) * 10,
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
