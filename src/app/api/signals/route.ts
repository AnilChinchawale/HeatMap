import { NextResponse } from "next/server";
import {
  classifyThreat,
  classifyCategory,
  formatTimeAgo,
} from "@/lib/classify";
import { Signal } from "@/types";

import { applyRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

// Fallback dummy data for when RSS feeds fail
const FALLBACK_SIGNALS: Signal[] = [
  {
    id: "fallback-1",
    title: "Israel launches airstrikes on Iranian nuclear facilities near Natanz",
    severity: "CRITICAL",
    category: "military",
    source: "Reuters",
    sourceUrl: "https://reuters.com",
    timeAgo: "5 min ago",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    summary: "Multiple explosions reported near Iran's Natanz uranium enrichment facility. Air defense systems activated.",
    region: "mena",
  },
  {
    id: "fallback-2",
    title: "Iran retaliates with missile barrage targeting US bases in Iraq",
    severity: "CRITICAL",
    category: "military",
    source: "Al Jazeera",
    sourceUrl: "https://aljazeera.com",
    timeAgo: "12 min ago",
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    summary: "Ballistic missiles launched toward Al-Asad airbase. No casualties confirmed yet.",
    region: "iraq",
  },
  {
    id: "fallback-3",
    title: "Oil prices surge 8% as Strait of Hormuz shipping suspended",
    severity: "HIGH",
    category: "economy",
    source: "Bloomberg",
    sourceUrl: "https://bloomberg.com",
    timeAgo: "18 min ago",
    timestamp: new Date(Date.now() - 18 * 60 * 1000),
    summary: "Brent crude jumps to $94/barrel. Major shipping companies halt Red Sea transit.",
    region: "global",
  },
  {
    id: "fallback-4",
    title: "Hezbollah fires rockets into northern Israel from Lebanon",
    severity: "HIGH",
    category: "military",
    source: "Times of Israel",
    sourceUrl: "https://timesofisrael.com",
    timeAgo: "25 min ago",
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    summary: "Iron Dome intercepts most projectiles. IDF responds with artillery fire.",
    region: "lebanon",
  },
  {
    id: "fallback-5",
    title: "US deploys additional carrier strike group to Persian Gulf",
    severity: "HIGH",
    category: "military",
    source: "Defense One",
    sourceUrl: "https://defenseone.com",
    timeAgo: "32 min ago",
    timestamp: new Date(Date.now() - 32 * 60 * 1000),
    summary: "USS Theodore Roosevelt and escort vessels ordered to reinforce CENTCOM presence.",
    region: "mena",
  },
  {
    id: "fallback-6",
    title: "EU announces emergency sanctions on Iranian oil exports",
    severity: "MEDIUM",
    category: "politics",
    source: "EU News",
    sourceUrl: "https://europa.eu",
    timeAgo: "45 min ago",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    summary: "27 member states agree on phased embargo. Exemptions for humanitarian supplies.",
    region: "eu",
  },
  {
    id: "fallback-7",
    title: "Cyber attack disrupts Israeli government websites",
    severity: "MEDIUM",
    category: "cyber",
    source: "BleepingComputer",
    sourceUrl: "https://bleepingcomputer.com",
    timeAgo: "1 hour ago",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    summary: "DDoS attack claimed by pro-Iranian hacktivist group. Services gradually restoring.",
    region: "israel",
  },
  {
    id: "fallback-8",
    title: "Russia condemns strikes, warns of 'dangerous escalation'",
    severity: "MEDIUM",
    category: "politics",
    source: "TASS",
    sourceUrl: "https://tass.com",
    timeAgo: "1.5 hours ago",
    timestamp: new Date(Date.now() - 90 * 60 * 1000),
    summary: "Kremlin calls for immediate ceasefire. Offers to mediate negotiations.",
    region: "russia",
  },
  {
    id: "fallback-9",
    title: "Saudi Arabia activates air defenses, closes northern airspace",
    severity: "MEDIUM",
    category: "military",
    source: "Al Arabiya",
    sourceUrl: "https://alarabiya.net",
    timeAgo: "2 hours ago",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    summary: "Patriot batteries on high alert. All civilian flights rerouted south.",
    region: "saudi",
  },
  {
    id: "fallback-10",
    title: "Gold hits record $2,450/oz as investors flee to safe havens",
    severity: "LOW",
    category: "economy",
    source: "Financial Times",
    sourceUrl: "https://ft.com",
    timeAgo: "3 hours ago",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    summary: "Safe haven assets rally. VIX volatility index jumps 25%.",
    region: "global",
  },
  {
    id: "fallback-11",
    title: "Houthi rebels claim drone attack on Saudi Aramco facility",
    severity: "HIGH",
    category: "military",
    source: "Al Masirah",
    sourceUrl: "https://almasirah.net",
    timeAgo: "15 min ago",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    summary: "Yemeni group claims responsibility. Saudi officials deny damage to infrastructure.",
    region: "yemen",
  },
  {
    id: "fallback-hanta-1",
    title: "WHO confirms Andes hantavirus strain on cruise ship — person-to-person transmission possible",
    severity: "CRITICAL",
    category: "health",
    source: "WHO",
    sourceUrl: "https://www.who.int/emergencies",
    timeAgo: "10 min ago",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    summary: "62 additional passengers on MV Hondius cruise ship feared infected. Andes strain can spread human-to-human. Global contact tracing underway.",
    region: "global",
    lat: -7.32,
    lon: -14.36,
  },
  {
    id: "fallback-hanta-2",
    title: "CDC activates Level 3 emergency response for hantavirus outbreak",
    severity: "HIGH",
    category: "health",
    source: "CDC",
    sourceUrl: "https://www.cdc.gov",
    timeAgo: "25 min ago",
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    summary: "Lowest level emergency activation. Multiple US states monitoring cruise ship returnees. Healthcare providers alerted for hemorrhagic fever symptoms.",
    region: "us",
    lat: 39.83,
    lon: -98.58,
  },
  {
    id: "fallback-hanta-3",
    title: "Canary Islands quarantine 3 cruise passengers in isolation unit",
    severity: "HIGH",
    category: "health",
    source: "El Día",
    sourceUrl: "https://eldia.es",
    timeAgo: "40 min ago",
    timestamp: new Date(Date.now() - 40 * 60 * 1000),
    summary: "Three confirmed cases isolated at Hospital Universitario de Gran Canaria. Authorities tracing all 150+ passengers who disembarked before alert.",
    region: "spain",
    lat: 28.12,
    lon: -15.43,
  },
  {
    id: "fallback-hanta-4",
    title: "Global race to trace MV Hondius passengers who left ship before outbreak confirmed",
    severity: "HIGH",
    category: "health",
    source: "The Guardian",
    sourceUrl: "https://theguardian.com",
    timeAgo: "1 hour ago",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    summary: "Dozens of passengers disembarked in multiple countries before isolation. Health authorities in UK, Germany, US, and Switzerland tracking individuals.",
    region: "global",
  },
  {
    id: "fallback-hanta-5",
    title: "Swiss authorities confirm hantavirus case in passenger who left cruise early",
    severity: "MEDIUM",
    category: "health",
    source: "Swiss Info",
    sourceUrl: "https://swissinfo.ch",
    timeAgo: "2 hours ago",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    summary: "First European mainland case confirmed. Individual traveled via commercial flights before diagnosis. Contact tracing on flights and at airports.",
    region: "switzerland",
    lat: 46.95,
    lon: 7.45,
  },
  {
    id: "fallback-12",
    title: "IAEA calls for immediate access to inspect damaged Natanz facility",
    severity: "MEDIUM",
    category: "politics",
    source: "IAEA",
    sourceUrl: "https://iaea.org",
    timeAgo: "40 min ago",
    timestamp: new Date(Date.now() - 40 * 60 * 1000),
    summary: "UN nuclear watchdog expresses grave concern over potential radiation leaks.",
    region: "iran",
  },
];

// Comprehensive RSS Feed Sources
const FEEDS = [
  // === TIER 1: Wire Services (Breaking News) ===
  {
    name: "Reuters World",
    url: "https://feeds.reuters.com/reuters/worldNews",
    tier: 1,
    region: "global",
  },
  {
    name: "AP News",
    url: "https://rsshub.app/apnews/topics/world-news",
    tier: 1,
    region: "global",
  },
  {
    name: "AFP",
    url: "https://www.france24.com/en/rss",
    tier: 1,
    region: "global",
  },

  // === TIER 1: Major Global Networks ===
  {
    name: "BBC World",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    tier: 1,
    region: "uk",
  },
  {
    name: "BBC Middle East",
    url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
    tier: 1,
    region: "mena",
  },
  {
    name: "CNN",
    url: "https://rss.cnn.com/rss/edition_world.rss",
    tier: 1,
    region: "us",
  },
  {
    name: "Sky News",
    url: "https://feeds.skynews.com/feeds/rss/world.xml",
    tier: 1,
    region: "uk",
  },

  // === MIDDLE EAST REGIONAL ===
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    tier: 1,
    region: "qatar",
  },
  {
    name: "Al Arabiya",
    url: "https://www.alarabiya.net/feed/rss2/ar.xml",
    tier: 1,
    region: "saudi",
  },
  {
    name: "Middle East Eye",
    url: "https://www.middleeasteye.net/rss",
    tier: 2,
    region: "mena",
  },
  {
    name: "The National UAE",
    url: "https://www.thenationalnews.com/rss",
    tier: 2,
    region: "uae",
  },
  {
    name: "Gulf News",
    url: "https://gulfnews.com/rss",
    tier: 2,
    region: "uae",
  },

  // === ISRAELI SOURCES ===
  {
    name: "Times of Israel",
    url: "https://www.timesofisrael.com/feed/",
    tier: 1,
    region: "israel",
  },
  {
    name: "Jerusalem Post",
    url: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx",
    tier: 1,
    region: "israel",
  },
  {
    name: "Haaretz",
    url: "https://www.haaretz.com/cmlink/1.628752",
    tier: 2,
    region: "israel",
  },
  {
    name: "Ynet News",
    url: "https://www.ynetnews.com/RSS/rss.html",
    tier: 2,
    region: "israel",
  },
  {
    name: "Israel Hayom",
    url: "https://www.israelhayom.com/feed/",
    tier: 2,
    region: "israel",
  },
  {
    name: "i24 News",
    url: "https://www.i24news.tv/en/rss",
    tier: 2,
    region: "israel",
  },

  // === IRANIAN PERSPECTIVE ===
  {
    name: "Press TV",
    url: "https://www.presstv.ir/RSS",
    tier: 2,
    region: "iran",
  },
  {
    name: "Tehran Times",
    url: "https://www.tehrantimes.com/rss",
    tier: 2,
    region: "iran",
  },
  { name: "IRNA", url: "https://en.irna.ir/rss.aspx", tier: 2, region: "iran" },
  {
    name: "Tasnim News",
    url: "https://www.tasnimnews.com/en/rss",
    tier: 2,
    region: "iran",
  },
  {
    name: "Fars News",
    url: "https://www.farsnews.ir/rss",
    tier: 2,
    region: "iran",
  },

  // === US GOVERNMENT & MILITARY ===
  {
    name: "CENTCOM",
    url: "https://www.centcom.mil/RSS/",
    tier: 1,
    region: "us-mil",
  },
  {
    name: "DOD News",
    url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=10",
    tier: 1,
    region: "us-mil",
  },
  {
    name: "State Dept",
    url: "https://www.state.gov/rss-feed/press-releases/feed/",
    tier: 1,
    region: "us-gov",
  },

  // === EUROPEAN ===
  {
    name: "Guardian World",
    url: "https://www.theguardian.com/world/rss",
    tier: 1,
    region: "uk",
  },
  {
    name: "DW News",
    url: "https://rss.dw.com/xml/rss-en-world",
    tier: 2,
    region: "germany",
  },
  {
    name: "France 24",
    url: "https://www.france24.com/en/middle-east/rss",
    tier: 2,
    region: "france",
  },
  {
    name: "EuroNews",
    url: "https://www.euronews.com/rss?level=theme&name=world",
    tier: 2,
    region: "eu",
  },

  // === DEFENSE & MILITARY ANALYSIS ===
  {
    name: "Defense One",
    url: "https://www.defenseone.com/rss/",
    tier: 2,
    region: "defense",
  },
  {
    name: "Breaking Defense",
    url: "https://breakingdefense.com/feed/",
    tier: 2,
    region: "defense",
  },
  {
    name: "War on the Rocks",
    url: "https://warontherocks.com/feed/",
    tier: 2,
    region: "defense",
  },
  {
    name: "Defense News",
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml",
    tier: 2,
    region: "defense",
  },
  {
    name: "Naval News",
    url: "https://www.navalnews.com/feed/",
    tier: 3,
    region: "defense",
  },
  {
    name: "The Drive",
    url: "https://www.thedrive.com/the-war-zone/feed",
    tier: 2,
    region: "defense",
  },

  // === OSINT & ANALYSIS ===
  {
    name: "ISW",
    url: "https://www.understandingwar.org/rss.xml",
    tier: 1,
    region: "analysis",
  },
  {
    name: "Bellingcat",
    url: "https://www.bellingcat.com/feed/",
    tier: 2,
    region: "osint",
  },
  {
    name: "CSIS",
    url: "https://www.csis.org/rss.xml",
    tier: 2,
    region: "analysis",
  },
  {
    name: "War Zone",
    url: "https://www.twz.com/feed",
    tier: 2,
    region: "analysis",
  },

  // === REGIONAL CONFLICTS ===
  {
    name: "Syria Direct",
    url: "https://syriadirect.org/feed/",
    tier: 3,
    region: "syria",
  },
  {
    name: "Lebanon 24",
    url: "https://www.lebanon24.com/rss",
    tier: 3,
    region: "lebanon",
  },
  {
    name: "Iraq News",
    url: "https://www.iraqinews.com/feed/",
    tier: 3,
    region: "iraq",
  },
  {
    name: "Yemen Post",
    url: "https://www.yemenpost.net/rss",
    tier: 3,
    region: "yemen",
  },

  // === SHIPPING & TRADE (Red Sea) ===
  {
    name: "Lloyd's List",
    url: "https://lloydslist.maritimeintelligence.informa.com/RSS",
    tier: 2,
    region: "shipping",
  },
  {
    name: "Splash247",
    url: "https://splash247.com/feed/",
    tier: 3,
    region: "shipping",
  },
  {
    name: "gCaptain",
    url: "https://gcaptain.com/feed/",
    tier: 3,
    region: "shipping",
  },

  // === HEALTH & PANDEMIC MONITORING ===
  {
    name: "WHO Disease Outbreak News",
    url: "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
    tier: 1,
    region: "global",
  },
  {
    name: "CDC Health Alert Network",
    url: "https://tools.cdc.gov/podcasts/feed.asp?feedid=183",
    tier: 1,
    region: "us",
  },
  {
    name: "CIDRAP News",
    url: "https://www.cidrap.umn.edu/news/178506/rss.xml",
    tier: 1,
    region: "global",
  },
  {
    name: "ProMED Mail",
    url: "https://promedmail.org/feed/",
    tier: 1,
    region: "global",
  },

  // === NUCLEAR & ARMS CONTROL ===
  {
    name: "Arms Control Today",
    url: "https://www.armscontrol.org/rss.xml",
    tier: 2,
    region: "nuclear",
  },
  { name: "NTI", url: "https://www.nti.org/rss/", tier: 2, region: "nuclear" },

  // === CYBER SECURITY ===
  {
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    tier: 3,
    region: "cyber",
  },
  {
    name: "The Record",
    url: "https://therecord.media/feed",
    tier: 3,
    region: "cyber",
  },
  {
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    tier: 3,
    region: "cyber",
  },

  // === FINANCIAL IMPACT ===
  {
    name: "OilPrice",
    url: "https://oilprice.com/rss/main",
    tier: 2,
    region: "commodities",
  },
  {
    name: "Platts",
    url: "https://www.spglobal.com/platts/RSSFeed",
    tier: 2,
    region: "commodities",
  },
];

