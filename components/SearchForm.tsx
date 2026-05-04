'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { SearchCondition, Interchange } from '@/types';
import interchangesData from '@/data/interchanges.json';
import destinationAreasData from '@/data/destinationAreas.json';
import { calculateDistanceKm } from '@/lib/geo';
import IcPicker from './IcPicker';

type NearbyIc = Interchange & { distanceKm: number };

const DEFAULT_ORIGIN = {
  lat: 35.6938,
  lng: 139.7034,
  label: '東京都新宿区西新宿',
  address: '東京都新宿区西新宿',
};

const ROAD_LABELS: Record<string, string> = {
  shuto: '首都高',
  tomei: '東名',
  shin_tomei: '新東名',
  chuo: '中央道',
  tohoku: '東北道',
  kanetsu: '関越道',
  hokuriku: '北陸道',
  joban: '常磐道',
  higashikanto: '東関東道',
  kenodo: '圏央道',
  gaikan: '外環道',
  odawara_atsugi: '小田原厚木',
};

const allInterchanges = interchangesData as Interchange[];

// 降りるIC: destinationAreas に登録された全ユニークIC
const exitIcIds = [...new Set(destinationAreasData.flatMap((a) => a.destinationIcIds))];
const allExitIcs = exitIcIds
  .map((id) => allInterchanges.find((ic) => ic.id === id))
  .filter((ic): ic is Interchange => ic !== undefined);

// デフォルト乗るIC
const DEFAULT_ENTRANCE_IC_ID = 'gaikan_oizumi';

