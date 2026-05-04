'use client';

import type { IcCandidateResult } from '@/types';

const LABEL_CONFIG = {
  recommended: { text: 'おすすめ', className: 'bg-blue-100 text-blue-700' },
  cheapest: { text: '最安', className: 'bg-green-100 text-green-700' },
  fastest: { text: '最短', className: 'bg-orange-100 text-orange-700' },
  smartIc: { text: 'スマートIC', className: 'bg-purple-100 text-purple-700' },
  localRoadLong: { text: '一般道長め', className: 'bg-yellow-100 text-yellow-700' },
  detour: { text: '遠回り', className: 'bg-red-100 text-red-700' },
} as const;

type CandidateTableProps = {
  candidates: IcCandidateResult[];
};

export default function CandidateTable({ candidates }: CandidateTableProps) {
  if (candidates.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-gray-700 mb-3">候補一覧</h2>
      <div className="flex flex-col gap-3">
        {candidates.map((c, i) => (
          <div
            key={`${c.entranceIcId}-${c.destinationIcId}`}
            className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-3"
          >
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1 mb-1">
                {c.labels.slice(0, 2).map((label) => {
                  const config = LABEL_CONFIG[label];
                  if (!config) return null;
                  return (
                    <span key={label} className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.className}`}>
                      {config.text}
                    </span>
                  );
                })}
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">
                {c.entranceIcName} → {c.destinationIcName}
              </p>
              <p className="text-xs text-gray-500">{c.entranceRoadName}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">¥{c.highwayFareYen.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{c.totalDurationMinutes}分</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