// Iran-related keywords for region tagging only (NOT severity boosting)
const IRAN_KEYWORDS = [
  "iran",
  "tehran",
  "persian",
  "irgc",
  "quds force",
  "khamenei",
  "raisi",
  "zarif",
  "strait of hormuz",
  "hormuz",
  "persian gulf",
  "natanz",
  "fordow",
  "bushehr",
  "arak",
  "axis of resistance",
  "revolutionary guard",
  "basij",
];

// Hantavirus/health keywords for region and topic tagging
const HANTA_KEYWORDS = [
  "hantavirus",
  "andes strain",
  "hemorrhagic fever",
  "rodent borne",
  "mv hondius",
  "cruise ship",
  "person to person",
  "human to human",
  "viral outbreak",
  "quarantine",
  "isolation unit",
  "canary islands",
  "gran canaria",
  "switzerland",
  "who",
  "cdc",
  "pandemic",
];

// Simple XML parser for RSS and ATOM feeds
function parseRSS(xml: string, sourceName: string, region: string): Signal[] {
  const items: Signal[] = [];

  const isAtom = xml.includes("<entry>") || xml.includes("<entry ");
  const itemRegex = isAtom
    ? /<entry[^>]*>([\s\S]*?)<\/entry>/gi
    : /<item[^>]*>([\s\S]*?)<\/item>/gi;

  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const title =
      item
        .match(
          /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i,
        )?.[1]
        ?.trim() || "";

    let link = "";
    if (isAtom) {
      const linkMatch = item.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
      link = linkMatch?.[1] || "";
    } else {
      link =
        item
          .match(
            /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i,
          )?.[1]
          ?.trim() || "";
    }

    const pubDate = isAtom
      ? item.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() ||
        item.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim()
      : item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();

    const description = isAtom
      ? item
          .match(
            /<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i,
          )?.[1]
          ?.trim() ||
        item
          .match(
            /<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i,
          )?.[1]
          ?.trim() ||
        ""
      : item
          .match(
            /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i,
          )?.[1]
          ?.trim() || "";

    if (!title) continue;

    const cleanTitle = title
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    const cleanDesc = description.replace(/<[^>]*>/g, "").substring(0, 300);

    const timestamp = pubDate ? new Date(pubDate) : new Date();
    const fullText = (cleanTitle + " " + cleanDesc).toLowerCase();

    const iranRelevance = IRAN_KEYWORDS.filter((kw) =>
      fullText.includes(kw.toLowerCase()),
    ).length;

    const { severity } = classifyThreat(cleanTitle + " " + cleanDesc);
    const category = classifyCategory(cleanTitle + " " + cleanDesc);

    items.push({
      id: Buffer.from(link || cleanTitle).toString("base64"),
      title: cleanTitle,
      severity,
      category,
      source: sourceName,
      sourceUrl: link,
      timeAgo: formatTimeAgo(timestamp),
      timestamp,
      summary: cleanDesc,
      region,
      iranRelevance,
    } as Signal & { iranRelevance: number });
  }

  return items;
}

