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
