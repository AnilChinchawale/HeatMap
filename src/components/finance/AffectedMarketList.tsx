'use client';

import type { FinanceIndex, FinanceCommodity, FinanceForex, FinanceCrypto } from '@/types/finance';

interface AffectedMarketListProps {
  indices: (FinanceIndex & { impactScore: number })[];
  commodities: (FinanceCommodity & { impactScore: number })[];
  forex: (FinanceForex & { impactScore: number })[];
  crypto: (FinanceCrypto & { impactScore: number })[];
}

function MarketChip<T extends { symbol: string; display?: string; price?: number | null; change?: number | null; impactScore: number }>({
  item,
}: { item: T }) {
  const isUp = (item.change ?? 0) > 0;
  const isDown = (item.change ?? 0) < 0;
  const changeColor = isUp ? 'text-accent-green' : isDown ? 'text-accent-red' : 'text-accent-gold';
  const scoreColor = item.impactScore >= 70 ? 'bg-accent-red/20 text-accent-red' : item.impactScore >= 40 ? 'bg-accent-gold/20 text-accent-gold' : 'bg-accent-blue/20 text-accent-blue';

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-elevated/50 border border-border-subtle hover:border-border-default transition-colors min-w-[110px]">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-white font-medium truncate">{item.display ?? item.symbol}</div>
        <div className={`text-[9px] font-mono ${changeColor}`}>
          {item.change !== null && item.change !== undefined
            ? `${isUp ? '+' : ''}${item.change.toFixed(2)}%`
            : '—'}
        </div>
      </div>
      <div className={`text-[9px] font-mono px-1 py-0.5 rounded ${scoreColor}`}>{item.impactScore.toFixed(0)}</div>
    </div>
  );
}

function CategoryRow<T extends { symbol: string; display?: string; price?: number | null; change?: number | null; impactScore: number }>({
  title,
  icon,
  items,
}: { title: string; icon: string; items: T[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs">{icon}</span>
        <span className="text-[9px] font-mono font-bold tracking-wider text-text-dim">{title}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 pb-1">
        {items.map((item) => (
          <MarketChip key={item.symbol} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function AffectedMarketList({
  indices,
  commodities,
  forex,
  crypto,
}: AffectedMarketListProps) {
  return (
    <div className="space-y-3">
      <CategoryRow title="INDICES" icon="🏦" items={indices} />
      <CategoryRow title="COMMODITIES" icon="🛢️" items={commodities} />
      <CategoryRow title="FOREX" icon="💱" items={forex} />
      <CategoryRow title="CRYPTO" icon="₿" items={crypto} />
    </div>
  );
}