// Also try Atom feeds
function parseAtom(xml: string, sourceName: string, region: string): Signal[] {
  const items: Signal[] = [];
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const title =
      entry
        .match(
          /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i,
        )?.[1]
        ?.trim() || "";
    const link = entry.match(/<link[^>]*href="([^"]*)"[^>]*>/i)?.[1] || "";
    const updated = entry
      .match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]
      ?.trim();
    const published = entry
      .match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]
      ?.trim();
    const summary =
      entry
        .match(
          /<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i,
        )?.[1]
        ?.trim() || "";
    const content =
      entry
        .match(
          /<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i,
        )?.[1]
        ?.trim() || "";

    if (!title) continue;

    const cleanTitle = title.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&");
    const cleanDesc = (summary || content)
      .replace(/<[^>]*>/g, "")
      .substring(0, 300);

    const timestamp = new Date(published || updated || Date.now());
    const fullText = (cleanTitle + " " + cleanDesc).toLowerCase();
    const iranRelevance = IRAN_KEYWORDS.filter((kw) =>
      fullText.includes(kw.toLowerCase()),
    ).length;

    const { severity } = classifyThreat(cleanTitle + " " + cleanDesc);
    const category = classifyCategory(cleanTitle + " " + cleanDesc);

    items.push({
      id: Buffer.from(link || cleanTitle).toString("base64"),
      title: cleanTitle,
      severity,
      category,
      source: sourceName,
      sourceUrl: link,
      timeAgo: formatTimeAgo(timestamp),
      timestamp,
      summary: cleanDesc,
      region,
      iranRelevance,
    } as Signal & { iranRelevance: number });
  }

  return items;
}

