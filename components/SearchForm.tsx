'use client';

import { useState, useCallback, useMemo } from 'react';
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

// 固定の高速ボタン（3路線のみ）
const HIGHWAY_BUTTONS = [
  { roadId: 'tohoku',    label: '東北道', defaultExitIcId: 'tohoku_izumi' },
  { roadId: 'yamagata',  label: '山形道', defaultExitIcId: 'yamagata_yamagata_zao' },
  { roadId: 'hokuriku',  label: '北陸道', defaultExitIcId: 'hokuriku_sanjo_tsubame' },
  { roadId: 'tomei',     label: '東名',   defaultExitIcId: 'tomei_numazu' },
] as const;

const DEFAULT_ROAD_ID = 'tohoku';
const DEFAULT_EXIT_IC_ID = 'tohoku_izumi';

const allInterchanges = interchangesData as Interchange[];

// 降りるIC: 全路線の exitAvailable な IC
const exitIcIds = [...new Set(destinationAreasData.flatMap((a) => a.destinationIcIds))];
const allExitIcs = allInterchanges.filter((ic) => ic.exitAvailable);

const DEFAULT_ENTRANCE_IC_ID = 'gaikan_oizumi';

function computeNearbyIcs(origin: { lat: number; lng: number }): NearbyIc[] {
  return allInterchanges
    .filter((ic) => ic.entranceAvailable && ic.lat !== 0 && !exitIcIds.includes(ic.id))
    .map((ic) => ({
      ...ic,
      distanceKm: Math.round(calculateDistanceKm(origin, { lat: ic.lat, lng: ic.lng }) * 10) / 10,
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

  const [nearbyIcs, setNearbyIcs] = useState<NearbyIc[]>(() => computeNearbyIcs(DEFAULT_ORIGIN));
  const [selectedRoadId, setSelectedRoadId] = useState<string>(DEFAULT_ROAD_ID);

  // 乗るIC・降りるICともにIDで管理（インデックスはリストから逆引き）
  const [entranceIcId, setEntranceIcId] = useState<string>(DEFAULT_ENTRANCE_IC_ID);
  const [exitIcId, setExitIcId] = useState<string>(DEFAULT_EXIT_IC_ID);
  const [exitSearch, setExitSearch] = useState('');
  const [departureType, setDepartureType] = useState<'weekday' | 'midnight' | 'holiday'>('weekday');
  const [clockTime, setClockTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const applyNewOrigin = useCallback(async (lat: number, lng: number, label: string) => {
    setOrigin({ lat, lng, label, address: '' });
    const nearby = computeNearbyIcs({ lat, lng });
    setNearbyIcs(nearby);
    // 現在地変更時は最寄りIC（index 0）にリセット
    setEntranceIcId(nearby[0]?.id ?? DEFAULT_ENTRANCE_IC_ID);
    const addr = await reverseGeocode(lat, lng);
    setAddress(addr ?? label);
  }, []);

  // 乗るIC: 高速に連動せず、最寄り順で表示
  const entranceIcs = useMemo(() => nearbyIcs.slice(0, 30), [nearbyIcs]);
  const entranceIdx = Math.max(0, entranceIcs.findIndex((ic) => ic.id === entranceIcId));

  // 降りるIC: 選択中の道路でフィルタ
  const exitIcs = useMemo(
    () => allExitIcs.filter((ic) => ic.roadId === selectedRoadId),
    [selectedRoadId]
  );
  const exitIdx = Math.max(0, exitIcs.findIndex((ic) => ic.id === exitIcId));

  // 高速ボタン選択: 出口OUTのみ切り替え（入口INは変えない）
  const handleHighwaySelect = (roadId: string, defaultExitIcId: string) => {
    setSelectedRoadId(roadId);
    setExitIcId(defaultExitIcId);
    setExitSearch('');
  };

  // 出口IC検索: 全路線を横断検索（選択時に路線も切り替わる）
  const exitSearchResults = exitSearch.trim()
    ? allExitIcs.filter((ic) => ic.name.includes(exitSearch.trim())).slice(0, 10)
    : [];

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
    const entrance = entranceIcs[entranceIdx];
    const exit = exitIcs[exitIdx];
    if (!entrance || !exit) return;
    onSearch({
      origin: { lat: origin.lat, lng: origin.lng, label: origin.label, address },
      entranceIcId: entrance.id,
      exitIcId: exit.id,
      vehicleType: 'standard',
      useEtc: true,
      departureTime: departureType,
      clockTime: clockTime || undefined,
    });
  };

  const entrance = entranceIcs[entranceIdx];
  const exit = exitIcs[exitIdx];

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 現在地 */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6f6a5a', marginBottom: 6 }}>現在地</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: '#f7f5ed', borderRadius: 8,
              padding: '8px 12px', fontSize: 13, color: '#1a1810',
              border: '1px solid #d8d3c4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {origin.label}
            </div>
            {address && address !== origin.label && (
              <div style={{ fontSize: 11, color: '#6f6a5a', marginTop: 4, paddingLeft: 4 }}>
                {address}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={geoLoading}
            style={{
              padding: '8px 12px', fontSize: 12, fontWeight: 600,
              background: '#fff', border: '1px solid #d8d3c4',
              borderRadius: 8, cursor: geoLoading ? 'default' : 'pointer',
              opacity: geoLoading ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0,
              color: '#3a352a', fontFamily: 'inherit',
            }}
          >
            {geoLoading ? '取得中…' : '📍 取得'}
          </button>
        </div>
        {geoError && <p style={{ fontSize: 11, color: '#c83232', margin: '4px 0 0' }}>{geoError}</p>}
      </div>

      {/* 乗るIC */}
      {entrance && (
        <IcPicker
          label="乗るIC"
          kind="from"
          icName={entrance.name}
          icRoadName={entrance.roadName}
          info={`現在地から ${entrance.distanceKm.toFixed(1)} km`}
          onPrev={() => setEntranceIcId(entranceIcs[Math.max(0, entranceIdx - 1)].id)}
          onNext={() => setEntranceIcId(entranceIcs[Math.min(entranceIcs.length - 1, entranceIdx + 1)].id)}
          hasPrev={entranceIdx > 0}
          hasNext={entranceIdx < entranceIcs.length - 1}
        />
      )}

      {/* 入れ替えボタン */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0' }}>
        <button
          type="button"
          onClick={() => { setEntranceIcId(entranceIcs[0]?.id ?? DEFAULT_ENTRANCE_IC_ID); setExitIcId(HIGHWAY_BUTTONS.find(h => h.roadId === selectedRoadId)?.defaultExitIcId ?? DEFAULT_EXIT_IC_ID); }}
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
      {exit && (
        <IcPicker
          label="降りるIC"
          kind="to"
          icName={exit.name}
          icRoadName={exit.roadName}
          onPrev={() => setExitIcId(exitIcs[Math.max(0, exitIdx - 1)].id)}
          onNext={() => setExitIcId(exitIcs[Math.min(exitIcs.length - 1, exitIdx + 1)].id)}
          hasPrev={exitIdx > 0}
          hasNext={exitIdx < exitIcs.length - 1}
        />
      )}

      {/* 出口IC手動入力 */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={exitSearch}
          onChange={(e) => setExitSearch(e.target.value)}
          placeholder="出口ICを検索…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 12px', fontSize: 12,
            border: '1px solid #d8d3c4', borderRadius: 8,
            background: '#fff', color: '#1a1810',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        {exitSearchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            background: '#fff', border: '1px solid #d8d3c4', borderRadius: 8,
            marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: 180, overflowY: 'auto',
          }}>
            {exitSearchResults.map((ic) => (
              <button
                key={ic.id}
                type="button"
                onClick={() => { setExitIcId(ic.id); setSelectedRoadId(ic.roadId); setExitSearch(''); }}
                style={{
                  display: 'block', width: '100%',
                  padding: '9px 12px', textAlign: 'left',
                  background: ic.id === exitIcId ? '#fff8e6' : 'transparent',
                  border: 'none', borderBottom: '1px solid #f0ece0',
                  fontSize: 13, color: '#1a1810',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {ic.name}
                <span style={{ fontSize: 10, color: '#9f9b8e', marginLeft: 6 }}>{ic.roadName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 高速を指定（固定3路線）— 出口OUTの下 */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6f6a5a', marginBottom: 6 }}>高速を指定</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {HIGHWAY_BUTTONS.map(({ roadId, label, defaultExitIcId }) => {
            const isSelected = selectedRoadId === roadId;
            return (
              <button
                key={roadId}
                type="button"
                onClick={() => handleHighwaySelect(roadId, defaultExitIcId)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: 12, fontWeight: isSelected ? 700 : 500,
                  borderRadius: 8,
                  border: isSelected ? '1.5px solid #e89000' : '1px solid #d8d3c4',
                  background: isSelected ? '#fff8e6' : '#fff',
                  color: isSelected ? '#c87b00' : '#3a352a',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 出発時間帯（ETC割引） */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6f6a5a', marginBottom: 6 }}>出発時間帯</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {([
            { value: 'weekday',  label: '平日',     sub: '通常料金' },
            { value: 'midnight', label: '深夜',      sub: '0〜4時 -30%' },
            { value: 'holiday',  label: '土日・祝',  sub: '6〜22時 -30%' },
          ] as const).map(({ value, label, sub }) => {
            const isSelected = departureType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setDepartureType(value)}
                style={{
                  flex: 1, padding: '7px 4px',
                  fontSize: 12, fontWeight: isSelected ? 700 : 500,
                  borderRadius: 8,
                  border: isSelected ? '1.5px solid #e89000' : '1px solid #d8d3c4',
                  background: isSelected ? '#fff8e6' : '#fff',
                  color: isSelected ? '#c87b00' : '#3a352a',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {label}
                <span style={{
                  display: 'block', fontSize: 9, marginTop: 1,
                  color: isSelected ? '#c87b00' : '#9f9b8e',
                }}>{sub}</span>
              </button>
            );
          })}
        </div>
        {/* 出発時刻 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6f6a5a', flexShrink: 0 }}>出発時刻</span>
          <input
            type="time"
            value={clockTime}
            onChange={(e) => setClockTime(e.target.value)}
            style={{
              flex: 1, padding: '6px 10px', fontSize: 13,
              border: '1px solid #d8d3c4', borderRadius: 8,
              background: '#fff', color: '#1a1810',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !entrance || !exit}
        style={{
          width: '100%', padding: '13px',
          background: loading || !entrance || !exit ? '#bcb6a3' : '#1a1810',
          color: '#f3efe2',
          border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 700,
          cursor: loading || !entrance || !exit ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {loading ? '計算中…' : '料金・時間を調べる'}
      </button>
    </form>
  );
}
