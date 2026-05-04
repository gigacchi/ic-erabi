// lib/routeProvider.ts
import type { LatLng } from '@/types';
import { calculateDistanceKm, estimateLocalRoadDurationMinutes } from './geo';

export type LocalRoadResult = {
  distanceKm: number;
  durationMinutes: number;
  source: 'google' | 'estimated';
};

export async function getLocalRoadRoute(
  origin: LatLng,
  destination: LatLng
): Promise<LocalRoadResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return fallback(origin, destination);
  }

  try {
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
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as any;

    if (!data.routes?.length) {
      return fallback(origin, destination);
    }

    const route = data.routes[0];
    const distanceKm = Math.round((route.distanceMeters ?? 0) / 100) / 10;
    const durationMinutes = Math.round(parseInt(route.duration?.replace('s', '') ?? '0') / 60);

    return { distanceKm, durationMinutes, source: 'google' };
  } catch {
    return fallback(origin, destination);
  }
}

function fallback(origin: LatLng, destination: LatLng): LocalRoadResult {
  const distanceKm = Math.round(calculateDistanceKm(origin, destination) * 10) / 10;
  const durationMinutes = estimateLocalRoadDurationMinutes(distanceKm);
  return { distanceKm, durationMinutes, source: 'estimated' };
}
