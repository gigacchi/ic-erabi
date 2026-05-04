'use client';

type ChartPoint = {
  index: number;
  durationMinutes: number;
  fareYen: number;
};

type TollTimeChartProps = {
  points: ChartPoint[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
};

const yen = (n: number) => '¥' + n.toLocaleString('ja-JP');

export default function TollTimeChart({ points, selectedIndex, onSelect }: TollTimeChartProps) {
  if (points.length < 2) return null;

  const W = 320, H = 180;
  const padL = 38, padR = 14, padT = 14, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const minYen = Math.min(...points.map((p) => p.fareYen));
  const maxYen = Math.max(...points.map((p) => p.fareYen));
  const minMin = Math.min(...points.map((p) => p.durationMinutes));
  const maxMin = Math.max(...points.map((p) => p.durationMinutes));
  const yenRange = Math.max(maxYen - minYen, 100);
  const minRange = Math.max(maxMin - minMin, 5);

  // x: 時間（短い→左）, y: 料金（安い→下）
  const px = (m: number) => padL + ((m - minMin) / minRange) * innerW;
  const py = (f: number) => padT + ((f - minYen) / yenRange) * innerH;

  const std = points[0];

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #d8d3c4',
      borderRadius: 12,
      padding: '12px 12px 10px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1810' }}>料金 × 時間</div>
        <div style={{ fontSize: 10, color: '#6f6a5a' }}>左下が理想 ↙</div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        {/* 水平グリッド線 */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line key={p}
            x1={padL} x2={W - padR}
            y1={padT + p * innerH} y2={padT + p * innerH}
            stroke="#ece8da" strokeWidth="1"
            strokeDasharray={p === 0 || p === 1 ? '' : '2 3'}
          />
        ))}

        {/* 軸ラベル */}
        <text x={padL - 6} y={padT + 4} fontSize="9" fill="#8a8470" textAnchor="end">
          {yen(maxYen)}
        </text>
        <text x={padL - 6} y={padT + innerH + 4} fontSize="9" fill="#8a8470" textAnchor="end">
          {yen(minYen)}
        </text>
        <text x={padL} y={H - 8} fontSize="9" fill="#8a8470">{minMin}分</text>
        <text x={W - padR} y={H - 8} fontSize="9" fill="#8a8470" textAnchor="end">{maxMin}分</text>
        <text x={6} y={padT + innerH / 2} fontSize="9" fill="#6f6a5a"
          transform={`rotate(-90 6 ${padT + innerH / 2})`} textAnchor="middle">料金</text>
        <text x={padL + innerW / 2} y={H - 2} fontSize="9" fill="#6f6a5a" textAnchor="middle">所要時間</text>

        {/* 標準ルートからの参照線（破線） */}
        {std && (
          <>
            <line
              x1={px(std.durationMinutes)} y1={padT}
              x2={px(std.durationMinutes)} y2={padT + innerH}
              stroke="#d8d3c4" strokeWidth="1" strokeDasharray="2 3"
            />
            <line
              x1={padL} y1={py(std.fareYen)}
              x2={W - padR} y2={py(std.fareYen)}
              stroke="#d8d3c4" strokeWidth="1" strokeDasharray="2 3"
            />
          </>
        )}

        {/* 各ルート点 */}
        {points.map((p, i) => {
          const cx = px(p.durationMinutes);
          const cy = py(p.fareYen);
          const isSel = i === selectedIndex;
          const isStd = i === 0;
          return (
            <g key={i} onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              {isSel && (
                <circle cx={cx} cy={cy} r={14}
                  fill="none" stroke="#e89000" strokeWidth="1.5" opacity="0.4" />
              )}
              <circle cx={cx} cy={cy}
                r={isSel ? 9 : 6}
                fill={isSel ? '#e89000' : (isStd ? '#3a352a' : '#fff')}
                stroke={isSel ? '#fff' : (isStd ? '#3a352a' : '#a09a85')}
                strokeWidth={isSel ? 2 : 1.5}
              />
              <text x={cx} y={cy + 3} fontSize="9" fontWeight="700"
                fill={isSel || isStd ? '#fff' : '#3a352a'}
                textAnchor="middle" pointerEvents="none">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
