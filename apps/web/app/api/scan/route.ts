/* cspell:disable */
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { formatBytes } from '@leak-doctor/shared';

export interface InteractionRule {
  type: 'text' | 'selector' | 'xpath';
  value: string;
}

export interface ScanResult {
  url: string;
  baselineHeapBytes: number;
  interactiveHeapBytes: number;
  passiveLeakedBytes: number;
  interactiveLeakedBytes: number;
  formattedPassiveLeakedBytes: string;
  formattedInteractiveLeakedBytes: string;
  actionTestedDescription: string;
  passiveHealthScore: number;
  interactiveHealthScore: number;
  status: 'passed' | 'warning' | 'failed';
  recommendations: string[];
  timestamp: number;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { url, interactions } = (await request.json()) as { url: string; interactions?: InteractionRule[] };

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Valid URL starting with http:// or https:// is required.' }, { status: 400 });
    }

    const isLocal = process.env.NODE_ENV === 'development';
    const executablePath = isLocal
      ? process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: [
        ...(isLocal ? ['--no-sandbox'] : chromium.args),
        '--enable-precise-memory-info',
        '--js-flags=--expose-gc',
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    const client = await page.createCDPSession();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

		await client.send('HeapProfiler.enable');

    // 1. Force GC & Capture Baseline (Do Nothing)
    await client.send('HeapProfiler.collectGarbage');
    const baselineHeapBytes = (await page.evaluate(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return mem && mem.usedJSHeapSize > 0 ? mem.usedJSHeapSize : 0;
    })) as number;

    let actionTestedDescription = 'No button interactions executed';

    // 2. Interactive Phase: Custom Rules or Random Button Selection
    if (interactions && Array.isArray(interactions) && interactions.length > 0) {
      actionTestedDescription = `Executed ${interactions.length} custom interaction rule(s)`;
      for (const rule of interactions) {
        if (!rule.value) continue;
        try {
          await page.evaluate((r: InteractionRule) => {
            if (r.type === 'selector') {
              const el = document.querySelector(r.value) as HTMLElement;
              if (el) el.click();
            } else if (r.type === 'xpath') {
              const res = document.evaluate(r.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              const el = res.singleNodeValue as HTMLElement;
              if (el) el.click();
            } else if (r.type === 'text') {
              const targets = Array.from(document.querySelectorAll('button, a, [role="button"]'));
              const match = targets.find((el) => el.textContent?.trim().toLowerCase().includes(r.value.toLowerCase()));
              if (match) (match as HTMLElement).click();
            }
          }, rule);
        } catch {
          // Suppress DOM click exceptions
        }
      }
    } else {
      // Pick 1 visible button randomly
      const randomClickResult = (await page.evaluate(() => {
        const clickable = Array.from(document.querySelectorAll('button, [role="button"]')).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (el as HTMLElement).offsetParent !== null;
        });

        if (clickable.length > 0) {
          const randomIndex = Math.floor(Math.random() * clickable.length);
          const target = clickable[randomIndex] as HTMLElement;
          const label = target.textContent?.trim().substring(0, 35) || target.tagName.toLowerCase();
          const tagInfo = `<${target.tagName.toLowerCase()}${target.className ? ' class="' + target.className.substring(0, 25) + '"' : ''}>`;
          target.click();
          return `Randomly tested button #${randomIndex + 1} of ${clickable.length}: "${label}" (${tagInfo})`;
        }
        return 'No clickable buttons found on page';
      })) as string;

      actionTestedDescription = randomClickResult;
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));

    // 3. Force GC & Measure Post-Interactive Heap
    await client.send('HeapProfiler.collectGarbage');

    const interactiveHeapBytes = (await page.evaluate(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return mem && mem.usedJSHeapSize > 0 ? mem.usedJSHeapSize : 0;
    })) as number;

    const domNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);

    await browser.close();

    const interactiveLeakedBytes = Math.max(0, interactiveHeapBytes - baselineHeapBytes);

    // 1. Passive Health Score (Base Page & DOM Density)
    const passiveHeapMb = baselineHeapBytes / (1024 * 1024);
    const passiveDomPenalty = domNodeCount > 2000 ? Math.floor((domNodeCount - 2000) / 200) : 0;
    const passiveHeapPenalty = passiveHeapMb > 15 ? Math.floor((passiveHeapMb - 15) * 2) : 0;
    const passiveHealthScore = Math.max(0, Math.min(100, 100 - passiveDomPenalty - passiveHeapPenalty));

    // 2. Interactive Health Score (Sensitive Memory Retention: -2 pts per 100 KB leaked)
    const leakedKb = interactiveLeakedBytes / 1024;
    const leakPenalty = Math.round((leakedKb / 100) * 2);
    const interactiveHealthScore = Math.max(0, Math.min(100, 100 - leakPenalty));

    let status: 'passed' | 'warning' | 'failed' = 'passed';
    const recommendations: string[] = [];

    if (interactiveLeakedBytes > 2 * 1024 * 1024) {
      status = 'failed';
      recommendations.push(`Critical heap retention (${formatBytes(interactiveLeakedBytes)}) triggered by button action. Inspect event listeners and uncollected DOM nodes.`);
    } else if (interactiveLeakedBytes > 50 * 1024) {
      status = 'warning';
      recommendations.push(`Noticeable memory retention (${formatBytes(interactiveLeakedBytes)}) detected after button interaction.`);
    } else {
      recommendations.push('Clean GC cycle achieved. No significant persistent memory leaks detected after interaction.');
    }

    if (domNodeCount > 2000) {
      recommendations.push(`High DOM element density (${domNodeCount} nodes). Consider virtualization or DOM pruning.`);
    }

    const responseData: ScanResult = {
      url,
      baselineHeapBytes,
      interactiveHeapBytes,
      passiveLeakedBytes: baselineHeapBytes,
      interactiveLeakedBytes,
      formattedPassiveLeakedBytes: formatBytes(baselineHeapBytes),
      formattedInteractiveLeakedBytes: formatBytes(interactiveLeakedBytes),
      actionTestedDescription,
      passiveHealthScore,
      interactiveHealthScore,
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