'use client';

import { useEffect, useRef, useState } from 'react';

interface CountryRisk {
  code: string;
  name: string;
  risk: number;
  gdpGrowth: number | null;
  inflation: number | null;
  debtToGdp: number | null;
  flag: string;
  lat?: number;
  lng?: number;
}

interface EconomicGlobe3DProps {
  countries: Record<string, CountryRisk>;
  selectedCode?: string;
  onCountryClick?: (code: string) => void;
  height?: number;
}

// Country center coordinates (approximate)
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  us: { lat: 39.8, lng: -98.6 },
  cn: { lat: 35.9, lng: 104.2 },
  de: { lat: 51.2, lng: 10.5 },
  jp: { lat: 36.2, lng: 138.3 },
  in: { lat: 20.6, lng: 78.9 },
  gb: { lat: 55.4, lng: -3.4 },
  fr: { lat: 46.6, lng: 2.2 },
  br: { lat: -14.2, lng: -51.9 },
  it: { lat: 41.9, lng: 12.6 },
  ca: { lat: 56.1, lng: -106.3 },
  ru: { lat: 61.5, lng: 105.3 },
  kr: { lat: 35.9, lng: 127.8 },
  mx: { lat: 23.6, lng: -102.6 },
  au: { lat: -25.3, lng: 133.8 },
  es: { lat: 40.5, lng: -3.7 },
  id: { lat: -0.8, lng: 113.9 },
  sa: { lat: 23.9, lng: 45.1 },
  tr: { lat: 38.9, lng: 35.2 },
  tw: { lat: 23.7, lng: 121.0 },
  ar: { lat: -38.4, lng: -63.6 },
  za: { lat: -30.6, lng: 22.9 },
  ua: { lat: 49.0, lng: 31.4 },
  il: { lat: 31.0, lng: 34.9 },
  ir: { lat: 32.4, lng: 53.7 },
  ae: { lat: 23.4, lng: 53.8 },
  eg: { lat: 26.8, lng: 30.8 },
  vn: { lat: 14.1, lng: 108.3 },
  pl: { lat: 51.9, lng: 19.1 },
  ng: { lat: 9.1, lng: 8.7 },
  pk: { lat: 30.4, lng: 69.3 },
  bd: { lat: 23.7, lng: 90.4 },
};

function riskColor(risk: number): string {
  if (risk >= 70) return '#ef4444';
  if (risk >= 50) return '#f97316';
  if (risk >= 30) return '#eab308';
  return '#22c55e';
}

