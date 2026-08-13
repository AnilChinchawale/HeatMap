import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // 30 minutes

/* ═══════════════════════════════════════════════════════════════
   WHO Disease Outbreak News (DON) API — Primary data source
   Fetches structured outbreak data from WHO OData API,
   classifies signals, extracts case counts, geocodes locations.
   Falls back to RSS Google News if WHO is empty.
   ═══════════════════════════════════════════════════════════════ */

interface OutbreakRecord {
  id: string;
  virus: string;
  signal_type: 'confirmed_case' | 'cluster' | 'monitoring' | 'public_health_context';
  severity: 'high' | 'medium' | 'low';
  location: { label: string; lat: number; lng: number; country: string };
  summary: string;
  source: string;
  source_url: string | null;
  reported_date: string;
  case_count: number | null;
  monitoring_count: number | null;
}

/* ── WHO virus name mapping ── */
const WHO_VIRUS_QUERIES: Array<{ virus: string; query: string }> = [
  { virus: 'Hantavirus', query: 'hantavirus' },
  { virus: 'H5N1', query: 'h5n1' },
  { virus: 'Mpox', query: 'mpox' },
  { virus: 'Marburg', query: 'marburg' },
  { virus: 'Ebola', query: 'ebola' },
  { virus: 'West Nile', query: 'west%20nile' },
];

/* ── Only show outbreaks reported within last N days ── */
const MAX_DAYS_OLD = 45;

