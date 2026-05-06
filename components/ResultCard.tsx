'use client';

import { useState, useEffect, useRef } from 'react';
import type { IcCandidateResult } from '@/types';

// 前の値から新しい値へアニメーション
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
  if (isStd) return { text: '選択ルート', bg: '#3a352a' };
  if (savingsYen > 0 && timeAddMinutes <= 0) return { text: '最安・最速', bg: '#1c8a3a' };
  if (savingsYen >= 500) return { text: 'おすすめ最安', bg: '#c87b00' };
  if (savingsYen > 0) return { text: '節約案', bg: '#1c8a3a' };
  if (timeAddMinutes < 0) return { text: '最速', bg: '#1f5fc8' };
  return { text: '標準', bg: '#3a352a' };
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

function FareRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0', borderBottom: '1px solid #ece8da',
    }}>
      <span style={{ fontSize: 10, color: highlight ? '#c87b00' : '#6f6a5a', fontWeight: highlight ? 700 : 400 }}>
        {label}
      </span>
      <span style={{
        fontSize: 12, fontWeight: highlight ? 700 : 600,
        color: highlight ? '#c87b00' : '#1a1810',
        fontVariantNumeric: 'tabular-nums',
      }}>
        ¥{value.toLocaleString()}
      </span>
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
  savingsYen = 0,
  timeAddMinutes = 0,
  isSelected = false,
  isStd = false,
}: ResultCardProps) {
  const animatedSavings = useCountUp(savingsYen);
  const badge = getBadge(isStd, savingsYen, timeAddMinutes);

  const sections = result.sections ?? [];
  const departureType = result.departureType ?? 'weekday';
  const clockTime = result.clockTime;

  // 各セクションの到着時刻（出発時刻 + 一般道 + 累積高速時間）
  let cumMin = result.localRoadDurationMinutes;
  const sectionTimes = sections.map((sec) => {
    const enterTime = clockTime ? addMinutes(clockTime, cumMin) : null;
    cumMin += sec.durationMinutes;
    const exitTime = clockTime ? addMinutes(clockTime, cumMin) : null;
    return { enterTime, exitTime };
  });

  // 合計料金
  const totalEtcFare  = sections.reduce((s, sec) => s + sec.etcFareYen, 0)    || result.highwayFareYen;
  const totalGenFare  = sections.reduce((s, sec) => s + sec.generalFareYen, 0) || result.generalFareYen;

  return (
    <div style={{
      background: '#fff',
      border: isSelected ? '2px solid #e89000' : '1px solid #d8d3c4',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: isSelected
        ? '0 4px 14px rgba(0,0,0,0.1), 0 0 0 4px rgba(232,144,0,0.13)'
        : '0 1px 0 rgba(0,0,0,0.04)',
      cursor: 'pointer',
      transition: 'all 0.18s',
    }}>

      {/* バッジ行 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 13px 8px', borderBottom: '1px solid #f0ece0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: badge.bg, color: '#fff',
            fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
            padding: '3px 7px', borderRadius: 4,
          }}>{badge.text}</span>
          {!isStd && savingsYen > 0 && timeAddMinutes > 0 && (
            <span style={{ fontSize: 10, color: '#6f6a5a', fontVariantNumeric: 'tabular-nums' }}>
              +{timeAddMinutes}分で
            </span>
          )}
        </div>
        <div style={{
          width: 18, height: 18, borderRadius: 999,
          border: isSelected ? '5px solid #e89000' : '1.5px solid #c0bba8',
          background: '#fff', flexShrink: 0, transition: 'all 0.15s',
        }} />
      </div>

      {/* サマリーバー */}
      <div style={{
        background: '#1a1810', padding: '10px 14px',
        display: 'flex', gap: 16, flexWrap: 'wrap', rowGap: 6,
      }}>
        <div>
          <div style={{ fontSize: 8, color: '#9f9b8e', fontWeight: 600, letterSpacing: '.05em' }}>所要時間</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#f3efe2', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {formatDuration(result.totalDurationMinutes)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#9f9b8e', fontWeight: 600, letterSpacing: '.05em' }}>高速距離</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#f3efe2', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {result.highwayDistanceKm}km
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: '#9f9b8e', fontWeight: 600, letterSpacing: '.05em' }}>一般 / ETC</div>
          <div style={{ lineHeight: 1.1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#bcb6a3', fontVariantNumeric: 'tabular-nums' }}>
              ¥{totalGenFare.toLocaleString()}
            </span>
            <span style={{ fontSize: 8, color: '#6f6a5a', margin: '0 4px' }}>/</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#f3efe2', fontVariantNumeric: 'tabular-nums' }}>
              ¥{totalEtcFare.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* タイムライン */}
      <div style={{ padding: '14px 14px 4px' }}>

        {/* 出発地（一般道開始） */}
        {result.localRoadDurationMinutes > 0 && (
          <div style={{ display: 'flex', marginBottom: 0 }}>
            {/* 時刻列 */}
            <div style={{ width: 48, textAlign: 'right', paddingRight: 10, flexShrink: 0, paddingTop: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: clockTime ? '#6f6a5a' : '#bcb6a3' }}>
                {clockTime ?? '出発'}
              </span>
            </div>
            {/* 縦線・ドット */}
            <div style={{ width: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #c0bba8', background: '#fff', flexShrink: 0 }} />
              <div style={{ width: 1, flex: 1, minHeight: 28, background: '#e0dcd0' }} />
            </div>
            {/* 内容 */}
            <div style={{ flex: 1, paddingLeft: 8, paddingBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#9f9b8e' }}>出発地</div>
              <div style={{ fontSize: 10, color: '#c0bba8', marginTop: 2 }}>
                一般道 {result.localRoadDistanceKm}km · {result.localRoadDurationMinutes}分
              </div>
            </div>
          </div>
        )}

        {/* 各路線セクション */}
        {sections.map((sec, i) => {
          const isLast = i === sections.length - 1;
          const times = sectionTimes[i];
          const etcHalf   = Math.round(sec.etcFareYen * 0.7 / 10) * 10;

          return (
            <div key={i}>
              {/* 入口IC / 乗り継ぎJCT */}
              <div style={{ display: 'flex' }}>
                <div style={{ width: 48, textAlign: 'right', paddingRight: 10, flexShrink: 0, paddingTop: 2 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: times.enterTime ? '#1a1810' : '#bcb6a3',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {times.enterTime ?? (i === 0 ? 'IN' : '→')}
                  </span>
                </div>
                <div style={{ width: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: i === 0 ? '#1c8a3a' : '#6f6a5a',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 5, color: '#fff', fontWeight: 800, letterSpacing: 0 }}>
                      {i === 0 ? 'IN' : 'JCT'}
                    </span>
                  </div>
                  <div style={{ width: 2, flex: 1, minHeight: 120, background: '#d8d3c4' }} />
                </div>
                <div style={{ flex: 1, paddingLeft: 8, paddingBottom: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1810', lineHeight: 1.2 }}>
                    {sec.fromIcName}
                  </div>
                </div>
              </div>

              {/* 路線区間情報 */}
              <div style={{ display: 'flex' }}>
                <div style={{ width: 48, flexShrink: 0 }} />
                <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 2, background: '#d8d3c4' }} />
                </div>
                <div style={{ flex: 1, paddingLeft: 8, paddingBottom: 14 }}>
                  {/* 路線名・距離・時間 */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#3a352a', marginBottom: 2 }}>
                    {sec.roadName}
                  </div>
                  <div style={{ fontSize: 10, color: '#9f9b8e', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
                    {sec.distanceKm}km · {formatDuration(sec.durationMinutes)}
                  </div>
                  {/* 料金内訳 */}
                  <div style={{ background: '#f7f5ed', borderRadius: 8, padding: '8px 10px' }}>
                    <FareRow label="一般料金" value={sec.generalFareYen} />
                    <FareRow
                      label="ETC料金"
                      value={sec.etcFareYen}
                      highlight={departureType === 'weekday'}
                    />
                    <FareRow
                      label="深夜割引（0〜4時 / 30%）"
                      value={etcHalf}
                      highlight={departureType === 'midnight'}
                    />
                    <div style={{ borderBottom: 'none' }}>
                      <FareRow
                        label="休日割引（土日祝 / 30%）"
                        value={etcHalf}
                        highlight={departureType === 'holiday'}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 出口IC（最後のセクションのみ） */}
              {isLast && (
                <div style={{ display: 'flex', marginBottom: 10 }}>
                  <div style={{ width: 48, textAlign: 'right', paddingRight: 10, flexShrink: 0, paddingTop: 2 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: times.exitTime ? '#1a1810' : '#bcb6a3',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {times.exitTime ?? 'OUT'}
                    </span>
                  </div>
                  <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#c83232',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 5, color: '#fff', fontWeight: 800 }}>OUT</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, paddingLeft: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1810', lineHeight: 1.2 }}>
                      {sec.toIcName}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* sections が空のフォールバック */}
        {sections.length === 0 && (
          <div style={{ padding: '8px 0', color: '#9f9b8e', fontSize: 12 }}>
            {result.entranceIcName} → {result.destinationIcName}
          </div>
        )}
      </div>

      {/* 節約額 */}
      {!isStd && (
        <div style={{
          margin: '0 13px 12px',
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
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
          }}>
            {savingsYen > 0 ? '−' : savingsYen < 0 ? '+' : ''}
            ¥{Math.abs(animatedSavings).toLocaleString()}
          </span>
        </div>
      )}

      {result.reason && (
        <p style={{ fontSize: 9, color: '#c86400', margin: '0 13px 10px' }}>
          {result.reason}
        </p>
      )}
    </div>
  );
}
