'use client';

type IcPickerProps = {
  label: string;
  kind?: 'from' | 'to';
  icName: string;
  icRoadName: string;
  info?: string;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export default function IcPicker({
  label,
  kind = 'from',
  icName,
  icRoadName,
  info,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: IcPickerProps) {
  const isFrom = kind === 'from';
  const tagBg = isFrom ? '#1c8a3a' : '#c83232';
  const tagText = isFrom ? '入口 IN' : '出口 OUT';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #d8d3c4',
      borderRadius: 12,
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
    }}>
      {/* 左: IN/OUT タグ + ラベル */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 38, flexShrink: 0 }}>
        <div style={{
          background: tagBg, color: '#fff',
          fontSize: 9, fontWeight: 700, letterSpacing: '.05em',
          padding: '2px 5px', borderRadius: 3, lineHeight: 1.1, whiteSpace: 'nowrap',
        }}>{tagText}</div>
        {label && <div style={{ fontSize: 9, color: '#6f6a5a', marginTop: 3 }}>{label}</div>}
      </div>

      {/* 前ボタン */}
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        style={{
          width: 40, height: 40, borderRadius: 8, border: '1px solid #d8d3c4',
          background: hasPrev ? '#f7f5ed' : '#efece4',
          color: hasPrev ? '#3a352a' : '#bcb6a3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, cursor: hasPrev ? 'pointer' : 'default', flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 中央: IC名 + 道路情報 */}
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        <div style={{
          fontSize: 21, fontWeight: 700, color: '#1a1810', lineHeight: 1.1,
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{icName}</div>
        <div style={{ fontSize: 10, color: '#6f6a5a', marginTop: 2 }}>
          {icRoadName}{info ? ` · ${info}` : ''}
        </div>
      </div>

      {/* 次ボタン */}
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        style={{
          width: 40, height: 40, borderRadius: 8, border: '1px solid #d8d3c4',
          background: hasNext ? '#f7f5ed' : '#efece4',
          color: hasNext ? '#3a352a' : '#bcb6a3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, cursor: hasNext ? 'pointer' : 'default', flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