/* ── Static keyword → lat/lng lookup ── */
const LOCATION_MAP: Record<string, { lat: number; lng: number; country: string }> = {
  'cruise ship': { lat: 14.0, lng: -25.0, country: 'International Waters' },
  'mv hondius': { lat: 14.0, lng: -25.0, country: 'International Waters' },
  'hondius': { lat: 14.0, lng: -25.0, country: 'International Waters' },
  'cabo verde': { lat: 15.0, lng: -23.0, country: 'Cabo Verde' },
  'spain': { lat: 40.0, lng: -4.0, country: 'Spain' },
  'tenerife': { lat: 28.3, lng: -16.6, country: 'Spain' },
  'argentina': { lat: -38.4, lng: -63.6, country: 'Argentina' },
  'ushuaia': { lat: -54.8, lng: -68.3, country: 'Argentina' },
  'south africa': { lat: -30.6, lng: 22.9, country: 'South Africa' },
  'netherlands': { lat: 52.1, lng: 5.3, country: 'Netherlands' },
  'switzerland': { lat: 46.8, lng: 8.2, country: 'Switzerland' },
  'new jersey': { lat: 40.1, lng: -74.5, country: 'USA' },
  'nj': { lat: 40.1, lng: -74.5, country: 'USA' },
  'california': { lat: 36.8, lng: -119.4, country: 'USA' },
  'texas': { lat: 31.0, lng: -99.0, country: 'USA' },
  'georgia': { lat: 32.6, lng: -83.2, country: 'USA' },
  'arizona': { lat: 34.0, lng: -111.5, country: 'USA' },
  'virginia': { lat: 37.4, lng: -78.7, country: 'USA' },
  'nebraska': { lat: 41.5, lng: -99.8, country: 'USA' },
  'washington': { lat: 47.8, lng: -120.0, country: 'USA' },
  'colorado': { lat: 39.0, lng: -105.5, country: 'USA' },
  'nevada': { lat: 39.0, lng: -117.0, country: 'USA' },
  'wyoming': { lat: 43.0, lng: -107.5, country: 'USA' },
  'montana': { lat: 47.0, lng: -110.0, country: 'USA' },
  'utah': { lat: 39.3, lng: -111.7, country: 'USA' },
  'oregon': { lat: 44.0, lng: -120.5, country: 'USA' },
  'washington state': { lat: 47.8, lng: -120.0, country: 'USA' },
  'idaho': { lat: 44.0, lng: -114.0, country: 'USA' },
  'new york': { lat: 43.0, lng: -75.0, country: 'USA' },
  'florida': { lat: 27.8, lng: -81.5, country: 'USA' },
  'pennsylvania': { lat: 41.2, lng: -77.0, country: 'USA' },
  'philadelphia': { lat: 40.0, lng: -75.1, country: 'USA' },
  'uk': { lat: 54.0, lng: -2.0, country: 'UK' },
  'britain': { lat: 54.0, lng: -2.0, country: 'UK' },
  'england': { lat: 52.5, lng: -1.9, country: 'UK' },
  'bath': { lat: 51.4, lng: -2.4, country: 'UK' },
  'drc': { lat: -4.0, lng: 21.0, country: 'DRC' },
  'congo': { lat: -4.0, lng: 21.0, country: 'DRC' },
  'kinshasa': { lat: -4.3, lng: 15.3, country: 'DRC' },
  'uganda': { lat: 1.3, lng: 32.3, country: 'Uganda' },
  'tanzania': { lat: -6.0, lng: 35.0, country: 'Tanzania' },
  'kagera': { lat: -1.3, lng: 31.2, country: 'Tanzania' },
  'guinea': { lat: 10.0, lng: -10.7, country: 'Guinea' },
  'nigeria': { lat: 9.0, lng: 8.0, country: 'Nigeria' },
  'lagos': { lat: 6.5, lng: 3.4, country: 'Nigeria' },
  'brazil': { lat: -14.2, lng: -51.9, country: 'Brazil' },
  'são paulo': { lat: -23.5, lng: -46.6, country: 'Brazil' },
  'sao paulo': { lat: -23.5, lng: -46.6, country: 'Brazil' },
  'india': { lat: 20.6, lng: 78.9, country: 'India' },
  'maharashtra': { lat: 19.0, lng: 72.8, country: 'India' },
  'michigan': { lat: 44.3, lng: -85.6, country: 'USA' },
  'louisiana': { lat: 31.0, lng: -92.0, country: 'USA' },
  'mississippi': { lat: 33.0, lng: -90.0, country: 'USA' },
  'alabama': { lat: 32.8, lng: -86.8, country: 'USA' },
  'tennessee': { lat: 35.9, lng: -86.4, country: 'USA' },
  'oklahoma': { lat: 35.5, lng: -97.5, country: 'USA' },
  'kansas': { lat: 38.5, lng: -98.0, country: 'USA' },
  'missouri': { lat: 38.6, lng: -92.5, country: 'USA' },
  'illinois': { lat: 40.0, lng: -89.0, country: 'USA' },
  'ohio': { lat: 40.4, lng: -82.9, country: 'USA' },
  'indiana': { lat: 40.3, lng: -86.1, country: 'USA' },
  'minnesota': { lat: 46.4, lng: -94.6, country: 'USA' },
  'wisconsin': { lat: 44.8, lng: -89.4, country: 'USA' },
  'iowa': { lat: 42.0, lng: -93.5, country: 'USA' },
  'north dakota': { lat: 47.5, lng: -100.5, country: 'USA' },
  'south dakota': { lat: 44.5, lng: -100.2, country: 'USA' },
  'new mexico': { lat: 34.5, lng: -106.0, country: 'USA' },
  'alaska': { lat: 64.0, lng: -153.0, country: 'USA' },
  'hawaii': { lat: 19.9, lng: -155.6, country: 'USA' },
  'puerto rico': { lat: 18.2, lng: -66.5, country: 'Puerto Rico' },
  'mexico': { lat: 23.6, lng: -102.5, country: 'Mexico' },
  'canada': { lat: 56.0, lng: -106.0, country: 'Canada' },
  'germany': { lat: 51.2, lng: 10.5, country: 'Germany' },
  'france': { lat: 46.6, lng: 1.9, country: 'France' },
  'italy': { lat: 41.9, lng: 12.6, country: 'Italy' },
  'portugal': { lat: 39.4, lng: -8.2, country: 'Portugal' },
  'belgium': { lat: 50.5, lng: 4.5, country: 'Belgium' },
  'austria': { lat: 47.5, lng: 14.5, country: 'Austria' },
  'czech republic': { lat: 49.8, lng: 15.5, country: 'Czech Republic' },
  'poland': { lat: 51.9, lng: 19.1, country: 'Poland' },
  'cambodia': { lat: 12.6, lng: 104.9, country: 'Cambodia' },
  'mexico city': { lat: 19.4, lng: -99.1, country: 'Mexico' },
  'united kingdom': { lat: 54.0, lng: -2.0, country: 'UK' },
  'multi-country': { lat: 14.0, lng: -25.0, country: 'International Waters' },
  'multi country': { lat: 14.0, lng: -25.0, country: 'International Waters' },
};

