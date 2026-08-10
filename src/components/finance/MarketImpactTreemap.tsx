'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { buildMetricTreemapRects, MetricTreemapItem, FloatMetricTreemapTile } from '@/lib/gloomberb/treemap';
import type { MarketImpactItem } from '@/lib/gloomberb/types';

interface MarketImpactTreemapProps {
  items: MarketImpactItem[];
  width?: number;
  height?: number;
  className?: string;
}

function colorClassFromValue(value: number | null | undefined): string {
  if (value === 1) return 'text-accent-green';
  if (value === -1) return 'text-accent-red';
  return 'text-accent-gold';
}

function toTreemapItem(item: MarketImpactItem, index: number): MetricTreemapItem {
  return {
    id: item.id ?? `item-${index}`,
    label: item.primaryText ?? item.label ?? '—',
    weight: item.weight ?? 1,
    colorValue: item.colorValue,
    primaryText: item.primaryText,
    secondaryText: item.secondaryText,
    data: item,
  };
}

function TreemapLegend() {
  return (
    <div className="flex items-center justify-end gap-3 px-1 h-6 shrink-0">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-sm bg-accent-red" />
        <span className="text-[9px] font-mono text-text-dim">Risk</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-sm bg-accent-gold" />
        <span className="text-[9px] font-mono text-text-dim">Neutral</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-sm bg-accent-green" />
        <span className="text-[9px] font-mono text-text-dim">Opportunity</span>
      </div>
    </div>
  );
}

function renderTile(tile: FloatMetricTreemapTile<MarketImpactItem>) {
  const minDim = Math.min(tile.width, tile.height);
  const showLabel = minDim >= 24;
  const showValue = minDim >= 36;
  const colorClass = colorClassFromValue(tile.item.colorValue);

  const titleText = `${tile.item.primaryText ?? tile.item.label}${tile.item.secondaryText ? ` — ${tile.item.secondaryText}` : ''}`;

  return (
    <g key={tile.item.id} transform={`translate(${tile.x.toFixed(2)}, ${tile.y.toFixed(2)})`}>
      <title>{titleText}</title>
      <rect
        width={Math.max(0.5, tile.width).toFixed(2)}
        height={Math.max(0.5, tile.height).toFixed(2)}
        className={`fill-current ${colorClass}`}
        fillOpacity={0.85}
        stroke="var(--bg-void)"
        strokeWidth={1}
        rx={2}
      />
      {showLabel && (
        <text
          x={4}
          y={14}
          className="font-mono"
          fill="var(--text-primary)"
          fontSize={10}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {tile.item.primaryText ?? tile.item.label}
        </text>
      )}
      {showValue && tile.item.secondaryText && (
        <text
          x={4}
          y={26}
          className="font-mono"
          fill="var(--text-muted)"
          fontSize={9}
          style={{ pointerEvents: 'none' }}
        >
          {tile.item.secondaryText}
        </text>
      )}
    </g>
  );
}

export default function MarketImpactTreemap({
  items,
  width = 420,
  height = 220,
  className = '',
}: MarketImpactTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width, height });
  const legendHeight = 24;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          setSize({ width: cr.width, height: cr.height });
        }
      });
      ro.observe(el);
    } else {
      window.addEventListener('resize', updateSize);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', updateSize);
    };
  }, []);

  const svgWidth = Math.max(1, size.width);
  const svgHeight = Math.max(1, size.height - legendHeight);

  const rects = useMemo(() => {
    const treemapItems = items.map(toTreemapItem);
    return buildMetricTreemapRects(treemapItems, svgWidth, svgHeight);
  }, [items, svgWidth, svgHeight]);

  if (items.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`flex flex-col h-full ${className}`}
      >
        <TreemapLegend />
        <div className="flex-1 flex items-center justify-center bg-panel/50 rounded">
          <span className="text-[10px] font-mono text-white/40">No market impact data</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex flex-col h-full ${className}`}>
      <TreemapLegend />
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block"
      >
        {rects.map(renderTile)}
      </svg>
    </div>
  );
}
