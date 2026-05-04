'use client';

import type { Interchange } from '@/types';

type IcSwitcherProps = {
  current: Interchange;
  allInterchanges: Interchange[];
  onChange: (icId: string) => void;
};

export default function IcSwitcher({ current, allInterchanges, onChange }: IcSwitcherProps) {
  const prev = current.prevIcId
    ? allInterchanges.find((ic) => ic.id === current.prevIcId)
    : null;
  const next = current.nextIcId
    ? allInterchanges.find((ic) => ic.id === current.nextIcId)
    : null;

  if (!prev && !next) return null;

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={() => prev && onChange(prev.id)}
        disabled={!prev}
        className="flex-1 py-2 px-3 text-sm rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
      >
        ← {prev ? prev.name : '前IC'}
      </button>
      <span className="text-xs text-gray-500 whitespace-nowrap">{current.name}</span>
      <button
        onClick={() => next && onChange(next.id)}
        disabled={!next}
        className="flex-1 py-2 px-3 text-sm rounded-lg border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
      >
        {next ? next.name : '次IC'} →
      </button>
    </div>
  );
}
