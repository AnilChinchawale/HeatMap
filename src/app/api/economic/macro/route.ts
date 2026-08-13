import { NextResponse } from 'next/server';
import {
  COUNTRIES, COUNTRY_CODES, WB_INDICATORS,
  MacroData, EconomicAlert, calculateRisk, generateAlerts,
} from '@/data/economicCountries';

const WB_BASE = 'https://api.worldbank.org/v2/country';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours (World Bank updates slowly)
const RETRIES = 2;
const TIMEOUT_MS = 8000;

let cache: { data: Record<string, MacroData>; timestamp: number } | null = null;

// Fast fallback data (2023-2024 estimates from IMF/World Bank public data)
const FALLBACK_DATA: Record<string, Partial<MacroData>> = {
  us: { gdpGrowth: 2.5, inflation: 3.4, unemployment: 3.9, debtToGdp: 123, reserves: 35000, exports: 3020000, imports: 3820000, gdpPerCapita: 76398 },
  cn: { gdpGrowth: 5.2, inflation: 0.2, unemployment: 5.2, debtToGdp: 77, reserves: 325000, exports: 3380000, imports: 2560000, gdpPerCapita: 12541 },
  de: { gdpGrowth: -0.3, inflation: 2.5, unemployment: 5.7, debtToGdp: 66, reserves: 296000, exports: 1690000, imports: 1480000, gdpPerCapita: 48432 },
  jp: { gdpGrowth: 1.9, inflation: 2.8, unemployment: 2.6, debtToGdp: 255, reserves: 123000, exports: 718000, imports: 786000, gdpPerCapita: 33815 },
  in: { gdpGrowth: 7.8, inflation: 5.4, unemployment: 7.1, debtToGdp: 83, reserves: 642000, exports: 451000, imports: 715000, gdpPerCapita: 2503 },
  gb: { gdpGrowth: 0.1, inflation: 4.0, unemployment: 4.3, debtToGdp: 101, reserves: 185000, exports: 468000, imports: 790000, gdpPerCapita: 48912 },
  fr: { gdpGrowth: 0.9, inflation: 2.3, unemployment: 7.3, debtToGdp: 111, reserves: 245000, exports: 798000, imports: 886000, gdpPerCapita: 40420 },
  br: { gdpGrowth: 2.9, inflation: 4.6, unemployment: 7.5, debtToGdp: 75, reserves: 355000, exports: 339000, imports: 292000, gdpPerCapita: 8918 },
  it: { gdpGrowth: 0.7, inflation: 1.7, unemployment: 7.2, debtToGdp: 137, reserves: 207000, exports: 632000, imports: 622000, gdpPerCapita: 35281 },
  ca: { gdpGrowth: 1.1, inflation: 2.4, unemployment: 5.8, debtToGdp: 107, reserves: 89000, exports: 568000, imports: 598000, gdpPerCapita: 53247 },
  ru: { gdpGrowth: 3.6, inflation: 7.4, unemployment: 2.8, debtToGdp: 14, reserves: 585000, exports: 425000, imports: 285000, gdpPerCapita: 13690 },
  kr: { gdpGrowth: 3.1, inflation: 2.9, unemployment: 2.7, debtToGdp: 54, reserves: 420000, exports: 632000, imports: 600000, gdpPerCapita: 33147 },
  mx: { gdpGrowth: 3.2, inflation: 4.7, unemployment: 2.9, debtToGdp: 60, reserves: 200000, exports: 593000, imports: 604000, gdpPerCapita: 11091 },
  au: { gdpGrowth: 1.5, inflation: 3.6, unemployment: 3.7, debtToGdp: 50, reserves: 65000, exports: 310000, imports: 285000, gdpPerCapita: 62723 },
  es: { gdpGrowth: 2.5, inflation: 2.4, unemployment: 11.8, debtToGdp: 108, reserves: 88000, exports: 410000, imports: 460000, gdpPerCapita: 30103 },
  id: { gdpGrowth: 5.0, inflation: 2.6, unemployment: 5.3, debtToGdp: 39, reserves: 137000, exports: 259000, imports: 221000, gdpPerCapita: 4941 },
  sa: { gdpGrowth: 0.8, inflation: 2.3, unemployment: 5.6, debtToGdp: 24, reserves: 445000, exports: 325000, imports: 205000, gdpPerCapita: 32586 },
  tr: { gdpGrowth: 4.5, inflation: 53.9, unemployment: 8.5, debtToGdp: 26, reserves: 65000, exports: 256000, imports: 361000, gdpPerCapita: 10655 },
  tw: { gdpGrowth: 1.4, inflation: 2.2, unemployment: 3.4, debtToGdp: 29, reserves: 568000, exports: 475000, imports: 381000, gdpPerCapita: 32811 },
  ar: { gdpGrowth: -1.6, inflation: 211.4, unemployment: 5.7, debtToGdp: 89, reserves: 24000, exports: 66000, imports: 73000, gdpPerCapita: 13786 },
  za: { gdpGrowth: 0.6, inflation: 5.1, unemployment: 32.1, debtToGdp: 72, reserves: 62000, exports: 108000, imports: 113000, gdpPerCapita: 6776 },
  ua: { gdpGrowth: 5.0, inflation: 5.1, unemployment: 19.5, debtToGdp: 78, reserves: 39000, exports: 36000, imports: 54000, gdpPerCapita: 4533 },
  il: { gdpGrowth: 2.0, inflation: 2.5, unemployment: 3.2, debtToGdp: 58, reserves: 203000, exports: 140000, imports: 85000, gdpPerCapita: 54659 },
  ir: { gdpGrowth: 3.8, inflation: 40.0, unemployment: 9.0, debtToGdp: 34, reserves: 13000, exports: 86000, imports: 62000, gdpPerCapita: 4663 },
  ae: { gdpGrowth: 3.4, inflation: 1.9, unemployment: 2.8, debtToGdp: 30, reserves: 62000, exports: 440000, imports: 340000, gdpPerCapita: 49851 },
  eg: { gdpGrowth: 2.5, inflation: 33.0, unemployment: 7.0, debtToGdp: 96, reserves: 35000, exports: 48000, imports: 78000, gdpPerCapita: 4295 },
  vn: { gdpGrowth: 5.1, inflation: 3.3, unemployment: 2.3, debtToGdp: 34, reserves: 92000, exports: 355000, imports: 340000, gdpPerCapita: 4163 },
  pl: { gdpGrowth: 0.2, inflation: 3.9, unemployment: 2.8, debtToGdp: 50, reserves: 177000, exports: 342000, imports: 345000, gdpPerCapita: 18321 },
  ng: { gdpGrowth: 2.7, inflation: 24.2, unemployment: 5.0, debtToGdp: 39, reserves: 33000, exports: 52000, imports: 55000, gdpPerCapita: 2182 },
  pk: { gdpGrowth: 2.4, inflation: 23.4, unemployment: 8.5, debtToGdp: 74, reserves: 8000, exports: 30000, imports: 55000, gdpPerCapita: 1470 },
  bd: { gdpGrowth: 5.8, inflation: 9.7, unemployment: 5.3, debtToGdp: 39, reserves: 20000, exports: 46000, imports: 70000, gdpPerCapita: 2688 },
};

