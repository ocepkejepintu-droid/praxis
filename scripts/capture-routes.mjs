import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = process.argv[2] || '.omx/artifacts/tatem-redesign/screens';
const routes = (process.argv[3] || '/,/actions,/ideas,/experiments,/repos,/radar,/ingestion').split(',');
mkdirSync(outDir, { recursive: true });
const port = 9500 + Math.floor(Math.random() * 400);
const userData = mkdtempSync(join(tmpdir(), 'ar-chrome-'));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${userData}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (url) => fetch(url).then((r) => r.json());
const slug = (route) => route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-');
try {
  for (let i = 0; i < 80; i += 1) { try { await json(`http://127.0.0.1:${port}/json/list`); break; } catch { await wait(100); } }
  const page = (await json(`http://127.0.0.1:${port}/json/list`)).find((item) => item.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  function send(method, params = {}) {
    const call = ++id;
    ws.send(JSON.stringify({ id: call, method, params }));
    return new Promise((resolve, reject) => {
      function onMessage(event) {
        const msg = JSON.parse(event.data.toString());
        if (msg.id !== call) return;
        ws.removeEventListener('message', onMessage);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
      ws.addEventListener('message', onMessage);
    });
  }
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  await send('Page.enable');
  for (const route of routes) {
    for (const item of [{ name: 'desktop', width: 1440, height: 1000, mobile: false }, { name: 'mobile', width: 390, height: 844, mobile: true }]) {
      await send('Emulation.setDeviceMetricsOverride', { width: item.width, height: item.height, deviceScaleFactor: 1, mobile: item.mobile });
      await send('Page.navigate', { url: `http://127.0.0.1:3000${route}` });
      await wait(900);
      const metrics = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify((()=>{ const nav=document.querySelector('.topnav')?.getBoundingClientRect(); const bad=[]; for(const el of document.querySelectorAll('body *')){ const r=el.getBoundingClientRect(); if(r.width<1||r.height<1) continue; if(el.scrollWidth>el.clientWidth+1 && !el.closest('.topnav') && !el.closest('.filterBar')) bad.push({tag:el.tagName,cls:String(el.className),text:(el.textContent||'').trim().slice(0,60),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}); } return {route:'${route}',innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyScrollWidth:document.body.scrollWidth,nav:nav&&{top:Math.round(nav.top),bottom:Math.round(nav.bottom),height:Math.round(nav.height)},overflowBad:bad.slice(0,20),closedDetailsLeaking:[...document.querySelectorAll('details:not([open]) > :not(summary)')].filter(el=>getComputedStyle(el).display!=='none').length}; })())` });
      const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const base = `${outDir}/${slug(route)}-${item.name}`;
      writeFileSync(`${base}.png`, Buffer.from(screenshot.data, 'base64'));
      writeFileSync(`${base}.json`, `${metrics.result.value}\n`);
      console.log(`${route} ${item.name}: ${metrics.result.value}`);
    }
  }
  ws.close();
} finally {
  proc.kill('SIGTERM');
  setTimeout(() => { try { rmSync(userData, { recursive: true, force: true }); } catch {} }, 250);
}
