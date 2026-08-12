import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://hantavirustracker.pplx.app/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // 10s timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${res.status}` },
        { status: 502 }
      );
    }

    let html = await res.text();

    // Strip X-Frame-Options meta tags and frame-busting scripts
    html = html
      .replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '')
      .replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
      .replace(/if\s*\(\s*top\s*!==\s*self\s*\)[^;]*;/gi, '')
      .replace(/if\s*\(\s*window\.top\s*!==\s*window\.self\s*\)[^;]*;/gi, '');

    // Inject <base> tag so all relative fetches go to pplx.app
    html = html.replace(
      /<head>/i,
      `<head>\n    <base href="https://hantavirustracker.pplx.app/" target="_blank">`
    );

    // Rewrite relative URLs to absolute
    html = html.replace(
      /(href|src|url)\s*=\s*["']\.\//gi,
      `$1="https://hantavirustracker.pplx.app/`
    );
    html = html.replace(
      /(href|src|url)\s*=\s*["']\//gi,
      `$1="https://hantavirustracker.pplx.app/`
    );
    html = html.replace(
      /(href|src|url)\s*=\s*["'](?!https?:\/\/|\/\/|#|data:)/gi,
      `$1="https://hantavirustracker.pplx.app/`
    );

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy failed';
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
