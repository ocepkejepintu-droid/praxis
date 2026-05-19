import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outDir = process.argv[2] || '.omx/artifacts/visual-ralph/agent-radar-maturity/cdp';
mkdirSync(outDir, { recursive: true });

const proc = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=9223',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

async function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function json(url) { return fetch(url).then((r) => r.json()); }
async function waitForDebug() {
  for (let i = 0; i < 60; i += 1) {
    try { return await json('http://127.0.0.1:9223/json/version'); } catch { await wait(100); }
  }
  throw new Error('Chrome debug port not ready');
}

let id = 0;
function send(ws, method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => {
    function onMessage(event) {
      const msg = JSON.parse(event.data.toString());
      if (msg.id !== callId) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    }
    ws.addEventListener('message', onMessage);
  });
}

async function capture(ws, { name, width, height, path }) {
  await send(ws, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 720,
  });
  await send(ws, 'Page.navigate', { url: `http://127.0.0.1:3000${path}` });
  await wait(900);
  const metrics = await send(ws, 'Runtime.evaluate', {
    expression: `JSON.stringify({innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, bodyScrollWidth: document.body.scrollWidth, title: document.title})`,
    returnByValue: true,
  });
  const screenshot = await send(ws, 'Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  writeFileSync(`${outDir}/${name}.json`, `${metrics.result.value}\n`);
  console.log(`${name}: ${metrics.result.value}`);
}

try {
  await waitForDebug();
  const pages = await json('http://127.0.0.1:9223/json/list');
  const page = pages.find((item) => item.type === 'page') || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  await send(ws, 'Page.enable');
  for (const item of [
    { name: 'desktop-home', width: 1440, height: 1000, path: '/' },
    { name: 'mobile-home', width: 390, height: 844, path: '/' },
    { name: 'desktop-ideas', width: 1440, height: 1000, path: '/ideas' },
    { name: 'mobile-ideas', width: 390, height: 844, path: '/ideas' },
    { name: 'desktop-experiments', width: 1440, height: 1000, path: '/experiments' },
    { name: 'mobile-experiments', width: 390, height: 844, path: '/experiments' },
  ]) await capture(ws, item);
  ws.close();
} finally {
  proc.kill('SIGTERM');
}
