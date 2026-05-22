#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  renameSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const requireFromCwd = createRequire(path.join(cwd, 'package.json'));

function usage() {
  console.error('Usage: node record_website_demo.mjs --config path/to/demo.json');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--config') {
      args.config = argv[++i];
    }
  }
  return args;
}

function loadPlaywright() {
  try {
    return requireFromCwd('playwright');
  } catch {
    const requireHere = createRequire(import.meta.url);
    return requireHere('playwright');
  }
}

const args = parseArgs(process.argv);
if (!args.config) {
  usage();
  process.exit(1);
}

const configPath = path.resolve(cwd, args.config);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const baseUrl = config.url;
if (!baseUrl) {
  throw new Error('Config must include "url".');
}

const output = path.resolve(cwd, config.output || 'recordings/website-demo.mp4');
const outputDir = path.dirname(output);
const rawWebm = output.replace(/\.mp4$/i, '.raw.webm');
const viewport = {
  width: config.viewport?.width || 1440,
  height: config.viewport?.height || 920
};
const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshotFiles(files = []) {
  return files.map((file) => {
    const absolute = path.resolve(cwd, file);
    return {
      absolute,
      existed: existsSync(absolute),
      content: existsSync(absolute) ? readFileSync(absolute, 'utf8') : ''
    };
  });
}

function restoreFiles(snapshots) {
  for (const item of snapshots) {
    if (item.existed) {
      writeFileSync(item.absolute, item.content);
    } else if (existsSync(item.absolute)) {
      rmSync(item.absolute, { recursive: true, force: true });
    }
  }
}

async function ensureUrl(url) {
  const response = await fetch(url).catch(() => null);
  if (!response || response.status >= 500) {
    throw new Error(`Target URL is not reachable: ${url}`);
  }
}

async function installDemoOverlay(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      [data-demo-cursor] {
        position: fixed; left: 80px; top: 120px; width: 30px; height: 30px;
        z-index: 10001; pointer-events: none; border: 3px solid #fff;
        border-radius: 50%; background: rgba(47, 107, 79, .96);
        box-shadow: 0 8px 22px rgba(0, 0, 0, .32);
        transform: translate(-50%, -50%);
        transition: left .52s ease, top .52s ease, transform .18s ease;
      }
      [data-demo-highlight] {
        position: fixed; z-index: 9998; pointer-events: none;
        border: 3px solid #f4c16b; border-radius: 10px;
        box-shadow: 0 0 0 9999px rgba(18, 51, 38, .08);
        transition: opacity .12s ease, left .04s linear, top .04s linear, width .04s linear, height .04s linear;
      }
      [data-demo-ripple] {
        position: fixed; z-index: 10000; width: 20px; height: 20px;
        border-radius: 50%; border: 4px solid #f4c16b; pointer-events: none;
        transform: translate(-50%, -50%) scale(.4);
        animation: demoRipple .72s ease-out forwards;
      }
      @keyframes demoRipple {
        to { opacity: 0; transform: translate(-50%, -50%) scale(3.2); }
      }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.setAttribute('data-demo-cursor', 'true');
    document.body.appendChild(cursor);

    const highlight = document.createElement('div');
    highlight.setAttribute('data-demo-highlight', 'true');
    highlight.style.opacity = '0';
    document.body.appendChild(highlight);

    window.__demoOverlay = {
      cursor,
      highlight,
      target: null,
      raf: 0,
      setCursor(x, y) {
        this.cursor.style.left = `${x}px`;
        this.cursor.style.top = `${y}px`;
      },
      track(element) {
        this.target = element;
        if (!this.raf) this.tick();
      },
      tick() {
        if (this.target && document.documentElement.contains(this.target)) {
          const rect = this.target.getBoundingClientRect();
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth;
          if (visible) {
            this.highlight.style.left = `${Math.max(8, rect.left - 6)}px`;
            this.highlight.style.top = `${Math.max(8, rect.top - 6)}px`;
            this.highlight.style.width = `${Math.max(24, rect.width + 12)}px`;
            this.highlight.style.height = `${Math.max(24, rect.height + 12)}px`;
            this.highlight.style.opacity = '1';
          } else {
            this.highlight.style.opacity = '0';
          }
        } else {
          this.highlight.style.opacity = '0';
        }
        this.raf = requestAnimationFrame(() => this.tick());
      },
      clear() {
        this.target = null;
        this.highlight.style.opacity = '0';
      },
      ripple(x, y) {
        const ripple = document.createElement('div');
        ripple.setAttribute('data-demo-ripple', 'true');
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 760);
      },
      pressCursor() {
        this.cursor.style.transform = 'translate(-50%, -50%) scale(.78)';
        setTimeout(() => {
          this.cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 180);
      }
    };
  });
}

