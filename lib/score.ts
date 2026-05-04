export function calculateScore(params: {
  highwayFareYen: number;
  localRoadDurationMinutes: number;
  localRoadDistanceKm: number;
}): number {
  const { highwayFareYen, localRoadDurationMinutes, localRoadDistanceKm } = params;
  return Math.round(
    highwayFareYen + localRoadDurationMinutes * 50 + localRoadDistanceKm * 20
  );
}
