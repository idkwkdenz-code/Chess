import React from 'react';
import { Clock } from 'lucide-react';

interface ChessClockProps {
  ms: number;
  active: boolean;
  label: string;
  rating?: number;
  subtitle?: string;
}

export function formatClockMs(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10000) {
    const secs = (clamped / 1000).toFixed(1);
    return `0:${secs.padStart(4, '0')}`;
  }
  const totalSec = Math.ceil(clamped / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remM = mins % 60;
    return `${hrs}:${String(remM).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export const ChessClock: React.FC<ChessClockProps> = ({
  ms,
  active,
  label,
  rating,
  subtitle,
}) => {
  const lowTime = ms > 0 && ms <= 20000;
  const flagged = ms <= 0;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-colors ${
        active
          ? 'bg-white dark:bg-slate-900 border-emerald-600/60 dark:border-emerald-500/60'
          : 'bg-slate-100/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {label}
          </span>
          {rating !== undefined && (
            <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
              ({rating})
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
        )}
      </div>

      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono-tabular text-base font-bold shrink-0 ${
          flagged
            ? 'bg-rose-600 text-white'
            : active && lowTime
              ? 'bg-amber-500 text-slate-950'
              : active
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{formatClockMs(ms)}</span>
      </div>
    </div>
  );
};
