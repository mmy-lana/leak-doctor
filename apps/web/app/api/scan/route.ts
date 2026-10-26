/* cspell:disable */
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { formatBytes } from '@leak-doctor/shared';

export interface InteractionRule {
  type: 'text' | 'selector' | 'xpath';
  value: string;
}

export interface ScanResult {
  url: string;
  baselineHeapBytes: number;
  interactiveHeapBytes: number;
  // BUG-005: the misleading `passiveLeakedBytes` field (which duplicated the
  // baseline heap size) has been removed — use `baselineHeapBytes` instead.
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

// --- SEC-001: target-URL guard -------------------------------------------------
// Only public http(s) hosts may be scanned. Hostnames are resolved and rejected if
// any address is loopback/private/link-local/cloud-metadata/reserved (IPv4 + IPv6,
// including IPv4-mapped and IPv4-compatible forms).
// -------------------------------------------------------------------------------

const LOOPBACK_HOSTNAMES = (hostname: string): boolean =>
  hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local');

function isBlockedAddress(address: string): boolean {
  let ip = address.trim().toLowerCase();
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);

  if (ip.includes(':')) {
    // IPv4 embedded in IPv6, dotted form (e.g. ::ffff:127.0.0.1, ::127.0.0.1)
    const tail = ip.slice(ip.lastIndexOf(':') + 1);
    if (tail.includes('.') && isIP(tail) === 4) return isBlockedAddress(tail);
    // IPv4 embedded in IPv6, hex form (e.g. ::ffff:7f00:1 -> 127.0.0.1)
    const hexMapped = ip.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isBlockedAddress(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
    }
    if (ip === '::' || ip === '::1') return true; // unspecified / loopback
    if (/^f[cd]/.test(ip)) return true; // unique-local fc00::/7
    if (/^fe[89ab]/.test(ip)) return true; // link-local fe80::/10
    if (ip.startsWith('ff')) return true; // multicast ff00::/8
    if (ip.startsWith('2001:db8')) return true; // documentation range
    return isIP(ip) !== 6; // unparseable -> block
  }

  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, 192.0.2.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 documentation
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 documentation
    if (a >= 224) return true; // multicast + reserved + broadcast
    return false;
  }

  return true; // unparseable address -> block
}

async function isPermittedHttpUrl(rawUrl: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || LOOPBACK_HOSTNAMES(hostname)) return null;

  if (isIP(hostname) !== 0) {
    return isBlockedAddress(hostname) ? null : parsed;
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return null;
    for (const { address } of addresses) {
      if (isBlockedAddress(address)) return null;
    }
  } catch {
    return null; // DNS failure -> do not scan
  }
  return parsed;
}

// --- SEC-002: never weaken the browser sandbox or same-origin policy -----------
// Production (@sparticuz/chromium on the deployed Linux host) must NOT process
// untrusted pages with a disabled sandbox or disabled web security, even though
// @sparticuz/chromium's defaults include those flags for Lambda. They are filtered.
//
// Local development (`next dev`) uses the system Chrome binary on the developer's
// own machine, which cannot initialize a renderer under puppeteer without
// `--no-sandbox` (verified: bare launch args fail with "Requesting main frame too
// early!"; only flag sets containing --no-sandbox resolve). This exception is
// confined to NODE_ENV === 'development' and never applies to the deployed scanner.
// -------------------------------------------------------------------------------

const UNSAFE_CHROMIUM_ARGS = new Set([
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--no-zygote',
  '--single-process',
  '--disable-web-security',
  '--allow-running-insecure-content',
  '--disable-site-isolation-trials',
]);
const SITE_ISOLATION_FEATURES = new Set(['IsolateOrigins', 'site-per-process']);
const DEV_CHROMIUM_ARGS = ['--no-sandbox']; // macOS system-Chrome launch requirement (dev only)