function computeNearbyIcs(origin: { lat: number; lng: number }): NearbyIc[] {
  return allInterchanges
    .filter((ic) => ic.entranceAvailable && ic.lat !== 0 && !exitIcIds.includes(ic.id))
    .map((ic) => ({
      ...ic,
      distanceKm:
        Math.round(calculateDistanceKm(origin, { lat: ic.lat, lng: ic.lng }) * 10) / 10,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
      { headers: { 'User-Agent': 'ICErabi/1.0' } }
    );
    const data = await res.json();
    const addr = data.address ?? {};
    const parts = [
      addr.state,
      addr.city ?? addr.town ?? addr.village ?? addr.county,
      addr.suburb ?? addr.neighbourhood ?? addr.quarter,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('') : (data.display_name?.split(',')[0] ?? null);
  } catch {
    return null;
  }
}

type SearchFormProps = {
  onSearch: (condition: SearchCondition) => void;
  loading?: boolean;
};

export default function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [address, setAddress] = useState<string>(DEFAULT_ORIGIN.address);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [nearbyIcs, setNearbyIcs] = useState<NearbyIc[]>(() =>
    computeNearbyIcs(DEFAULT_ORIGIN)
  );
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  // 大泉ICをデフォルト選択
  const [entranceIdx, setEntranceIdx] = useState(() => {
    const ics = computeNearbyIcs(DEFAULT_ORIGIN).slice(0, 30);
    const idx = ics.findIndex((ic) => ic.id === DEFAULT_ENTRANCE_IC_ID);
    return idx >= 0 ? idx : 0;
  });
  const [exitIdx, setExitIdx] = useState(0);

  const applyNewOrigin = useCallback(async (lat: number, lng: number, label: string) => {
    setOrigin({ lat, lng, label, address: '' });
    const nearby = computeNearbyIcs({ lat, lng });
    setNearbyIcs(nearby);
    setEntranceIdx(0);
    setSelectedRoadId(null);
    const addr = await reverseGeocode(lat, lng);
    setAddress(addr ?? label);
  }, []);

  // 道路指定あり → その道路の全IC、なし → 最寄り30件
  const filteredEntranceIcs = useMemo(
    () =>
      selectedRoadId
        ? nearbyIcs.filter((ic) => ic.roadId === selectedRoadId)
        : nearbyIcs.slice(0, 30),
    [nearbyIcs, selectedRoadId]
  );

  // 降りるICも「高速を指定」と連動: 東名/新東名のときだけ絞り込み
  const filteredExitIcs = useMemo(() => {
    if (selectedRoadId === 'tomei') return allExitIcs.filter((ic) => ic.roadId === 'tomei');
    if (selectedRoadId === 'shin_tomei') return allExitIcs.filter((ic) => ic.roadId === 'shin_tomei');
    return allExitIcs;
  }, [selectedRoadId]);

  // 降りるICリストが変わったら exitIdx をリセット
  useEffect(() => {
    setExitIdx(0);
  }, [filteredExitIcs]);

  // 道路ボタンは最寄り30件から導出（現在地周辺の道路のみ表示）
  const availableRoads = useMemo(() => {
    const ids = [...new Set(nearbyIcs.slice(0, 30).map((ic) => ic.roadId))];
    return ids.filter((id) => id in ROAD_LABELS);
  }, [nearbyIcs]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('このブラウザは位置情報に対応していません');
      return;
    }
    setGeoError(null);
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyNewOrigin(pos.coords.latitude, pos.coords.longitude, '現在地');
        setGeoLoading(false);
      },
      () => {
        setGeoError('位置情報の取得に失敗しました');
        setGeoLoading(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entrance = filteredEntranceIcs[entranceIdx];
    const exit = filteredExitIcs[exitIdx];
    if (!entrance || !exit) return;
    onSearch({
      origin: { lat: origin.lat, lng: origin.lng, label: origin.label, address },
      entranceIcId: entrance.id,
      exitIcId: exit.id,
      vehicleType: 'standard',
      useEtc: true,
      departureTime: 'now',
    });
  };

  const entrance = filteredEntranceIcs[entranceIdx];
  const exit = filteredExitIcs[exitIdx];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* 現在地 */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">現在地</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-800 border border-gray-200 truncate">
            {origin.label}
          </div>
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={geoLoading}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 whitespace-nowrap flex-shrink-0"
          >
            {geoLoading ? '取得中…' : '📍 取得'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 px-1">{address}</p>
        {geoError && <p className="text-xs text-red-500 mt-1">{geoError}</p>}
      </div>

      {/* 乗るIC */}
      {entrance ? (
        <IcPicker
          label="乗るIC"
          kind="from"
          icName={entrance.name}
          icRoadName={entrance.roadName}
          info={`現在地から ${entrance.distanceKm.toFixed(1)} km`}
          onPrev={() => setEntranceIdx((i) => Math.max(0, i - 1))}
          onNext={() => setEntranceIdx((i) => Math.min(filteredEntranceIcs.length - 1, i + 1))}
          hasPrev={entranceIdx > 0}
          hasNext={entranceIdx < filteredEntranceIcs.length - 1}
        />
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">
          付近に乗れるICが見つかりません
        </p>
      )}

      {/* 入れ替えボタン */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
        <button
          type="button"
          onClick={() => { setEntranceIdx(0); setExitIdx(0); }}
          title="ICをリセット"
          style={{
            width: 32, height: 32, borderRadius: 999,
            border: '1px solid #d8d3c4',
            background: '#fff', color: '#3a352a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M7 3L3 7L7 11M3 7H17C19.2 7 21 8.8 21 11V13M17 21L21 17L17 13M21 17H7C4.8 17 3 15.2 3 13V11"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* 降りるIC */}
      {exit ? (
        <IcPicker
          label="降りるIC"
          kind="to"
          icName={exit.name}
          icRoadName={exit.roadName}
          onPrev={() => setExitIdx((i) => Math.max(0, i - 1))}
          onNext={() => setExitIdx((i) => Math.min(filteredExitIcs.length - 1, i + 1))}
          hasPrev={exitIdx > 0}
          hasNext={exitIdx < filteredExitIcs.length - 1}
        />
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">該当するICがありません</p>
      )}

      {/* 高速を指定 */}
      {availableRoads.length > 1 && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">高速を指定</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { setSelectedRoadId(null); setEntranceIdx(0); }}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                selectedRoadId === null
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              すべて
            </button>
            {availableRoads.map((roadId) => (
              <button
                key={roadId}
                type="button"
                onClick={() => { setSelectedRoadId(roadId); setEntranceIdx(0); }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  selectedRoadId === roadId
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {ROAD_LABELS[roadId] ?? roadId}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !entrance || !exit}
        className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl disabled:opacity-60 hover:bg-blue-600 transition-colors text-sm"
      >
        {loading ? '計算中…' : '料金・時間を調べる'}
      </button>
    </form>
  );
}