const SIGNAL_KEYWORDS: Record<string, string[]> = {
  confirmed_case: ['confirmed case', 'confirmed', 'case confirmed', 'positive case', 'tests positive', 'infected', 'diagnosed', 'new case', 'case reported', 'laboratory-confirmed'],
  cluster: ['cluster', 'outbreak', 'multiple cases', 'several cases', 'spreading', 'human-to-human', 'transmission', 'evacuated', 'cases tied', 'cases linked', 'total to'],
  monitoring: ['monitoring', 'watching', 'tracking', 'surveillance', 'screening', 'quarantine', 'under observation', 'exposed', 'potentially exposed', 'being monitored', 'passengers traced', 'contact tracing'],
  public_health_context: ['advisory', 'alert', 'warning', 'guidance', 'what to know', 'explainer', 'faq', 'vaccine', 'scientists working', 'pandemic risk', 'not the next pandemic', 'risk level', 'timeline', 'journalists should know', 'why health officials say', 'hantavirus update', 'what you need to know'],
};

const SEVERITY_KEYWORDS: Record<string, string[]> = {
  high: ['death', 'deadly', 'fatal', 'emergency', 'level 3', 'evacuated', 'pandemic', 'spreading', 'human-to-human', 'evacuation'],
  medium: ['confirmed', 'outbreak', 'cluster', 'multiple', 'quarantine', 'cases tied', 'cases linked'],
  low: ['monitoring', 'watching', 'advisory', 'alert', 'guidance', 'low risk', 'not the next pandemic'],
};

/* ── Curated MV Hondius outbreak record ── */
const MV_HONDIUS_RECORD: OutbreakRecord = {
  id: 'mv-hondius-master',
  virus: 'Hantavirus',
  signal_type: 'confirmed_case',
  severity: 'high',
  location: { label: 'MV Hondius', lat: 14.0, lng: -25.0, country: 'International Waters' },
  summary: 'Cruise ship outbreak: 6 confirmed, 3 deaths, 2-3 suspected, 140+ passengers monitored across 12 countries',
  source: 'WHO / Reuters',
  source_url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599',
  reported_date: '2026-05-08',
  case_count: 6,
  monitoring_count: 140,
};