export default function EconomicGlobe3D({ countries, selectedCode, onCountryClick, height = 360 }: EconomicGlobe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Build markers from country data
  const markers = Object.entries(countries)
    .filter(([code]) => COUNTRY_COORDS[code])
    .map(([code, data]) => ({
      ...data,
      ...COUNTRY_COORDS[code],
      color: riskColor(data.risk),
    }));

  const selectedMarker = selectedCode ? markers.find(m => m.code === selectedCode) : null;

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    let resizeObs: ResizeObserver | null = null;

    const initGlobe = async () => {
      try {
        const GlobeModule = await import('globe.gl');
        const GlobeCtor = (GlobeModule.default || GlobeModule) as new (element: HTMLElement, configOptions?: any) => any;
        if (destroyed || !containerRef.current) return;

        const el = containerRef.current;
        const globe = new GlobeCtor(el);

        // Build bar marker data for each country — altitude = risk
        const barData = markers.map(m => ({
          ...m,
          lat: m.lat,
          lng: m.lng,
          altitude: 0.02 + (m.risk / 100) * 0.12,
          radius: 0.4,
          color: m.color,
        }));

        globe
          .width(el.clientWidth || 600)
          .height(height)
          .backgroundColor('rgba(0,0,0,0)')
          .globeImageUrl('/textures/earth-topo-bathy.jpg')
          .bumpImageUrl('/textures/earth-water.png')
          .backgroundImageUrl('/textures/night-sky.png')
          .atmosphereColor('#3b82f6')
          .atmosphereAltitude(0.12)
          // Bar markers for risk visualization (widely supported)
          .barData(barData)
          .barLat((d: any) => d.lat)
          .barLng((d: any) => d.lng)
          .barAltitude((d: any) => d.altitude)
          .barColor((d: any) => d.color)
          .barRadius((d: any) => d.radius)
          .barResolution(6)
          // HTML markers for flags
          .htmlElementsData(markers)
          .htmlLat((d: any) => d.lat)
          .htmlLng((d: any) => d.lng)
          .htmlAltitude(0.02)
          .htmlElement((d: any) => {
            const el = document.createElement('div');
            el.style.cssText = 'cursor:pointer;transform:translate(-50%,-50%);';
            const isSelected = selectedCode === d.code;
            el.innerHTML = `
              <div style="
                font-size:${isSelected ? '20px' : '14px'};
                filter:drop-shadow(0 0 ${isSelected ? '8px' : '4px'} ${d.color});
                transition:all 0.2s;
                opacity:${isSelected ? 1 : 0.85};
              "
              >${d.flag}</div>
            `;
            el.onclick = () => onCountryClick?.(d.code);
            return el;
          })
          // Labels
          .labelsData(markers)
          .labelLat((d: any) => d.lat)
          .labelLng((d: any) => d.lng)
          .labelText((d: any) => d.code.toUpperCase())
          .labelSize((d: any) => selectedCode === d.code ? 1.2 : 0.7)
          .labelColor((d: any) => d.color)
          .labelAltitude(0.05)
          .labelDotRadius((d: any) => selectedCode === d.code ? 0.4 : 0.2)
          .labelDotOrientation(() => 'bottom');

        globe.controls().autoRotate = autoRotate;
        globe.controls().autoRotateSpeed = 0.5;
        globe.controls().enableZoom = true;

        // Point to selected country or default view
        if (selectedMarker) {
          globe.pointOfView({ lat: selectedMarker.lat, lng: selectedMarker.lng, altitude: 1.8 }, 1000);
        } else {
          globe.pointOfView({ lat: 25, lng: 20, altitude: 2.5 }, 1000);
        }

        globeRef.current = globe;
        setIsLoaded(true);

        resizeObs = new ResizeObserver(e => {
          globe.width(e[0].contentRect.width).height(height);
        });
        resizeObs.observe(el);
      } catch (err: any) {
        console.error('[EconomicGlobe3D] Init error:', err);
        setError(err?.message || 'Failed to initialize 3D globe');
      }
    };

    // Delay init to ensure DOM is ready
    const timer = setTimeout(initGlobe, 100);
    return () => {
      destroyed = true;
      clearTimeout(timer);
      resizeObs?.disconnect();
    };
  }, []);

  // Update when selected country changes
  useEffect(() => {
    if (!globeRef.current || !isLoaded) return;

    try {
      // Update html elements (flags will resize)
      globeRef.current.htmlElementsData(markers);
      globeRef.current.labelsData(markers);

      // Fly to selected country
      if (selectedMarker) {
        globeRef.current.pointOfView({ lat: selectedMarker.lat, lng: selectedMarker.lng, altitude: 1.8 }, 1200);
      }
    } catch (err) {
      console.error('[EconomicGlobe3D] Update error:', err);
    }
  }, [selectedCode, isLoaded, markers]);

  // Toggle auto-rotate
  useEffect(() => {
    if (!globeRef.current || !isLoaded) return;
    try {
      globeRef.current.controls().autoRotate = autoRotate;
    } catch (err) {
      console.error('[EconomicGlobe3D] Rotate error:', err);
    }
  }, [autoRotate, isLoaded]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d0d14] overflow-hidden flex flex-col hover:border-white/10 transition-all duration-200" style={{ height }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-sm">🌐</span>
          <span className="font-mono text-[10px] font-bold tracking-wider text-white/80 uppercase">
            Economic Risk Globe
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400/30 border border-emerald-400/50" />Low
          </span>
          <span className="flex items-center gap-1 text-[9px] font-mono text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400/30 border border-yellow-400/50" />Med
          </span>
          <span className="flex items-center gap-1 text-[9px] font-mono text-orange-400">
            <span className="w-2 h-2 rounded-full bg-orange-400/30 border border-orange-400/50" />High
          </span>
          <span className="flex items-center gap-1 text-[9px] font-mono text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400/30 border border-rose-400/50" />Crit
          </span>
          <div className="w-px h-3 bg-white/10 mx-1" />
          <button
            onClick={() => setAutoRotate(p => !p)}
            className={`px-2 py-0.5 rounded-md text-[8px] font-mono border transition-all ${autoRotate ? 'bg-[#378ADD]/15 text-[#378ADD] border-[#378ADD]/25' : 'text-white/30 border-white/[0.06]'}`}
          >
            {autoRotate ? '⟳' : '⏸'}
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-[200px]">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {!isLoaded && !error && (
          <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[#378ADD] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-[10px] text-white/30 font-mono animate-pulse">Loading 3D Globe...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center z-10">
            <div className="text-center px-4">
              <span className="text-lg block mb-2">⚠️</span>
              <span className="text-[10px] text-rose-400 font-mono block mb-2">{error}</span>
              <span className="text-[8px] text-white/20 font-mono">Check browser console for details</span>
            </div>
          </div>
        )}

        {/* Selected country tooltip */}
        {selectedMarker && (
          <div className="absolute bottom-3 left-3 z-10 bg-black/80 border border-white/10 rounded-lg px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">{selectedMarker.flag}</span>
              <span className="font-mono text-[11px] text-white/80">{selectedMarker.name}</span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: selectedMarker.color + '20', color: selectedMarker.color, border: `1px solid ${selectedMarker.color}40` }}>
                Risk {selectedMarker.risk}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
