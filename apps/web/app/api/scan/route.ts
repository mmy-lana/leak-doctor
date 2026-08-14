/* cspell:disable */
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { formatBytes } from '@leak-doctor/shared';

export interface ScanResult {
  url: string;
  initialHeapBytes: number;
  postGcHeapBytes: number;
  leakedBytes: number;
  formattedLeakedBytes: string;
  healthScore: number;
  status: 'passed' | 'warning' | 'failed';
  recommendations: string[];
  timestamp: number;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Valid URL starting with http:// or https:// is required.' }, { status: 400 });
    }

    const isLocal = process.env.NODE_ENV === 'development';
    const executablePath = isLocal
      ? process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: isLocal ? ['--no-sandbox'] : chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    const client = await page.createCDPSession();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const initialMetrics = (await page.evaluate(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return mem ? mem.usedJSHeapSize : 0;
    })) as number;

    await client.send('HeapProfiler.collectGarbage');

    const postGcMetrics = (await page.evaluate(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return mem ? mem.usedJSHeapSize : 0;
    })) as number;

    await browser.close();

    const leakedBytes = Math.max(0, postGcMetrics - initialMetrics);
    const healthScore = Math.max(0, 100 - Math.round((leakedBytes / (1024 * 1024)) * 5));

    let status: 'passed' | 'warning' | 'failed' = 'passed';
    const recommendations: string[] = [];

    if (leakedBytes > 5 * 1024 * 1024) {
      status = 'failed';
      recommendations.push('Critical heap retention detected. Inspect event listeners and uncollected DOM nodes.');
    } else if (leakedBytes > 1024 * 1024) {
      status = 'warning';
      recommendations.push('Moderate heap growth after GC. Ensure component unmount cleanup functions run.');
    } else {
      recommendations.push('Clean GC cycle achieved. No significant persistent memory leaks detected.');
    }

    const responseData: ScanResult = {
      url,
      initialHeapBytes: initialMetrics,
      postGcHeapBytes: postGcMetrics,
      leakedBytes,
      formattedLeakedBytes: formatBytes(leakedBytes),
      healthScore,
      status,
      recommendations,
      timestamp: Date.now(),
    };

    return NextResponse.json(responseData);
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || 'Headless memory scanning failed.' }, { status: 500 });
  }
}