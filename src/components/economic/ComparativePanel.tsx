'use client';

import { useState } from 'react';
import { COUNTRIES, COUNTRY_CODES } from '@/data/economicCountries';
import { HISTORICAL_DATA, HistoricalData } from '@/data/economicExtended';

interface ComparativePanelProps {
  baseCode: string;
}

export default function ComparativePanel({ baseCode }: ComparativePanelProps) {
  const [compareCode, setCompareCode] = useState<string | null>(null);

  const base = HISTORICAL_DATA[baseCode];
  const compare = compareCode ? HISTORICAL_DATA[compareCode] : null;

  const metrics = [
    { key: 'gdpGrowth', label: 'GDP Growth', unit: '%' },
    { key: 'inflation', label: 'Inflation', unit: '%' },
    { key: 'unemployment', label: 'Unemployment', unit: '%' },
    { key: 'debtToGdp', label: 'Debt/GDP', unit: '%' },
  ] as const;

  const barWidth = 120;
  const barHeight = 14;
  const maxVal = 300; // Max for debt/GDP scaling

  const scaleBar = (val: number | null) => {
    if (val === null) return 0;
    return Math.min(Math.abs(val) / maxVal * barWidth, barWidth);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d0d14] p-5 hover:border-white/10 transition-all duration-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <span className="text-sm text-white/40 tracking-wide uppercase font-medium">Comparative Analysis</span>
        </div>
        <select
          value={compareCode || ''}
          onChange={(e) => setCompareCode(e.target.value || null)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none focus:border-[#378ADD]/50"
        >
          <option value="">Compare with...</option>
          {COUNTRY_CODES.filter(c => c !== baseCode).map(code => (
            <option key={code} value={code}>
              {COUNTRIES[code].flag} {COUNTRIES[code].name}
            </option>
          ))}
        </select>
      </div>

      {!compare ? (
        <div className="text-center py-8">
          <span className="text-sm text-white/30">Select a country to compare</span>
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map((metric) => {
            const baseVals = base[metric.key];
            const compareVals = compare[metric.key];
            const baseLatest = baseVals[baseVals.length - 1];
            const compareLatest = compareVals[compareVals.length - 1];

            return (
              <div key={metric.key}>
                <div className="text-xs text-white/50 mb-2 font-medium">{metric.label}</div>
                <div className="space-y-1.5">
                  {/* Base country */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{COUNTRIES[baseCode].flag}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#378ADD]/50 transition-all"
                        style={{ width: scaleBar(baseLatest) }}
                      />
                    </div>
                    <span className="text-xs text-white/70 w-14 text-right font-medium">
                      {baseLatest !== null ? `${baseLatest.toFixed(1)}${metric.unit}` : '—'}
                    </span>
                  </div>
                  {/* Compare country */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{compareCode && COUNTRIES[compareCode]?.flag}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/50 transition-all"
                        style={{ width: scaleBar(compareLatest) }}
                      />
                    </div>
                    <span className="text-xs text-white/70 w-14 text-right font-medium">
                      {compareLatest !== null ? `${compareLatest.toFixed(1)}${metric.unit}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