function sanitizeChromiumArgs(rawArgs: string[]): string[] {
  const sanitized: string[] = [];
  for (const arg of rawArgs) {
    const flag = arg.split('=')[0];
    if (UNSAFE_CHROMIUM_ARGS.has(flag)) continue;
    if (flag === '--disable-features') {
      const kept = arg
        .slice('--disable-features='.length)
        .split(',')
        .filter((feature) => feature && !SITE_ISOLATION_FEATURES.has(feature));
      if (kept.length > 0) sanitized.push(`--disable-features=${kept.join(',')}`);
      continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}

// --- SEC-003: abuse resistance -------------------------------------------------
// Per-IP rate limiting, a global concurrency cap, and a per-request time budget
// for browser/CDP work. NOTE: counters are in-memory and therefore per serverless
// instance; a multi-instance deployment should back them with a shared store.
// -------------------------------------------------------------------------------

const SCAN_RATE_WINDOW_MS = 60_000;
const MAX_SCANS_PER_WINDOW_PER_IP = 6;
const MAX_CONCURRENT_SCANS = 2;
const SCAN_BUDGET_MS = 45_000;

let activeScans = 0;
const rateHits = new Map<string, { count: number; windowStart: number }>();

function clientIp(request: Request): string {
  // x-real-ip is set by the deployment proxy; x-forwarded-for's LAST entry is the
  // address the trusted proxy observed (client-supplied prefixes are spoofable).
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    return parts[parts.length - 1].trim();
  }
  return 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateHits.get(ip);
  if (!entry || now - entry.windowStart > SCAN_RATE_WINDOW_MS) {
    if (rateHits.size > 1000) {
      for (const [key, value] of rateHits) {
        if (now - value.windowStart > SCAN_RATE_WINDOW_MS) rateHits.delete(key);
      }
    }
    rateHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SCANS_PER_WINDOW_PER_IP;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let blockedNavigation: string | null = null;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: 'Too many scan requests. Please retry in a minute.', requestId },
      { status: 429 }
    );
  }
  if (activeScans >= MAX_CONCURRENT_SCANS) {
    return NextResponse.json(
      { error: 'Scanner is at capacity. Please retry shortly.', requestId },
      { status: 429 }
    );
  }
  activeScans += 1;

  try {
    const { url, interactions, autoClick = true } = (await request.json()) as {
      url: string;
      interactions?: InteractionRule[];
      autoClick?: boolean;
    };

    let target: URL | null = null;
    if (url && typeof url === 'string') {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') target = parsed;
      } catch {
        target = null;
      }
    }
    if (!target) {
      return NextResponse.json({ error: 'Valid URL starting with http:// or https:// is required.' }, { status: 400 });
    }
    if (!(await isPermittedHttpUrl(target.href))) {
      return NextResponse.json(
        { error: 'Target host is not permitted: only public http(s) hosts can be audited.' },
        { status: 403 }
      );
    }

    const isLocal = process.env.NODE_ENV === 'development';
    const executablePath = isLocal
      ? process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...(isLocal ? DEV_CHROMIUM_ARGS : sanitizeChromiumArgs(chromium.args)),
        '--enable-precise-memory-info',
        '--js-flags=--expose-gc',
      ],
      defaultViewport: { width: 1280, height: 720 },
      executablePath,
      headless: true,
      protocolTimeout: SCAN_BUDGET_MS,
    });

    const page = await browser.newPage();
    const client = await page.createCDPSession();

    // SEC-001: re-validate every request (redirects and subresources included) so a
    // scanned page cannot reach loopback/private/metadata hosts through any hop.
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      try {
        let parsed: URL | null = null;
        try {
          parsed = new URL(req.url());
        } catch {
          parsed = null;
        }
        const isHttp = parsed !== null && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
        if (isHttp && (await isPermittedHttpUrl(req.url())) !== null) {
          await req.continue();
          return;
        }
        if (req.isNavigationRequest()) {
          blockedNavigation = req.url();
          await req.abort('blockedbyclient');
        } else if (isHttp) {
          await req.abort('blockedbyclient');
        } else {
          await req.continue(); // data:/blob: etc. — no network reach
        }
      } catch {
        await req.abort('blockedbyclient').catch(() => undefined);
      }
    });

    await page.goto(target.href, { waitUntil: 'networkidle2', timeout: 30000 });

		await client.send('HeapProfiler.enable');

    // 1. Force GC & Capture Baseline (Do Nothing)
    await client.send('HeapProfiler.collectGarbage');
    const baselineHeapBytes = (await page.evaluate(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return mem && mem.usedJSHeapSize > 0 ? mem.usedJSHeapSize : 0;
    })) as number;

    let actionTestedDescription = 'No button interactions executed';

    // 2. Interactive Phase: Custom Rules or Automatic Multi-Component Discovery
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
    } else if (autoClick !== false) {
      const multiClickResult = (await page.evaluate(async () => {
        const isVisible = (el: HTMLElement) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return (
            rect.width > 8 &&
            rect.height > 8 &&
            el.offsetParent !== null &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0'
          );
        };

        const selectors = [
          'button:not([disabled])',
          '[role="button"]',
          'summary',
          '[aria-haspopup="dialog"]',
          '[aria-expanded]',
          'a[role="button"]',
        ];

        const candidates = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(','))).filter(
          isVisible
        );

        if (candidates.length === 0) {
          return 'No interactive components detected on page';
        }

        const countToTest = Math.min(candidates.length, Math.max(3, Math.min(5, candidates.length)));
        const shuffled = [...candidates].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, countToTest);

        const testedSummaries: string[] = [];
        for (let i = 0; i < selected.length; i++) {
          const target = selected[i];
          const rawLabel =
            target.textContent?.trim().replace(/\s+/g, ' ') ||
            target.getAttribute('aria-label') ||
            target.getAttribute('title') ||
            target.tagName.toLowerCase();
          const label = rawLabel.length > 28 ? `${rawLabel.substring(0, 28)}...` : rawLabel;

          try {
            target.click();
            testedSummaries.push(`"${label}" (<${target.tagName.toLowerCase()}>)`);
          } catch {
            // Suppress individual component click failures
          }

          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        return `Automatically tested ${testedSummaries.length} interactive control(s): ${testedSummaries.join(', ')}`;
      })) as string;

      actionTestedDescription = multiClickResult;
    } else {
      actionTestedDescription = 'No interactions executed (auto-click explicitly disabled)';
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));

    // 3. Force GC & Measure Post-Interactive Heap
    await client.send('HeapProfiler.collectGarbage');

    const interactiveHeapBytes = (await page.evaluate(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return mem && mem.usedJSHeapSize > 0 ? mem.usedJSHeapSize : 0;
    })) as number;

    const domNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);

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
    if (blockedNavigation) {
      return NextResponse.json(
        { error: 'Scan aborted: the page attempted to reach a non-public address.', requestId },
        { status: 403 }
      );
    }
    // SEC-006: never reflect internal error details to the client; log them with the
    // correlation id server-side and return a generic message.
    console.error(`[scan:${requestId}] headless memory scan failed:`, err);
    return NextResponse.json(
      { error: 'Headless memory scanning failed. Please try again.', requestId },
      { status: 500 }
    );
  } finally {
    // SEC-005: always release the browser and the concurrency slot, on every path.
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    activeScans = Math.max(0, activeScans - 1);
  }
}