async function showCaption(page, text) {
  if (!text) return;
  await page.evaluate((caption) => {
    let node = document.querySelector('[data-demo-caption]');
    if (!node) {
      node = document.createElement('div');
      node.setAttribute('data-demo-caption', 'true');
      Object.assign(node.style, {
        position: 'fixed',
        left: '50%',
        top: '92px',
        zIndex: '9999',
        transform: 'translateX(-50%)',
        maxWidth: '820px',
        padding: '14px 20px',
        borderRadius: '8px',
        background: 'rgba(18, 51, 38, 0.94)',
        color: '#fff',
        boxShadow: '0 18px 50px rgba(0, 0, 0, .2)',
        font: '700 18px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif',
        textAlign: 'center',
        pointerEvents: 'none'
      });
      document.body.appendChild(node);
    }
    node.textContent = caption;
  }, text);
}

function targetLocator(page, target) {
  if (target.selector) {
    return page.locator(target.selector).nth(target.index || 0);
  }
  if (target.role) {
    return page.getByRole(target.role, { name: target.name }).nth(target.index || 0);
  }
  if (target.text) {
    return page.getByText(target.text, { exact: Boolean(target.exact) }).nth(target.index || 0);
  }
  throw new Error(`Unsupported target: ${JSON.stringify(target)}`);
}

async function hideHighlight(page) {
  await page.evaluate(() => window.__demoOverlay?.clear());
}

async function moveCursorTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await delay(350);
  const rect = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  await page.evaluate((point) => window.__demoOverlay.setCursor(point.x, point.y), { x, y });
  await page.mouse.move(x, y, { steps: 20 });
  await delay(620);
  return { x, y };
}

async function trackHighlight(page, locator) {
  await locator.evaluate((element) => window.__demoOverlay.track(element));
}

async function clickWithIndicator(page, locator, waitAfter = 850) {
  const point = await moveCursorTo(page, locator);
  await trackHighlight(page, locator);
  await page.evaluate(({ x, y }) => {
    window.__demoOverlay.pressCursor();
    window.__demoOverlay.ripple(x, y);
  }, point);
  await delay(180);
  await locator.click();
  await delay(waitAfter);
}

async function typeSlowly(page, locator, text, delayMs = 74) {
  await clickWithIndicator(page, locator, 260);
  await page.keyboard.type(text, { delay: delayMs });
  await delay(520);
}

async function replaceSlowly(page, locator, text, delayMs = 76) {
  await clickWithIndicator(page, locator, 260);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await delay(180);
  await page.keyboard.press('Backspace');
  await delay(220);
  if (text) await page.keyboard.type(text, { delay: delayMs });
  await delay(700);
}

async function selectWithIndicator(page, locator, value) {
  await clickWithIndicator(page, locator, 220);
  await locator.selectOption(value);
  await delay(1000);
}

async function scrollTo(page, selector, caption) {
  await hideHighlight(page);
  await showCaption(page, caption);
  await page.evaluate(async (targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    const start = window.scrollY;
    const end = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 96);
    const distance = Math.abs(end - start);
    const duration = Math.min(2600, Math.max(1300, distance * 0.65));
    const startedAt = performance.now();
    await new Promise((resolve) => {
      function step(now) {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, start + (end - start) * eased);
        if (progress < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }, selector);
  await delay(900);
}

async function runAction(page, action) {
  if (action.caption) await showCaption(page, action.caption);
  if (action.wait) await delay(action.wait);
  if (action.scroll) await scrollTo(page, action.scroll, action.caption);
  if (action.click) {
    const locator = targetLocator(page, action.click);
    const clickTask = clickWithIndicator(page, locator, action.waitAfter || 850);
    if (action.waitForResponseIncludes) {
      await Promise.all([
        page.waitForResponse((res) => res.url().includes(action.waitForResponseIncludes)),
        clickTask
      ]);
    } else {
      await clickTask;
    }
  }
  if (action.type) {
    await typeSlowly(page, targetLocator(page, action.type), action.type.text || '', action.type.delay);
  }
  if (action.replace) {
    await replaceSlowly(
      page,
      targetLocator(page, action.replace),
      action.replace.text || '',
      action.replace.delay
    );
  }
  if (action.select) {
    await selectWithIndicator(page, targetLocator(page, action.select), action.select.value);
  }
  if (action.press) {
    await page.keyboard.press(action.press);
    await delay(action.waitAfter || 300);
  }
}

async function main() {
  await ensureUrl(baseUrl);
  mkdirSync(outputDir, { recursive: true });
  for (const file of [rawWebm, output]) {
    if (existsSync(file)) rmSync(file);
  }
  const snapshots = snapshotFiles(config.restoreFiles || []);
  const { chromium } = loadPlaywright();
  const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));

  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
  });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: config.locale || 'zh-CN',
    recordVideo: { dir: outputDir, size: viewport }
  });
  const page = await context.newPage();
  const video = page.video();

  await page.goto(baseUrl, { waitUntil: config.waitUntil || 'networkidle' });
  await installDemoOverlay(page);
  for (const action of config.actions || []) {
    await runAction(page, action);
  }

  await context.close();
  await browser.close();
  const generatedWebm = await video.path();
  renameSync(generatedWebm, rawWebm);

  execFileSync(
    'ffmpeg',
    ['-y', '-i', rawWebm, '-vf', 'format=yuv420p', '-movflags', '+faststart', output],
    { stdio: 'inherit' }
  );
  if (!config.keepWebm && existsSync(rawWebm)) rmSync(rawWebm);
  restoreFiles(snapshots);
  console.log(output);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
