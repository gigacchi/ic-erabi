'use client';

import { useState, useRef, useCallback } from 'react';
import SearchForm from '@/components/SearchForm';
import ResultCard from '@/components/ResultCard';
import TollTimeChart from '@/components/TollTimeChart';
import LoadingState from '@/components/LoadingState';
import type { IcCandidateResult, SearchCondition } from '@/types';

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<IcCandidateResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCondition, setLastCondition] = useState<SearchCondition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (cond: SearchCondition) => {
    setLoading(true);
    setError(null);
    setCandidates([]);
    setSelectedIdx(0);
    setLastCondition(cond);
    try {
      const res = await fetch('/api/routes/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cond),
      });
      const data = await res.json();
      setCandidates(data.candidates ?? []);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || candidates.length === 0) return;
    const cardW = el.scrollWidth / candidates.length;
    const idx = Math.round(el.scrollLeft / cardW);
    setSelectedIdx(Math.max(0, Math.min(idx, candidates.length - 1)));
  }, [candidates.length]);

  const originLabel = lastCondition?.origin.label ?? lastCondition?.origin.address;
  const baseFare = candidates[0]?.highwayFareYen ?? 0;
  const baseTotalMin = candidates[0]?.totalDurationMinutes ?? 0;

  const chartPoints = candidates.map((c, i) => ({
    index: i,
    durationMinutes: c.totalDurationMinutes,
    fareYen: c.highwayFareYen,
  }));

  const selRoute = candidates[selectedIdx];

  return (
    <main style={{ minHeight: '100dvh', background: '#f3efe2' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 48 }}>

        {/* ヘッダー（デザイン準拠） */}
        <div style={{
          background: '#fff',
          borderBottom: '1px solid #d8d3c4',
          padding: '8px 14px 10px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#6f6a5a',
              letterSpacing: '.05em',
            }}>
              HIGHWAY ROUTE
            </div>
            <div style={{
              fontSize: 10, color: '#6f6a5a',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999, background: '#1c8a3a',
                display: 'inline-block',
              }} />
              ETC・普通車・平日
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1810' }}>
            ICえらび — 乗るICと降りるICを比較
          </div>
        </div>

        {/* IC選択フォーム */}
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #d8d3c4',
            padding: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <SearchForm onSearch={handleSearch} loading={loading} />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '24px 14px 0' }}>
            <LoadingState />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{
              background: '#fff0f0', border: '1px solid #f0a0a0',
              borderRadius: 10, padding: '10px 12px',
              fontSize: 13, color: '#c83232',
            }}>
              {error}
            </div>
          </div>
        )}

        {/* 検索結果バー */}
        {!loading && candidates.length > 0 && (
          <div style={{
            margin: '10px 14px 0',
            padding: '8px 12px',
            background: '#fff',
            border: '1px solid #d8d3c4',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 11,
          }}>
            <span style={{ color: '#6f6a5a' }}>検索結果</span>
            <span style={{ color: '#1a1810', fontWeight: 700 }}>
              {candidates.length}件 ・{' '}
              {candidates[0]?.entranceIcName} → {candidates[0]?.destinationIcName}
            </span>
          </div>
        )}

        {/* グラフ */}
        {!loading && candidates.length >= 2 && (
          <div style={{ padding: '10px 14px 0' }}>
            <TollTimeChart
              points={chartPoints}
              selectedIndex={selectedIdx}
              onSelect={setSelectedIdx}
            />
          </div>
        )}

        {/* ルートカード（横スワイプ） */}
        {!loading && candidates.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {/* ラベル行 + ページネーター */}
            <div style={{
              padding: '0 14px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1810' }}>
                ルート候補
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {candidates.map((_, i) => (
                  <span key={i} style={{
                    width: i === selectedIdx ? 18 : 6,
                    height: 6, borderRadius: 999,
                    background: i === selectedIdx ? '#e89000' : '#d8d3c4',
                    transition: 'all 0.2s',
                    display: 'inline-block',
                  }} />
                ))}
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                display: 'flex', gap: 10,
                padding: '0 14px',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              } as React.CSSProperties}
            >
              {candidates.map((c, i) => {
                const savings = Math.max(0, baseFare - c.highwayFareYen);
                const timeAdd = c.totalDurationMinutes - baseTotalMin;
                return (
                  <div
                    key={i}
                    style={{
                      flexShrink: 0,
                      width: 'calc(100% - 0px)',
                      scrollSnapAlign: 'center',
                    }}
                    onClick={() => setSelectedIdx(i)}
                  >
                    <ResultCard
                      result={c}
                      originLabel={originLabel}
                      savingsYen={i === 0 ? 0 : savings}
                      timeAddMinutes={i === 0 ? 0 : timeAdd}
                      isSelected={i === selectedIdx}
                      isStd={i === 0}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 案内開始ボタン */}
        {!loading && selRoute && (
          <div style={{ padding: '12px 14px 0' }}>
            <button
              style={{
                width: '100%', padding: '14px',
                background: '#1a1810', color: '#f3efe2',
                border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                fontFamily: '"Hiragino Sans","Yu Gothic",-apple-system,sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer',
              }}
              onClick={() => {
                const url = `https://maps.google.com/maps?saddr=${lastCondition?.origin.lat},${lastCondition?.origin.lng}&daddr=${selRoute.destinationIcName}`;
                window.open(url, '_blank');
              }}
            >
              このルートで案内開始
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18"
                  stroke="currentColor" strokeWidth="2.4"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        <p style={{
          fontSize: 10, color: '#bcb6a3',
          marginTop: 16, textAlign: 'center', padding: '0 14px',
        }}>
          ※料金は参考値です。実際の料金は公式情報をご確認ください。
        </p>
      </div>
    </main>
  );
}
