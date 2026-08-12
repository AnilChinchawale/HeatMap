'use client';

import { useState, useEffect } from 'react';
import { Tv, Maximize2, Minimize2, Volume2, VolumeX, ExternalLink, RefreshCw } from 'lucide-react';

// Hotspot regions with priority news sources
const HOTSPOT_STREAMS = [
  {
    id: 'mideast',
    name: 'MIDDLE EAST',
    region: 'Iran • Israel • Gaza',
    icon: '🔥',
    color: '#ff2244',
    channels: [
      { name: 'Al Jazeera', embedId: 'KyG6amQVSco', directUrl: 'https://www.aljazeera.com/live/' },
      { name: 'i24 News', embedId: 'vgGnQC5aLdg', directUrl: 'https://www.i24news.tv/en/tv/live' },
    ]
  },
  {
    id: 'ukraine',
    name: 'UKRAINE',
    region: 'Eastern Front',
    icon: '🇺🇦',
    color: '#0057b7',
    channels: [
      { name: 'Sky News', embedId: 'NygUCOEHrF8', directUrl: 'https://news.sky.com/watch-live' },
      { name: 'DW News', embedId: 'pYFyp0aYPHw', directUrl: 'https://www.dw.com/en/live-tv/s-100825' },
    ]
  },
  {
    id: 'asia',
    name: 'ASIA-PACIFIC',
    region: 'Taiwan • Korea',
    icon: '🌏',
    color: '#00aaff',
    channels: [
      { name: 'NHK World', embedId: 'f0lYkdA-Gtw', directUrl: 'https://www3.nhk.or.jp/nhkworld/en/live/' },
      { name: 'CGTN', embedId: 'sU8jxDU0eFw', directUrl: 'https://www.cgtn.com/live' },
    ]
  },
  {
    id: 'global',
    name: 'GLOBAL',
    region: 'World News',
    icon: '🌍',
    color: '#00ff88',
    channels: [
      { name: 'France 24', embedId: 'u9foWyMSrrQ', directUrl: 'https://www.france24.com/en/live' },
      { name: 'BBC', embedId: 'siyW0GOBtbo', directUrl: 'https://www.bbc.com/news/live' },
    ]
  }
];

interface StreamProps {
  hotspot: typeof HOTSPOT_STREAMS[0];
  channelIndex: number;
  isMuted: boolean;
  isExpanded: boolean;
  onExpand: () => void;
}

function StreamPlayer({ hotspot, channelIndex, isMuted, isExpanded, onExpand }: StreamProps) {
  const channel = hotspot.channels[channelIndex] || hotspot.channels[0];
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Use HLS streams when available (more reliable than YouTube embeds)
  const HLS_STREAMS: Record<string, string> = {
    'KyG6amQVSco': 'https://live-hls-web-aje.getaj.net/AJE/01.m3u8',
    'u9foWyMSrrQ': 'https://stream.france24.com/live/en.m3u8',
    'pYFyp0aYPHw': 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8',
    'NygUCOEHrF8': 'https://linear401-gb-hls1-prd-ak.cdn.skycdp.com/100e/Content/HLS_001_1080_30/Live/channel(skynews)/index.m3u8',
    'f0lYkdA-Gtw': 'https://nhkworld.webcdn.stream.ne.jp/www11/nhkworld-tv/domestic/263942/live.m3u8',
  };

  const hlsUrl = HLS_STREAMS[channel.embedId];
  const embedUrl = hlsUrl
    ? undefined
    : `https://www.youtube.com/embed/${channel.embedId}?autoplay=1&mute=${isMuted ? 1 : 0}&rel=0&modestbranding=1&playsinline=1&controls=0&enablejsapi=1`;

  return (
    <div className={`relative bg-black rounded overflow-hidden ${isExpanded ? 'col-span-2 row-span-2' : ''}`}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{hotspot.icon}</span>
            <div>
              <div className="text-[9px] font-bold text-white">{hotspot.name}</div>
              <div className="text-[8px] text-gray-400">{channel.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span 
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: hotspot.color }}
            />
            <span className="text-[8px] text-white">LIVE</span>
          </div>
        </div>
      </div>

      {/* Video */}
      {hasError ? (
        <div className="aspect-video flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="text-[10px] text-gray-400 mb-2">Stream unavailable</div>
            <a 
              href={channel.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-cyan-400 hover:underline flex items-center gap-1 justify-center"
            >
              <ExternalLink className="w-3 h-3" /> Watch on site
            </a>
          </div>
        </div>
      ) : (
        <div className="aspect-video relative">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <RefreshCw className="w-5 h-5 text-white/50 animate-spin" />
            </div>
          )}
          {hlsUrl ? (
            <video
              src={hlsUrl}
              className="w-full h-full"
              autoPlay
              muted={isMuted}
              playsInline
              controls={false}
              onLoadedData={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
            />
          ) : (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setIsLoaded(true)}
              onError={() => setHasError(true)}
            />
          )}
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-gray-400">{hotspot.region}</span>
          <div className="flex items-center gap-1">
            <a
              href={channel.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-white/20 rounded"
            >
              <ExternalLink className="w-3 h-3 text-white" />
            </a>
            <button onClick={onExpand} className="p-1 hover:bg-white/20 rounded">
              {isExpanded ? <Minimize2 className="w-3 h-3 text-white" /> : <Maximize2 className="w-3 h-3 text-white" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HotspotStreams() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [channelIndices, setChannelIndices] = useState<Record<string, number>>({
    mideast: 0,
    ukraine: 0,
    asia: 0,
    global: 0
  });

  // Cycle through channels for each hotspot
  const cycleChannel = (hotspotId: string) => {
    setChannelIndices(prev => ({
      ...prev,
      [hotspotId]: (prev[hotspotId] + 1) % 2
    }));
  };

  return (
    <div className="glass-panel overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 border-b border-border-subtle bg-gradient-to-r from-red-500/10 to-transparent flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-accent-red" />
          <span className="font-mono text-[11px] font-bold tracking-wider text-white">HOTSPOT STREAMS</span>
          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-accent-red/20 text-accent-red">
            <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
            4 LIVE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
            className={`p-1 rounded ${isMuted ? 'text-gray-500' : 'text-white bg-white/10'}`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-2">
          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-1">
            {HOTSPOT_STREAMS.map(hotspot => (
              <StreamPlayer
                key={hotspot.id}
                hotspot={hotspot}
                channelIndex={channelIndices[hotspot.id]}
                isMuted={isMuted}
                isExpanded={expandedStream === hotspot.id}
                onExpand={() => setExpandedStream(expandedStream === hotspot.id ? null : hotspot.id)}
              />
            ))}
          </div>

    

          {/* Quick links */}
          <div className="flex items-center justify-center gap-3 mt-2 text-[8px]">
            <a href="https://www.aljazeera.com/live/" target="_blank" className="text-gray-500 hover:text-white">AJE</a>
            <a href="https://www.i24news.tv/en/tv/live" target="_blank" className="text-gray-500 hover:text-white">i24</a>
            <a href="https://news.sky.com/watch-live" target="_blank" className="text-gray-500 hover:text-white">SKY</a>
            <a href="https://www.france24.com/en/live" target="_blank" className="text-gray-500 hover:text-white">F24</a>
          </div>
        </div>
      )}
    </div>
  );
}