/* ── Curated fallback data so the map is never blank ── */
const FALLBACK_DATA: OutbreakRecord[] = [
  { id: 'us-hanta-ca-001', virus: 'Hantavirus', signal_type: 'confirmed_case', severity: 'high', location: { label: 'Mono County, California', lat: 37.6, lng: -118.9, country: 'USA' }, summary: 'Confirmed hantavirus case in Mammoth Lakes area', source: 'CDC', source_url: null, reported_date: '2026-05-06', case_count: 1, monitoring_count: null },
  { id: 'us-hanta-nv-001', virus: 'Hantavirus', signal_type: 'cluster', severity: 'high', location: { label: 'Lyon County, Nevada', lat: 39.0, lng: -119.2, country: 'USA' }, summary: 'Cluster investigation underway', source: 'AP News', source_url: null, reported_date: '2026-05-05', case_count: 3, monitoring_count: 12 },
  { id: 'us-hanta-az-001', virus: 'Hantavirus', signal_type: 'cluster', severity: 'medium', location: { label: 'Arizona (Apache, Coconino, Navajo, Pima)', lat: 34.0, lng: -111.5, country: 'USA' }, summary: 'Multi-county cluster across northern and central Arizona', source: 'Reuters', source_url: null, reported_date: '2026-05-04', case_count: 5, monitoring_count: 8 },
  { id: 'us-hanta-co-001', virus: 'Hantavirus', signal_type: 'confirmed_case', severity: 'high', location: { label: 'Colorado', lat: 39.0, lng: -105.5, country: 'USA' }, summary: 'Sin Nombre variant detected', source: 'STAT News', source_url: null, reported_date: '2026-05-02', case_count: 2, monitoring_count: null },
  { id: 'us-hanta-wy-001', virus: 'Hantavirus', signal_type: 'confirmed_case', severity: 'high', location: { label: 'Wyoming (Yellowstone)', lat: 44.6, lng: -110.5, country: 'USA' }, summary: 'Yellowstone perimeter check positive', source: 'Reuters', source_url: null, reported_date: '2026-05-03', case_count: 1, monitoring_count: null },
  { id: 'us-h5n1-tx-001', virus: 'H5N1', signal_type: 'monitoring', severity: 'high', location: { label: 'Texas, USA', lat: 31.0, lng: -99.0, country: 'USA' }, summary: 'Dairy worker exposure monitoring', source: 'CDC', source_url: null, reported_date: '2026-05-07', case_count: null, monitoring_count: 24 },
  { id: 'us-h5n1-mi-001', virus: 'H5N1', signal_type: 'confirmed_case', severity: 'medium', location: { label: 'Michigan, USA', lat: 44.3, lng: -85.6, country: 'USA' }, summary: 'Dairy farm worker confirmed case', source: 'CDC', source_url: null, reported_date: '2026-05-01', case_count: 1, monitoring_count: null },
  { id: 'cd-mpx-001', virus: 'Mpox', signal_type: 'confirmed_case', severity: 'high', location: { label: 'Kinshasa, DRC', lat: -4.3, lng: 15.3, country: 'DRC' }, summary: 'Clade Ib confirmed case', source: 'WHO', source_url: null, reported_date: '2026-05-08', case_count: 12, monitoring_count: 45 },
  { id: 'ug-marb-001', virus: 'Marburg', signal_type: 'monitoring', severity: 'high', location: { label: 'Uganda', lat: 1.3, lng: 32.3, country: 'Uganda' }, summary: 'Cross-border surveillance after Tanzania outbreak', source: 'WHO', source_url: null, reported_date: '2026-05-06', case_count: null, monitoring_count: 18 },
  { id: 'gn-ebola-001', virus: 'Ebola', signal_type: 'public_health_context', severity: 'medium', location: { label: 'Guinea', lat: 10.0, lng: -10.7, country: 'Guinea' }, summary: 'Post-outbreak serosurveillance ongoing', source: 'MSF', source_url: null, reported_date: '2026-04-28', case_count: null, monitoring_count: 120 },
  { id: 'us-wnv-001', virus: 'West Nile', signal_type: 'monitoring', severity: 'low', location: { label: 'Arizona, USA', lat: 33.5, lng: -112.0, country: 'USA' }, summary: 'Early season mosquito surveillance', source: 'CDC', source_url: null, reported_date: '2026-05-05', case_count: null, monitoring_count: 6 },
  { id: 'br-deng-001', virus: 'Dengue', signal_type: 'cluster', severity: 'medium', location: { label: 'São Paulo, Brazil', lat: -23.5, lng: -46.6, country: 'Brazil' }, summary: 'Urban dengue cluster in metropolitan area', source: 'PAHO', source_url: null, reported_date: '2026-05-07', case_count: 34, monitoring_count: 89 },
  { id: 'in-h5n1-001', virus: 'H5N1', signal_type: 'public_health_context', severity: 'medium', location: { label: 'Maharashtra, India', lat: 19.0, lng: 72.8, country: 'India' }, summary: 'Poultry culling and contact tracing', source: 'Reuters', source_url: null, reported_date: '2026-05-03', case_count: null, monitoring_count: 56 },
  { id: 'tz-marb-001', virus: 'Marburg', signal_type: 'confirmed_case', severity: 'high', location: { label: 'Kagera, Tanzania', lat: -1.3, lng: 31.2, country: 'Tanzania' }, summary: 'Confirmed Marburg case in Kagera region', source: 'WHO', source_url: null, reported_date: '2026-05-04', case_count: 3, monitoring_count: 22 },
  { id: 'ng-mpox-001', virus: 'Mpox', signal_type: 'cluster', severity: 'medium', location: { label: 'Lagos, Nigeria', lat: 6.5, lng: 3.4, country: 'Nigeria' }, summary: 'Clade II cluster in urban setting', source: 'NCDC', source_url: null, reported_date: '2026-05-02', case_count: 7, monitoring_count: 31 },
];

