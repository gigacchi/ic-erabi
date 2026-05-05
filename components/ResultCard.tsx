'use client';

import { useState, useEffect, useRef } from 'react';
import type { IcCandidateResult } from '@/types';

const ROAD_SHORT: Record<string, string> = {
  '東名高速道路':          '東名',
  '新東名高速道路':         '新東名',
  '東北自動車道':          '東北道',
  '関越自動車道':          '関越道',
  '東京外環自動車道':       '外環',
  '中央自動車道':          '中央道',
  '首都圏中央連絡自動車道':  '圏央道',
  '北陸自動車道':          '北陸道',
  '常磐自動車道':          '常磐道',
  '東関東自動車道':         '東関道',
  '首都高速道路':          '首都高',
  '小田原厚木道路':         '小田厚',
};
const shortRoad = (name: string) => ROAD_SHORT[name] ?? name;

// デザイン準拠: 前の値から新しい値へアニメーション
function useCountUp(target: number, duration = 600): number {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const start = prev.current;
    const end = target;
    if (start === end) return;
    let raf: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(start + (end - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function getBadge(isStd: boolean, savingsYen: number, timeAddMinutes: number) {
  if (isStd) return { text: '標準', bg: '#3a352a' };
  if (savingsYen > 0 && timeAddMinutes <= 0) return { text: '最安・最速', bg: '#1c8a3a' };
  if (savingsYen >= 500) return { text: 'おすすめ最安', bg: '#c87b00' };
  if (savingsYen > 0) return { text: '節約案', bg: '#1c8a3a' };
  if (timeAddMinutes < 0) return { text: '最速', bg: '#1f5fc8' };
  return { text: '標準', bg: '#3a352a' };
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: '#fff', padding: '8px' }}>
      <div style={{ fontSize: 9, color: '#6f6a5a', fontWeight: 600, letterSpacing: '.03em' }}>
        {label}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 700, color: '#1a1810',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginTop: 2,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: '#8a8470', marginTop: 1 }}>{sub}</div>
    </div>
  );
}

type ResultCardProps = {
  result: IcCandidateResult;
  originLabel?: string;
  savingsYen?: number;
  timeAddMinutes?: number;
  isSelected?: boolean;
  isStd?: boolean;
};

