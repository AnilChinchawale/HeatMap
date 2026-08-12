import { NextResponse } from 'next/server';

const FEEDS = [
  { url: 'https://www.reuters.com/markets/commodities/rss/', name: 'Reuters' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business' },
];

export const revalidate = 60;

interface RssItem {
  title?: string;
  contentSnippet?: string;
  link?: string;
  isoDate?: string;
}

interface RssFeed {
  items: RssItem[];
}

async function parseRSS(url: string): Promise<RssFeed> {
  const res = await fetch(url, { headers: { 'User-Agent': 'GlobeNewsLive/2.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  // Minimal XML parser for RSS
  const items: RssItem[] = [];
  const itemRegex = /<item>[\s\S]*?<\/item>/g;
  const itemsXml = xml.match(itemRegex) || [];

  for (const itemXml of itemsXml.slice(0, 5)) {
    const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || '';
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
    const description = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || '';

    items.push({
      title,
      link,
      isoDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      contentSnippet: description.replace(/<[^>]+>/g, '').slice(0, 200),
    });
  }

  return { items };
}

interface FinanceNewsArticle {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
}

export async function GET() {
  const articles: FinanceNewsArticle[] = [];

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await parseRSS(feed.url);
        return parsed.items.map((item) => ({
          title: item.title || 'Untitled',
          summary: item.contentSnippet?.slice(0, 200) || '',
          source: feed.name,
          url: item.link || '',
          publishedAt: item.isoDate || new Date().toISOString(),
        }));
      } catch {
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }

  // Sort by date, newest first
  articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return NextResponse.json({
    category: 'commodities',
    articles: articles.slice(0, 10),
    count: articles.length,
    updatedAt: new Date().toISOString(),
  });
}