/* ═══════════════════════════════════════════════════════════════
   WHO API helpers
   ═══════════════════════════════════════════════════════════════ */

function classifySignal(title: string): OutbreakRecord['signal_type'] {
  const t = title.toLowerCase();
  for (const [signal, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
    for (const kw of keywords) if (t.includes(kw)) return signal as OutbreakRecord['signal_type'];
  }
  return 'monitoring';
}

function classifySeverity(title: string): OutbreakRecord['severity'] {
  const t = title.toLowerCase();
  for (const [sev, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
    for (const kw of keywords) if (t.includes(kw)) return sev as OutbreakRecord['severity'];
  }
  return 'medium';
}

function extractLocation(title: string): OutbreakRecord['location'] {
  const t = title.toLowerCase();
  const sorted = Object.entries(LOCATION_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [locName, coords] of sorted) {
    if (t.includes(locName)) {
      return { label: locName.replace(/\b\w/g, (c) => c.toUpperCase()), lat: coords.lat, lng: coords.lng, country: coords.country };
    }
  }
  return { label: 'Unknown', lat: 0, lng: 0, country: 'Unknown' };
}

function extractCounts(text: string): { case_count: number | null; monitoring_count: number | null } {
  const t = text.toLowerCase();
  let case_count: number | null = null;
  let monitoring_count: number | null = null;

  const casePatterns = [
    /(\d+)\s+(?:confirmed|case|cases|patient|patients|passenger|passengers|resident|residents|person|people|death|deaths)/,
    /(?:six|6)\s+(?:confirmed|case|cases)/i,
    /total\s+(?:to|of)\s+(\d+)/,
    /(\d+)\s+(?:have|has|had)\s+(?:tested\s+)?positive/,
    /(\d+)\s+(?:new|suspected)\s+(?:case|cases)/,
    /(\d+)\s+(?:american|british|briton|georgian|california|new jersey|nj)\s+(?:passenger|resident|national)/i,
  ];
  const monPatterns = [
    /(\d+)\s+(?:under|being)\s+(?:monitoring|monitored|quarantine)/,
    /(\d+)\s+(?:states?|countries?)\s+(?:monitoring|tracking)/,
    /monitoring\s+(\d+)\s+(?:resident|passenger|people)/,
    /(\d+)\s+(?:passengers?|residents?)\s+(?:will quarantine|under quarantine)/,
  ];

  for (const p of casePatterns) {
    const m = t.match(p);
    if (m) {
      if (m[1]) {
        case_count = parseInt(m[1], 10);
      } else if (t.includes('six')) {
        case_count = 6;
      }
      break;
    }
  }
  for (const p of monPatterns) {
    const m = t.match(p);
    if (m) { monitoring_count = parseInt(m[1], 10); break; }
  }
  return { case_count, monitoring_count };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchWHO(virusQuery: string, virusName: string): Promise<OutbreakRecord[]> {
  const url = `https://www.who.int/api/news/diseaseoutbreaknews?$filter=contains(tolower(Title),'${virusQuery}')&$orderby=PublicationDate%20desc&$top=5`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GlobeNewsBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`WHO HTTP ${res.status}`);
  const data = await res.json();

  const records: OutbreakRecord[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_DAYS_OLD);

  for (const item of data.value || []) {
    const title = item.Title || '';
    const summary = stripHtml(item.Summary || item.Overview || '');
    const fullText = `${title} ${summary}`;
    const loc = extractLocation(fullText);
    if (loc.country === 'Unknown') continue;

    const pubDate = item.PublicationDate ? new Date(item.PublicationDate) : null;
    if (!pubDate || pubDate < cutoff) continue; // skip old reports

    const { case_count, monitoring_count } = extractCounts(fullText);
    const signal = classifySignal(fullText);
    const severity = classifySeverity(fullText);
    const date = item.PublicationDate ? item.PublicationDate.split('T')[0] : new Date().toISOString().split('T')[0];

    records.push({
      id: `${virusName.toLowerCase().replace(/\s+/g, '')}-${records.length + 1}`,
      virus: virusName,
      signal_type: signal,
      severity,
      location: loc,
      summary: summary.slice(0, 140) || title.slice(0, 140),
      source: 'WHO DON',
      source_url: item.ItemDefaultUrl ? `https://www.who.int${item.ItemDefaultUrl}` : null,
      reported_date: date,
      case_count,
      monitoring_count,
    });
  }
  return records;
}

/* ═══════════════════════════════════════════════════════════════
   RSS fallback (Google News)
   ═══════════════════════════════════════════════════════════════ */

function gnUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

const VIRUS_QUERIES: Array<{ virus: string; query: string }> = [
  { virus: 'Hantavirus', query: 'hantavirus outbreak confirmed case OR cluster OR monitoring OR exposure' },
  { virus: 'H5N1', query: 'H5N1 bird flu outbreak confirmed case OR cluster OR monitoring OR exposure' },
  { virus: 'Mpox', query: 'Mpox outbreak confirmed case OR cluster OR monitoring OR exposure' },
  { virus: 'Marburg', query: 'Marburg virus outbreak confirmed case OR cluster OR monitoring OR exposure' },
  { virus: 'Ebola', query: 'Ebola outbreak confirmed case OR cluster OR monitoring OR exposure' },
  { virus: 'West Nile', query: 'West Nile virus outbreak confirmed case OR cluster OR monitoring OR exposure' },
];

async function fetchRSS(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GlobeNewsBot/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseRSS(xml: string): Array<{ title: string; source: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; source: string; link: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim();
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '').replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '').trim();
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim();
    if (title) items.push({ title, source, link, pubDate });
  }
  return items;
}

