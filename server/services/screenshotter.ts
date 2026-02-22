import puppeteer, { Browser } from 'puppeteer-core';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import logger from './logger';

let cachedChromePath: string | null | undefined;

/** Find Chrome or Edge on the system */
function findChromePath(): string | null {
  if (cachedChromePath !== undefined) return cachedChromePath;

  // Environment variable override
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    cachedChromePath = process.env.CHROME_PATH;
    return cachedChromePath;
  }

  const candidates: string[] = [];

  if (process.platform === 'win32') {
    const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA'] || '';
    candidates.push(
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${local}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    // Linux — try which
    try {
      const found = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { encoding: 'utf-8' }).trim();
      if (found) { cachedChromePath = found; return found; }
    } catch { /* not found */ }
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      cachedChromePath = p;
      return p;
    }
  }

  cachedChromePath = null;
  return null;
}

let browserInstance: Browser | null = null;
let browserCloseTimer: ReturnType<typeof setTimeout> | null = null;
const BROWSER_IDLE_MS = 30_000; // Close browser after 30s of inactivity

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    // Reset idle timer
    if (browserCloseTimer) { clearTimeout(browserCloseTimer); browserCloseTimer = null; }
    scheduleBrowserClose();
    return browserInstance;
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error('Chrome/Edge not found. Set CHROME_PATH environment variable.');
  }

  browserInstance = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  scheduleBrowserClose();
  return browserInstance;
}

function scheduleBrowserClose() {
  browserCloseTimer = setTimeout(async () => {
    if (browserInstance) {
      try { await browserInstance.close(); } catch { /* ignore */ }
      browserInstance = null;
    }
    browserCloseTimer = null;
  }, BROWSER_IDLE_MS);
}

/**
 * Take a screenshot of a URL. Returns a base64-encoded JPEG string.
 */
export async function takeScreenshot(url: string, opts?: { width?: number; height?: number }): Promise<string> {
  const width = opts?.width || 1280;
  const height = opts?.height || 900;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15_000 });
    // Small extra wait for JS-rendered content
    await new Promise(r => setTimeout(r, 500));

    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } finally {
    await page.close().catch(() => {});
  }
}

/** Element bounding box collected from the page */
export interface ElementBox {
  tag: string;
  selector: string;
  text: string;
  classes: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface ElementPickerResult {
  screenshot: string;
  elements: ElementBox[];
  pageWidth: number;
  pageHeight: number;
}

/**
 * Take a screenshot and collect bounding boxes of visible interactive/content elements.
 */
export async function takeScreenshotWithElements(
  url: string,
  opts?: { width?: number; height?: number },
): Promise<ElementPickerResult> {
  const width = opts?.width || 1280;
  const height = opts?.height || 900;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15_000 });
    await new Promise(r => setTimeout(r, 500));

    // Collect visible element bounding boxes (string eval — DOM types not in server tsconfig)
    type EvalResult = { elements: ElementBox[]; pageWidth: number; pageHeight: number };
    const { elements, pageWidth, pageHeight } = await page.evaluate(`(function() {
      var SELECTORS = 'a, button, input, select, textarea, img, h1, h2, h3, h4, h5, h6, p, li, span, div, section, nav, header, footer, form, table, td, th, label, [role]';
      var allEls = document.querySelectorAll(SELECTORS);
      var scrollY = window.scrollY;
      var result = [];

      function getUniqueSelector(el) {
        if (el.id) return '#' + el.id;
        var parts = [];
        var current = el;
        var depth = 0;
        while (current && current !== document.body && depth < 5) {
          var tag = current.tagName.toLowerCase();
          var parent = current.parentElement;
          if (parent) {
            var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === current.tagName; });
            if (siblings.length > 1) {
              var idx = siblings.indexOf(current) + 1;
              parts.unshift(tag + ':nth-of-type(' + idx + ')');
            } else {
              parts.unshift(tag);
            }
          } else {
            parts.unshift(tag);
          }
          current = parent;
          depth++;
        }
        return parts.join(' > ');
      }

      allEls.forEach(function(el) {
        if (result.length >= 500) return;
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (el.offsetWidth < 8 || el.offsetHeight < 8) return;

        var rect = el.getBoundingClientRect();
        var absRect = { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height };
        if (absRect.x + absRect.width < 0 || absRect.x > window.innerWidth) return;

        var text = (el.innerText || el.getAttribute('alt') || el.getAttribute('placeholder') || '').trim().substring(0, 80);
        result.push({
          tag: el.tagName.toLowerCase(),
          selector: getUniqueSelector(el),
          text: text,
          classes: el.className && typeof el.className === 'string' ? el.className.split(/\\s+/).slice(0, 3).join(' ') : '',
          rect: absRect,
        });
      });

      return { elements: result, pageWidth: window.innerWidth, pageHeight: document.documentElement.scrollHeight };
    })()`) as EvalResult;

    const buffer = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true });
    const base64 = Buffer.from(buffer).toString('base64');

    return { screenshot: base64, elements, pageWidth, pageHeight };
  } finally {
    await page.close().catch(() => {});
  }
}

/** Check if screenshot capability is available (Chrome found) */
export function isAvailable(): boolean {
  return findChromePath() !== null;
}
