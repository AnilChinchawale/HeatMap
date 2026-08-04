'use client';

import { useState } from 'react';
import type { ScoredCompany, ExposureLevel, CompanyDirection } from '@/types/company';

interface CompanyExposureListProps {
  companies: ScoredCompany[];
}

function exposureColor(level: ExposureLevel): string {
  switch (level) {
    case 'High':
      return 'bg-accent-red/20 text-accent-red border-accent-red/30';
    case 'Medium':
      return 'bg-accent-gold/20 text-accent-gold border-accent-gold/30';
    case 'Low':
    default:
      return 'bg-accent-blue/20 text-accent-blue border-accent-blue/30';
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-accent-red';
  if (score >= 40) return 'text-accent-gold';
  return 'text-accent-blue';
}

function directionColor(direction: CompanyDirection): string {
  if (direction === 'opportunity') return 'text-accent-green';
  if (direction === 'risk') return 'text-accent-red';
  return 'text-accent-gold';
}

function CompanyChip({ company }: { company: ScoredCompany }) {
  const [isOpen, setIsOpen] = useState(false);
  const isUp = (company.change ?? 0) > 0;
  const isDown = (company.change ?? 0) < 0;
  const changeClass = isUp ? 'text-accent-green' : isDown ? 'text-accent-red' : 'text-text-dim';

  return (
    <div className="flex-shrink-0 w-[160px]">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full text-left p-2 rounded bg-elevated/50 border border-border-subtle hover:border-border-default transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div className="text-[10px] text-white font-medium truncate">{company.name}</div>
            <div className="text-[9px] font-mono text-text-dim truncate">{company.symbol} • {company.sector}</div>
          </div>
          <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${exposureColor(company.exposureLevel)}`}>
            {company.exposureLevel}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className={`text-[9px] font-mono ${changeClass}`}>
            {company.change !== null && company.change !== undefined
              ? `${isUp ? '+' : ''}${company.change.toFixed(2)}%`
              : '—'}
          </div>
          <div className={`text-[9px] font-mono font-bold ${scoreColor(company.impactScore)}`}>
            {company.impactScore}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="mt-1.5 p-2 rounded bg-panel/60 border border-border-subtle">
          <div className={`text-[9px] font-mono font-bold mb-1 ${directionColor(company.direction)} uppercase`}>
            {company.direction}
          </div>
          <div className="text-[9px] text-white/80 leading-relaxed">{company.reason}</div>
          {company.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {company.tags.map((tag) => (
                <span key={tag} className="text-[8px] font-mono px-1 py-0.5 rounded bg-elevated text-text-dim">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompanyExposureList({ companies }: CompanyExposureListProps) {
  if (companies.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold tracking-wider text-text-dim">TOP AFFECTED COMPANIES</span>
        <span className="text-[9px] font-mono text-text-dim">Exposure level • Score</span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 pb-1">
        {companies.map((company) => (
          <CompanyChip key={company.symbol} company={company} />
        ))}
      </div>
    </div>
  );
}