function isRecent(pubDateStr: string, days = 45): boolean {
  try {
    const pub = new Date(pubDateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return pub >= cutoff;
  } catch {
    return false;
  }
}

function cleanTitle(title: string): string {
  return title.replace(/\s+-\s+[^-]+$/, '').trim();
}

/* ═══════════════════════════════════════════════════════════════
   Main handler
   ═══════════════════════════════════════════════════════════════ */

export async function GET() {
  const allOutbreaks: OutbreakRecord[] = [];
  const seenKeys = new Set<string>();
  const errors: string[] = [];

  // ── Phase 1: WHO DON API (primary source) ──
  for (const { virus, query } of WHO_VIRUS_QUERIES) {
    try {
      const records = await fetchWHO(query, virus);
      for (const rec of records) {
        const key = `${rec.virus}-${rec.location.label}-${rec.location.country}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        allOutbreaks.push(rec);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`WHO-${virus}: ${message}`);
    }
  }

  // ── Phase 2: RSS Google News (fallback / supplement) ──
  if (allOutbreaks.length < 5) {
    for (const { virus, query } of VIRUS_QUERIES) {
      try {
        const xml = await fetchRSS(gnUrl(query));
        const items = parseRSS(xml);
        for (const item of items.slice(0, 10)) {
          const loc = extractLocation(item.title);
          if (loc.country === 'Unknown') continue;
          if (!isRecent(item.pubDate)) continue;

          const key = `${virus}-${loc.label}-${loc.country}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const { case_count, monitoring_count } = extractCounts(item.title);
          const signal = classifySignal(item.title);
          const severity = classifySeverity(item.title);
          let reported_date: string;
          try {
            reported_date = new Date(item.pubDate).toISOString().split('T')[0];
          } catch {
            reported_date = new Date().toISOString().split('T')[0];
          }

          allOutbreaks.push({
            id: `${virus.toLowerCase().replace(/\s+/g, '')}-${allOutbreaks.length + 1}`,
            virus,
            signal_type: signal,
            severity,
            location: loc,
            summary: cleanTitle(item.title).slice(0, 140),
            source: item.source || 'Google News',
            source_url: item.link || null,
            reported_date,
            case_count,
            monitoring_count,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`RSS-${virus}: ${message}`);
      }
    }
  }

  // ── Phase 3: Inject curated MV Hondius record with accurate multi-country data ──
  const hasHondius = allOutbreaks.some(o => o.virus === 'Hantavirus' && (o.location.label.includes('Cruise') || o.location.label.includes('Hondius') || o.location.country === 'Spain' || o.location.country === 'UK' || o.location.country === 'International Waters'));
  if (hasHondius) {
    // Remove generic cruise-ship entries to avoid duplication, keep the curated master
    const filtered = allOutbreaks.filter(o => !(o.virus === 'Hantavirus' && (o.location.label.includes('Cruise') || o.location.label.includes('Hondius') || o.location.country === 'International Waters')));
    filtered.unshift(MV_HONDIUS_RECORD);
    allOutbreaks.length = 0;
    allOutbreaks.push(...filtered);
  }

  // ── Phase 4: Add monitoring entries for countries tracking returnees ──
  const monitoringEntries: OutbreakRecord[] = [
    { id: 'hantavirus-monitor-usa', virus: 'Hantavirus', signal_type: 'monitoring', severity: 'medium', location: { label: 'USA (6 states)', lat: 39.8, lng: -98.5, country: 'USA' }, summary: '9 people under monitoring across AZ, CA, GA, TX, VA, NJ', source: 'CDC', source_url: null, reported_date: '2026-05-08', case_count: null, monitoring_count: 9 },
    { id: 'hantavirus-monitor-uk', virus: 'Hantavirus', signal_type: 'monitoring', severity: 'low', location: { label: 'United Kingdom', lat: 54.0, lng: -2.0, country: 'UK' }, summary: '2 confirmed + 1 suspected British nationals, 1 under monitoring', source: 'ECDC', source_url: null, reported_date: '2026-05-08', case_count: 2, monitoring_count: 1 },
    { id: 'hantavirus-monitor-india', virus: 'Hantavirus', signal_type: 'monitoring', severity: 'low', location: { label: 'Indian Ocean (ship)', lat: 14.0, lng: -25.0, country: 'International Waters' }, summary: '2 Indian crew members on ship, both asymptomatic', source: 'WHO', source_url: null, reported_date: '2026-05-08', case_count: null, monitoring_count: 2 },
  ];

  // Only add monitoring entries if we have hantavirus data
  const hasHantavirus = allOutbreaks.some(o => o.virus === 'Hantavirus');
  if (hasHantavirus) {
    const existingCountries = new Set(allOutbreaks.filter(o => o.virus === 'Hantavirus').map(o => o.location.country));
    for (const entry of monitoringEntries) {
      if (!existingCountries.has(entry.location.country)) {
        allOutbreaks.push(entry);
      }
    }
  }

  // ── Return ──
  if (allOutbreaks.length > 0) {
    return NextResponse.json({
      outbreaks: allOutbreaks,
      source: allOutbreaks.some(o => o.source === 'WHO DON') ? 'who-don-primary' : 'rss-google-news',
      timestamp: new Date().toISOString(),
      errors: errors.length ? errors : undefined,
    });
  }

  return NextResponse.json({
    outbreaks: [MV_HONDIUS_RECORD, ...FALLBACK_DATA],
    source: 'fallback',
    timestamp: new Date().toISOString(),
    errors: errors.length ? errors : undefined,
  });
}