async function fetchWBIndicator(iso3: string, indicator: string, attempt = 1): Promise<number | null> {
  try {
    const url = `${WB_BASE}/${iso3}/indicator/${indicator}?format=json&per_page=5&date=2020:2024`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const json = await res.json();
    const arr = Array.isArray(json) ? json[1] || json[0] : null;
    if (!Array.isArray(arr)) return null;
    for (const item of arr) {
      if (item.value !== null && item.value !== undefined) {
        return typeof item.value === 'number' ? item.value : parseFloat(item.value);
      }
    }
    return null;
  } catch {
    if (attempt < RETRIES) {
      await new Promise(r => setTimeout(r, 500 * attempt));
      return fetchWBIndicator(iso3, indicator, attempt + 1);
    }
    return null;
  }
}

async function fetchWBSparkline(iso3: string, indicator: string, attempt = 1): Promise<number[]> {
  try {
    const url = `${WB_BASE}/${iso3}/indicator/${indicator}?format=json&per_page=15&date=2015:2024`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const json = await res.json();
    const arr = Array.isArray(json) ? json[1] || json[0] : null;
    if (!Array.isArray(arr)) return [];
    interface WBDataPoint {
      value: number | string | null;
    }
    const values = (arr as WBDataPoint[])
      .filter((item) => item.value !== null && item.value !== undefined)
      .map((item) => typeof item.value === 'number' ? item.value : parseFloat(item.value as string))
      .reverse(); // chronological order
    return values.slice(-12); // last 12 data points
  } catch {
    if (attempt < RETRIES) {
      await new Promise(r => setTimeout(r, 500 * attempt));
      return fetchWBSparkline(iso3, indicator, attempt + 1);
    }
    return [];
  }
}

