import type { IcCandidateResult, SearchCondition, CandidateLabel, Interchange } from '@/types';
import { findInterchangeById, getAllInterchanges } from './ic';
import { getHighwayFare, getHighwayRouteSteps } from './fareProvider';
import { getLocalRoadRoute } from './routeProvider';
import { calculateScore } from './score';
import { calculateDistanceKm } from './geo';

export async function computeIcRoute(
  condition: SearchCondition
): Promise<IcCandidateResult | null> {
  const entrance = findInterchangeById(condition.entranceIcId);
  const destination = findInterchangeById(condition.exitIcId);

  if (!entrance || !destination) return null;

  // 一般道: Google Routes API → 推定値の順でフォールバック
  const localRoad = await getLocalRoadRoute(condition.origin, {
    lat: entrance.lat,
    lng: entrance.lng,
  });

  // 高速料金: fares.json → Google Routes API → 推定値の順
  // 経路ステップ（JCT/IC通過）はライブAPIから取得（並列）
  const [fare, highwaySteps] = await Promise.all([
    getHighwayFare({
      fromIcId: entrance.id,
      toIcId: destination.id,
      vehicleType: condition.vehicleType,
      useEtc: condition.useEtc,
    }),
    getHighwayRouteSteps({ fromIcId: entrance.id, toIcId: destination.id }),
  ]);

  const totalDurationMinutes = localRoad.durationMinutes + fare.durationMinutes;
  const score = calculateScore({
    highwayFareYen: fare.fareYen,
    localRoadDurationMinutes: localRoad.durationMinutes,
    localRoadDistanceKm: localRoad.distanceKm,
  });

  const isEstimated = fare.source === 'estimated';
  const reason = isEstimated
    ? '高速料金はデータがないため推定値です。'
    : fare.source === 'google'
    ? 'Google Routes API によるリアルタイムデータです。'
    : '';

  return {
    entranceIcId: entrance.id,
    entranceIcName: entrance.name,
    entranceRoadName: entrance.roadName,
    destinationIcId: destination.id,
    destinationIcName: destination.name,
    destinationRoadName: destination.roadName,
    localRoadDurationMinutes: localRoad.durationMinutes,
    localRoadDistanceKm: localRoad.distanceKm,
    highwayDurationMinutes: fare.durationMinutes,
    highwayDistanceKm: fare.distanceKm,
    highwayFareYen: fare.fareYen,
    totalDurationMinutes,
    score,
    labels: [],
    reason,
    highwaySteps,
  };
}

// 代替ICの候補をresultsに追加するヘルパー
async function tryAddAlternative(
  ic: Interchange,
  usedIds: Set<string>,
  condition: SearchCondition,
  destination: ReturnType<typeof findInterchangeById>
): Promise<IcCandidateResult | null> {
  if (!ic.entranceAvailable || usedIds.has(ic.id) || !destination) return null;

  const distKm = calculateDistanceKm(condition.origin, { lat: ic.lat, lng: ic.lng });
  const localRoadDistanceKm = Math.round(distKm * 10) / 10;
  const localRoadDurationMinutes = Math.max(3, Math.round((distKm / 30) * 60));

  try {
    const fare = await getHighwayFare({
      fromIcId: ic.id,
      toIcId: condition.exitIcId,
      vehicleType: condition.vehicleType,
      useEtc: condition.useEtc,
    });

    const totalDurationMinutes = localRoadDurationMinutes + fare.durationMinutes;
    const score = calculateScore({ highwayFareYen: fare.fareYen, localRoadDurationMinutes, localRoadDistanceKm });

    usedIds.add(ic.id);
    return {
      entranceIcId: ic.id,
      entranceIcName: ic.name,
      entranceRoadName: ic.roadName,
      destinationIcId: destination.id,
      destinationIcName: destination.name,
      destinationRoadName: destination.roadName,
      localRoadDurationMinutes,
      localRoadDistanceKm,
      highwayDurationMinutes: fare.durationMinutes,
      highwayDistanceKm: fare.distanceKm,
      highwayFareYen: fare.fareYen,
      totalDurationMinutes,
      score,
      labels: [],
      reason: '一般道は推定値です',
      highwaySteps: [],
    };
  } catch {
    return null;
  }
}

export async function computeMultipleRoutes(
  condition: SearchCondition
): Promise<IcCandidateResult[]> {
  // 1. Main route (full accuracy — Google API for local road + highway steps)
  const main = await computeIcRoute(condition);
  if (!main) return [];

  const results: IcCandidateResult[] = [main];
  const usedIds = new Set([condition.entranceIcId]);
  const destination = findInterchangeById(condition.exitIcId);
  if (!destination) return results;

  // 2. Adjacent ICs: prevIcId / nextIcId
  const mainIc = findInterchangeById(condition.entranceIcId);
  if (mainIc) {
    const adjIds = [mainIc.prevIcId, mainIc.nextIcId].filter(Boolean) as string[];
    for (const id of adjIds) {
      if (results.length >= 3) break;
      const ic = findInterchangeById(id);
      if (!ic) continue;
      const alt = await tryAddAlternative(ic, usedIds, condition, destination);
      if (alt) results.push(alt);
    }
  }

  // 3. Fallback: 出発地から近い入口IC（端のICで隣接が足りないとき）
  if (results.length < 3) {
    const candidates = getAllInterchanges()
      .filter((ic) => ic.entranceAvailable && !usedIds.has(ic.id))
      .map((ic) => ({
        ic,
        dist: calculateDistanceKm(condition.origin, { lat: ic.lat, lng: ic.lng }),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8); // 距離順の上位8件から試す

    for (const { ic } of candidates) {
      if (results.length >= 3) break;
      const alt = await tryAddAlternative(ic, usedIds, condition, destination);
      if (alt) results.push(alt);
    }
  }

  // 4. Label candidates
  const minFare = Math.min(...results.map((r) => r.highwayFareYen));
  const minTime = Math.min(...results.map((r) => r.totalDurationMinutes));
  const minScore = Math.min(...results.map((r) => r.score));

  results.forEach((r) => {
    const labels: CandidateLabel[] = [];
    if (r.highwayFareYen === minFare) labels.push('cheapest');
    if (r.totalDurationMinutes === minTime) labels.push('fastest');
    if (r.score === minScore && labels.length === 0) labels.push('recommended');
    r.labels = labels;
  });

  // Sort by score, return top 3
  return results.sort((a, b) => a.score - b.score).slice(0, 3);
}
