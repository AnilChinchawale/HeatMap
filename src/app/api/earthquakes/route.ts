import { NextResponse } from 'next/server';

interface Earthquake {
  id: string;
  magnitude: number;
  place: string;
  time: Date;
  lat: number;
  lon: number;
  depth: number;
  url: string;
}

// Cache
let cache: { earthquakes: Earthquake[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({ earthquakes: cache.earthquakes, cached: true });
    }

    // USGS API - earthquakes M4.0+ in past 24 hours
    const res = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json({ earthquakes: [], error: 'USGS API unavailable' });
    }

    const data = await res.json();
    interface USGSFeature {
      id: string;
      properties: {
        mag: number;
        place: string;
        time: number;
        url: string;
      };
      geometry: {
        coordinates: [number, number, number];
      };
    }

    const earthquakes: Earthquake[] = ((data.features || []) as USGSFeature[]).map((f) => ({
      id: f.id,
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: new Date(f.properties.time),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      url: f.properties.url,
    })).sort((a: Earthquake, b: Earthquake) => b.magnitude - a.magnitude);

    cache = { earthquakes, timestamp: Date.now() };
    return NextResponse.json({ earthquakes, cached: false });
  } catch (error) {
    console.error('Earthquakes API error:', error);
    return NextResponse.json({ earthquakes: [], error: 'Failed to fetch earthquakes' }, { status: 500 });
  }
}
