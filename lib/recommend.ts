import type { IcCandidateResult, RouteSection, SearchCondition, CandidateLabel, Interchange } from '@/types';
import { findInterchangeById, getAllInterchanges, getWaypointIcNames, findNearestIcOnRoad, getRoadShortName } from './ic';
import { getHighwayFare, getHighwayRouteSteps } from './fareProvider';
import { getLocalRoadRoute } from './routeProvider';
import { calculateScore } from './score';
import { calculateDistanceKm } from './geo';

/** 異なる路線の場合のみ「外環：大泉IC → 東北道：川口IC」形式の文字列を返す */
function buildRoadChangeLine(
  fromId: string,
  fromRoadName: string,
  fromIcName: string,
  toRoadId: string,
  toRoadName: string
): string {
  const junctionIc = findNearestIcOnRoad(fromId, toRoadId);
  if (!junctionIc) return ''; // 同一路線
  return `${getRoadShortName(fromRoadName)}：${fromIcName} → ${getRoadShortName(toRoadName)}：${junctionIc.name}`;
}

/** 路線区間（セクション）を構築する */
function buildSections(
  entrance: Interchange,
  destination: Interchange,
  etcFareYen: number,
  durationMinutes: number,
  distanceKm: number,
): RouteSection[] {
  // 同一路線: 1セクション
  if (entrance.roadId === destination.roadId) {
    return [{
      roadName: entrance.roadName,
      fromIcName: entrance.name,
      toIcName: destination.name,
      distanceKm,
      etcFareYen,
      durationMinutes,
    }];
  }

  // 異路線: ジャンクションICを探して2セクションに分割
  const junctionIc = findNearestIcOnRoad(entrance.id, destination.roadId);
  if (!junctionIc) {
    return [{
      roadName: `${entrance.roadName}→${destination.roadName}`,
      fromIcName: entrance.name,
      toIcName: destination.name,
      distanceKm,
      etcFareYen,
      durationMinutes,
    }];
  }

  // 直線距離×1.3でハイウェイ係数を近似し、比率でセクション分割
  const rawDist1 = calculateDistanceKm(
    { lat: entrance.lat, lng: entrance.lng },
    { lat: junctionIc.lat, lng: junctionIc.lng }
  ) * 1.3;
  const sec1Dist = Math.max(0.1, Math.round(rawDist1 * 10) / 10);
  const sec2Dist = Math.max(0.1, Math.round((distanceKm - sec1Dist) * 10) / 10);
  const ratio = sec1Dist / (sec1Dist + sec2Dist);

  const sec1Etc = Math.round(etcFareYen * ratio / 10) * 10;
  const sec1Duration = Math.round(durationMinutes * ratio);

  return [
    {
      roadName: entrance.roadName,
      fromIcName: entrance.name,
      toIcName: junctionIc.name,
      distanceKm: sec1Dist,
      etcFareYen: sec1Etc,
      durationMinutes: sec1Duration,
    },
    {
      roadName: destination.roadName,
      fromIcName: junctionIc.name,
      toIcName: destination.name,
      distanceKm: sec2Dist,
      etcFareYen: etcFareYen - sec1Etc,
      durationMinutes: durationMinutes - sec1Duration,
    },
  ];
}

export async function computeIcRoute(
  condition: SearchCondition
): Promise<IcCandidateResult | null> {
  const entrance = findInterchangeById(condition.entranceIcId);
  const destination = findInterchangeById(condition.exitIcId);

  if (!entrance || !destination) return null;

  // 一般道: Google Routes API → 推定値
  const localRoad = await getLocalRoadRoute(condition.origin, {
    lat: entrance.lat,
    lng: entrance.lng,
  });

  // ETC料金・経路ステップを並列取得
  const [etcFare, highwaySteps] = await Promise.all([
    getHighwayFare({
      fromIcId: entrance.id,
      toIcId: destination.id,
      vehicleType: condition.vehicleType,
      useEtc: true,
    }),
    getHighwayRouteSteps({ fromIcId: entrance.id, toIcId: destination.id }),
  ]);

  const totalDurationMinutes = localRoad.durationMinutes + etcFare.durationMinutes;
  const score = calculateScore({
    highwayFareYen: etcFare.fareYen,
    localRoadDurationMinutes: localRoad.durationMinutes,
    localRoadDistanceKm: localRoad.distanceKm,
  });

  const sections = buildSections(
    entrance, destination,
    etcFare.fareYen,
    etcFare.durationMinutes, etcFare.distanceKm,
  );

  const isEstimated = etcFare.source === 'estimated';
  const reason = isEstimated
    ? '高速料金はデータがないため推定値です。'
    : etcFare.source === 'google'
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
    highwayDurationMinutes: etcFare.durationMinutes,
    highwayDistanceKm: etcFare.distanceKm,
    highwayFareYen: etcFare.fareYen,
    totalDurationMinutes,
    score,
    labels: [],
    reason,
    waypointIcNames: getWaypointIcNames(entrance.id, destination.id),
    roadChangeLine: buildRoadChangeLine(entrance.id, entrance.roadName, entrance.name, destination.roadId, destination.roadName),
    highwaySteps,
    sections,
    departureType: condition.departureTime,
    clockTime: condition.clockTime,
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
      useEtc: true,
    });

    const totalDurationMinutes = localRoadDurationMinutes + fare.durationMinutes;
    const score = calculateScore({ highwayFareYen: fare.fareYen, localRoadDurationMinutes, localRoadDistanceKm });

    const sections = buildSections(
      ic, destination,
      fare.fareYen,
      fare.durationMinutes, fare.distanceKm,
    );

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
      waypointIcNames: getWaypointIcNames(ic.id, destination.id),
      roadChangeLine: buildRoadChangeLine(ic.id, ic.roadName, ic.name, destination.roadId, destination.roadName),
      highwaySteps: [],
      sections,
      departureType: condition.departureTime,
      clockTime: condition.clockTime,
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
      .slice(0, 8);

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

  // results[0] はユーザーが選んだICのルート → 常に先頭固定
  const [userRoute, ...alts] = results;
  alts.sort((a, b) => a.score - b.score);
  return [userRoute, ...alts].slice(0, 3);
}