// Cache for RSS data
let cache: {
  signals: Signal[];
  timestamp: number;
  sources: { success: number; failed: number };
} | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  // Apply rate limiting
  const rateLimitResponse = applyRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter"); // 'iran', 'israel', 'all'
  const refresh = searchParams.get("refresh") === "true";

  try {
    // Return cached data if fresh (unless refresh requested)
    if (!refresh && cache && Date.now() - cache.timestamp < CACHE_TTL) {
      let signals = cache.signals;
      if (filter === "iran") {
        signals = signals.filter((s) => (s.iranRelevance ?? 0) > 0);
      }
      return NextResponse.json({
        signals,
        cached: true,
        sources: cache.sources,
      });
    }

    // Fetch all feeds in parallel with timeout
    const fetchWithTimeout = async (
      url: string,
      timeout = 4000,
    ): Promise<string | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; GlobeNews-Live/2.0; +https://globenews.live)",
            Accept:
              "application/rss+xml, application/xml, text/xml, application/atom+xml",
          },
          next: { revalidate: 60 },
        });
        clearTimeout(timeoutId);
        return res.ok ? await res.text() : null;
      } catch {
        clearTimeout(timeoutId);
        return null;
      }
    };

    let successCount = 0;
    let failCount = 0;

    const results = await Promise.all(
      FEEDS.map(async (feed) => {
        const xml = await fetchWithTimeout(feed.url);
        if (!xml) {
          failCount++;
          return [];
        }
        successCount++;
        let items = parseRSS(xml, feed.name, feed.region);
        if (items.length === 0) {
          items = parseAtom(xml, feed.name, feed.region);
        }
        return items;
      }),
    );

    // Merge and sort
    let allSignals = results.flat();

    // Simple deduplication by title similarity
    const seen = new Set<string>();
    allSignals = allSignals.filter((s) => {
      const key = s.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort: Iran relevance > severity > timestamp
    const severityOrder: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
      INFO: 4,
    };
    allSignals.sort((a, b) => {
      const aRel = a.iranRelevance ?? 0;
      const bRel = b.iranRelevance ?? 0;
      if (aRel !== bRel) {
        return bRel - aRel;
      }
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Limit to top 100
    const signals = allSignals.slice(0, 100);

    // Update cache
    cache = {
      signals,
      timestamp: Date.now(),
      sources: { success: successCount, failed: failCount },
    };

    let filteredSignals = signals;
    if (filter === "iran") {
      filteredSignals = signals.filter((s) => (s.iranRelevance ?? 0) > 0);
    }

    return NextResponse.json({
      signals: filteredSignals,
      cached: false,
      sources: {
        success: successCount,
        failed: failCount,
        total: FEEDS.length,
      },
      iranRelated: signals.filter((s) => (s.iranRelevance ?? 0) > 0).length,
    });
  } catch (error) {
    console.error("Signals API error:", error);
    
    // Return fallback data on error
    return NextResponse.json({
      signals: FALLBACK_SIGNALS,
      cached: false,
      sources: { success: 0, failed: FEEDS.length, total: FEEDS.length },
      iranRelated: FALLBACK_SIGNALS.filter((s) => 
        IRAN_KEYWORDS.some(kw => s.title.toLowerCase().includes(kw))
      ).length,
      error: "Failed to fetch live signals. Showing fallback data.",
    }, { status: 200 });
  }
}