async function fetchCountryData(code: string): Promise<MacroData> {
  const iso3 = COUNTRIES[code].iso3;
  const fallback = FALLBACK_DATA[code];

  // Fetch in parallel with 5s timeout each
  const [
    gdpGrowth, inflation, unemployment, debtToGdp,
    reserves, exports, imports, gdpPerCapita,
    gdpSparkline, inflationSparkline, unemploymentSparkline, debtSparkline,
    reservesSparkline, exportsSparkline, importsSparkline,
  ] = await Promise.all([
    fetchWBIndicator(iso3, WB_INDICATORS.gdpGrowth),
    fetchWBIndicator(iso3, WB_INDICATORS.inflation),
    fetchWBIndicator(iso3, WB_INDICATORS.unemployment),
    fetchWBIndicator(iso3, WB_INDICATORS.debtToGdp),
    fetchWBIndicator(iso3, WB_INDICATORS.reserves),
    fetchWBIndicator(iso3, WB_INDICATORS.exports),
    fetchWBIndicator(iso3, WB_INDICATORS.imports),
    fetchWBIndicator(iso3, WB_INDICATORS.gdpPerCapita),
    fetchWBSparkline(iso3, WB_INDICATORS.gdpGrowth),
    fetchWBSparkline(iso3, WB_INDICATORS.inflation),
    fetchWBSparkline(iso3, WB_INDICATORS.unemployment),
    fetchWBSparkline(iso3, WB_INDICATORS.debtToGdp),
    fetchWBSparkline(iso3, WB_INDICATORS.reserves),
    fetchWBSparkline(iso3, WB_INDICATORS.exports),
    fetchWBSparkline(iso3, WB_INDICATORS.imports),
  ]);

  // Use fallback where live data is missing
  const resolve = (live: number | null, fb: number | null | undefined) =>
    live !== null ? live : (fb !== undefined ? fb : null);

  const gdpG = resolve(gdpGrowth, fallback?.gdpGrowth);
  const inf = resolve(inflation, fallback?.inflation);
  const unemp = resolve(unemployment, fallback?.unemployment);
  const debt = resolve(debtToGdp, fallback?.debtToGdp);
  const res = resolve(reserves, fallback?.reserves);
  const exp = resolve(exports, fallback?.exports);
  const imp = resolve(imports, fallback?.imports);
  const gdpPC = resolve(gdpPerCapita, fallback?.gdpPerCapita);

  const tradeBalance = exp !== null && imp !== null ? exp - imp : null;

  return {
    gdpGrowth: gdpG,
    inflation: inf,
    unemployment: unemp,
    debtToGdp: debt,
    reserves: res,
    exports: exp,
    imports: imp,
    gdpPerCapita: gdpPC,
    tradeBalance,
    lastUpdated: new Date().toISOString(),
    gdpSparkline: gdpSparkline.length > 0 ? gdpSparkline : [],
    inflationSparkline: inflationSparkline.length > 0 ? inflationSparkline : [],
    unemploymentSparkline: unemploymentSparkline.length > 0 ? unemploymentSparkline : [],
    debtSparkline: debtSparkline.length > 0 ? debtSparkline : [],
    reservesSparkline: reservesSparkline.length > 0 ? reservesSparkline : [],
    exportsSparkline: exportsSparkline.length > 0 ? exportsSparkline : [],
    importsSparkline: importsSparkline.length > 0 ? importsSparkline : [],
    tradeBalanceSparkline: [],
  };
}

export async function GET() {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      const risks: Record<string, ReturnType<typeof calculateRisk>> = {};
      const alerts: EconomicAlert[] = [];
      for (const code of COUNTRY_CODES) {
        risks[code] = calculateRisk(cache.data[code]);
        alerts.push(...generateAlerts(code, cache.data[code]));
      }
      return NextResponse.json({
        countries: COUNTRIES,
        data: cache.data,
        risks,
        alerts: alerts.sort((a, b) => {
          const sev = { critical: 3, high: 2, medium: 1 };
          return sev[b.severity] - sev[a.severity];
        }),
        cached: true,
        timestamp: new Date(cache.timestamp).toISOString(),
      });
    }

    // Fetch all countries in parallel (with timeout)
    const entries = await Promise.all(
      COUNTRY_CODES.map(async (code) => {
        const data = await fetchCountryData(code);
        return [code, data] as [string, MacroData];
      })
    );

    const data: Record<string, MacroData> = Object.fromEntries(entries);

    // Build risk scores and alerts
    const risks: Record<string, ReturnType<typeof calculateRisk>> = {};
    const alerts: EconomicAlert[] = [];

    for (const [code, d] of entries) {
      risks[code] = calculateRisk(d);
      const countryAlerts = generateAlerts(code, d);
      if (countryAlerts.length > 0) {
        alerts.push(...countryAlerts);
      }
    }

    cache = { data, timestamp: Date.now() };

    return NextResponse.json({
      countries: COUNTRIES,
      data,
      risks,
      alerts: alerts.sort((a, b) => {
        const sev = { critical: 3, high: 2, medium: 1 };
        return sev[b.severity] - sev[a.severity];
      }),
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Economic Macro API Error]', err);
    return NextResponse.json(
      { error: 'Failed to fetch economic data', details: String(err) },
      { status: 500 }
    );
  }
}