export default function ResultCard({
  result,
  originLabel,
  savingsYen = 0,
  timeAddMinutes = 0,
  isSelected = false,
  isStd = false,
}: ResultCardProps) {
  const animatedSavings = useCountUp(savingsYen);
  const badge = getBadge(isStd, savingsYen, timeAddMinutes);

  return (
    <div
      style={{
        background: '#fff',
        border: isSelected ? '2px solid #e89000' : '1px solid #d8d3c4',
        borderRadius: 14,
        padding: '12px 13px',
        boxShadow: isSelected
          ? '0 4px 14px rgba(0,0,0,0.1), 0 0 0 4px rgba(232,144,0,0.13)'
          : '0 1px 0 rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.18s',
      }}
    >
      {/* バッジ行 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: badge.bg, color: '#fff',
            fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
            padding: '3px 7px', borderRadius: 4,
          }}>
            {badge.text}
          </span>
          {!isStd && savingsYen > 0 && timeAddMinutes > 0 && (
            <span style={{ fontSize: 10, color: '#6f6a5a', fontVariantNumeric: 'tabular-nums' }}>
              +{timeAddMinutes}分で
            </span>
          )}
        </div>
        {/* ラジオボタン */}
        <div style={{
          width: 18, height: 18, borderRadius: 999,
          border: isSelected ? '5px solid #e89000' : '1.5px solid #c0bba8',
          background: '#fff',
          flexShrink: 0,
          transition: 'all 0.15s',
        }} />
      </div>

      {/* IC区間 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: '#6f6a5a', fontWeight: 600 }}>IN</div>
          <div style={{
            fontSize: 16, fontWeight: 700, color: '#1a1810',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {result.entranceIcName}
          </div>
          <div style={{ fontSize: 9, color: '#9f9b8e' }}>{result.entranceRoadName}</div>
        </div>
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ flexShrink: 0 }}>
          <path d="M2 7H17M14 3L18 7L14 11"
            stroke="#a09a85" strokeWidth="1.6" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: '#6f6a5a', fontWeight: 600 }}>OUT</div>
          <div style={{
            fontSize: 16, fontWeight: 700, color: '#1a1810',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {result.destinationIcName}
          </div>
          <div style={{ fontSize: 9, color: '#9f9b8e' }}>{result.destinationRoadName}</div>
        </div>
      </div>

      {/* ルートタイムライン */}
      <div style={{
        marginBottom: 10,
        padding: '8px 10px',
        background: '#f7f5ed',
        borderRadius: 8,
      }}>
        {/* 時間内訳 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', fontSize: 10 }}>
          <span style={{ color: '#6f6a5a' }}>一般道</span>
          <span style={{ fontWeight: 700, color: '#1a1810', fontVariantNumeric: 'tabular-nums' }}>
            {result.localRoadDurationMinutes}分
          </span>
          <span style={{ color: '#bcb6a3' }}>→</span>
          <span style={{
            background: '#1c8a3a', color: '#fff',
            fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
          }}>IN</span>
          <span style={{ color: '#6f6a5a' }}>高速</span>
          <span style={{ fontWeight: 700, color: '#1a1810', fontVariantNumeric: 'tabular-nums' }}>
            {result.highwayDurationMinutes}分
          </span>
          <span style={{ color: '#bcb6a3' }}>→</span>
          <span style={{
            background: '#c83232', color: '#fff',
            fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
          }}>OUT</span>
        </div>
        {/* 路線変更 or 経由IC */}
        {result.entranceRoadName !== result.destinationRoadName ? (
          // 路線が変わる場合：乗り継ぎポイントを明示
          <div style={{ marginTop: 5, fontSize: 10, color: '#3a352a', fontWeight: 600 }}>
            {result.roadChangeLine ||
              `${shortRoad(result.entranceRoadName)}：${result.entranceIcName} → ${shortRoad(result.destinationRoadName)}`}
          </div>
        ) : (result.waypointIcNames ?? []).length > 0 ? (
          // 同一路線：経由ICを表示
          <div style={{ marginTop: 5, fontSize: 10, color: '#6f6a5a', display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <span style={{ color: '#bcb6a3', flexShrink: 0 }}>経由</span>
            {(result.waypointIcNames ?? []).map((name, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {i > 0 && <span style={{ color: '#bcb6a3' }}>›</span>}
                <span>{name}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* 数値グリッド（セル間 1px 区切り） */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 1,
        background: '#ece8da',
        border: '1px solid #ece8da',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <Stat
          label="ETC料金"
          value={`¥${result.highwayFareYen.toLocaleString()}`}
          sub={`高速 ${result.highwayDistanceKm}km`}
        />
        <Stat
          label="所要時間"
          value={`${result.totalDurationMinutes}分`}
          sub={result.localRoadDurationMinutes > 0
            ? `一般道+${result.localRoadDurationMinutes}分`
            : '高速のみ'}
        />
        <Stat
          label="距離"
          value={`${result.highwayDistanceKm}km`}
          sub={result.localRoadDistanceKm > 0
            ? `一般道+${result.localRoadDistanceKm}km`
            : '高速のみ'}
        />
      </div>

      {/* 節約額ハイライト */}
      {!isStd && (
        <div style={{
          marginTop: 8,
          padding: '8px 10px',
          background: savingsYen > 0 ? '#fff8e6' : '#f3f0e6',
          border: `1px solid ${savingsYen > 0 ? '#f0d896' : '#dcd6c4'}`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: '#6f6a5a', fontWeight: 600 }}>
            {savingsYen > 0 ? '節約額' : savingsYen < 0 ? '追加料金' : '料金同じ'}
          </span>
          <span style={{
            fontSize: 22, fontWeight: 800,
            color: savingsYen > 0 ? '#c87b00' : savingsYen < 0 ? '#c83232' : '#6f6a5a',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}>
            {savingsYen > 0 ? '−' : savingsYen < 0 ? '+' : ''}
            ¥{Math.abs(animatedSavings).toLocaleString()}
          </span>
        </div>
      )}

      {/* 経路詳細 */}
      {result.highwaySteps && result.highwaySteps.length > 0 && (
        <div style={{ borderTop: '1px solid #f0ece0', marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#6f6a5a', marginBottom: 4 }}>
            経路詳細 ·{' '}
            {result.entranceRoadName === result.destinationRoadName
              ? result.entranceRoadName
              : `${result.entranceRoadName} → ${result.destinationRoadName}`}
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.highwaySteps.map((step, i) => (
              <li key={i} style={{ display: 'flex', gap: 6, fontSize: 10, color: '#3a352a' }}>
                <span style={{ color: '#bcb6a3', flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ flex: 1 }}>
                  {step.instruction}
                  <span style={{ color: '#bcb6a3', marginLeft: 4 }}>({step.distanceKm}km)</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.reason && (
        <p style={{ fontSize: 9, color: '#c86400', marginTop: 8, padding: '0 2px' }}>
          {result.reason}
        </p>
      )}
    </div>
  );
}
