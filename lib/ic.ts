import interchanges from '@/data/interchanges.json';
import type { Interchange, LatLng } from '@/types';
import { calculateDistanceKm } from './geo';

export type NearbyIc = Interchange & {
  distanceKm: number;
};

export function getAllInterchanges(): Interchange[] {
  return interchanges as Interchange[];
}

export function findInterchangeById(id: string): Interchange | undefined {
  return getAllInterchanges().find((ic) => ic.id === id);
}

/**
 * 入口ICと出口ICが同一路線の場合、その間を通過するICの名前を返す（最大4件）。
 * 異なる路線の場合は空配列。緯度で順序を決定する。
 */
export function getWaypointIcNames(fromId: string, toId: string, maxWaypoints = 4): string[] {
  const allIcs = getAllInterchanges();
  const from = allIcs.find((ic) => ic.id === fromId);
  const to = allIcs.find((ic) => ic.id === toId);
  if (!from || !to || from.roadId !== to.roadId) return [];

  const minLat = Math.min(from.lat, to.lat);
  const maxLat = Math.max(from.lat, to.lat);
  const dir = to.lat > from.lat ? 1 : -1;

  const between = allIcs
    .filter((ic) => ic.roadId === from.roadId && ic.id !== fromId && ic.id !== toId
      && ic.lat > minLat && ic.lat < maxLat)
    .sort((a, b) => dir * (a.lat - b.lat));

  if (between.length === 0) return [];
  if (between.length <= maxWaypoints) return between.map((ic) => ic.name);

  // 均等に間引く
  const step = (between.length - 1) / (maxWaypoints - 1);
  return Array.from({ length: maxWaypoints }, (_, i) => between[Math.round(i * step)].name);
}

export function findNearbyEntranceIcs(params: {
  origin: LatLng;
  radiusKm: number;
  includeSmartIc: boolean;
  useEtc: boolean;
  limit?: number;
}): NearbyIc[] {
  const { origin, radiusKm, includeSmartIc, useEtc, limit = 10 } = params;

  return getAllInterchanges()
    .filter((ic) => ic.entranceAvailable)
    .filter((ic) => includeSmartIc || !ic.isSmart)
    .filter((ic) => useEtc || !ic.etcOnly)
    .map((ic) => ({
      ...ic,
      distanceKm: calculateDistanceKm(origin, { lat: ic.lat, lng: ic.lng })
    }))
    .filter((ic) => ic.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
