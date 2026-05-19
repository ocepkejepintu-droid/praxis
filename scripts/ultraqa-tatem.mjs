import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const outDir = process.argv[2] || '.omx/artifacts/tatem-redesign/ultraqa';
const routes = ['/', '/actions', '/ideas', '/experiments', '/repos', '/radar', '/ingestion'];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
mkdirSync(outDir, { recursive: true });
const port = 9800 + Math.floor(Math.random() * 300);
const userData = mkdtempSync(join(tmpdir(), 'ar-ultraqa-chrome-'));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${userData}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (url) => fetch(url).then((response) => response.json());
const slug = (route) => route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-');
const failures = [];
const results = [];
function assert(condition, message, details = {}) {
  if (!condition) failures.push({ message, details });
}
try {
  for (let i = 0; i < 80; i += 1) { try { await json(`http://127.0.0.1:${port}/json/list`); break; } catch { await wait(100); } }
  const page = (await json(`http://127.0.0.1:${port}/json/list`)).find((item) => item.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const consoleEvents = [];
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
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.method === 'Runtime.consoleAPICalled') consoleEvents.push(JSON.stringify(msg.params).slice(0, 500));
    if (msg.method === 'Log.entryAdded') consoleEvents.push(JSON.stringify(msg.params.entry).slice(0, 500));
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  for (const viewport of viewports) {
    for (const route of routes) {
      consoleEvents.length = 0;
      await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile });
      await send('Page.navigate', { url: `${baseUrl}${route}` });
      await wait(1200);
      const evaluation = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify((()=>{
        const nav=document.querySelector('nav[aria-label="Primary navigation"]');
        const active=nav?.querySelector('a[aria-current="page"]');
        const offenders=[];
        for (const el of document.querySelectorAll('body *')) {
          const style=getComputedStyle(el); const rect=el.getBoundingClientRect();
          if (style.display==='none'||style.visibility==='hidden'||rect.width<1||rect.height<1) continue;
          if (el.closest('.topnav')||el.closest('.filterBar')||el.closest('.tablePanel')) continue;
          if (rect.left < -1 || rect.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1) offenders.push({tag:el.tagName, cls:String(el.className), text:(el.textContent||'').trim().slice(0,80), left:Math.round(rect.left), right:Math.round(rect.right), scrollWidth:el.scrollWidth, clientWidth:el.clientWidth});
        }
        const leaks=[...document.querySelectorAll('details:not([open]) > :not(summary)')].filter(el=>{ const s=getComputedStyle(el); const r=el.getBoundingClientRect(); return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0; }).map(el=>(el.textContent||'').trim().slice(0,80));
        const visibleText=document.body.innerText;
        return {route:'${route}', viewport:'${viewport.name}', mainVisible:!!document.querySelector('main#main'), navVisible:!!nav, activeCount:nav?.querySelectorAll('a[aria-current="page"]').length||0, activeHref:active?.getAttribute('href'), docWidth:document.documentElement.scrollWidth, innerWidth, bodyWidth:document.body.scrollWidth, overflowOffenders:offenders.slice(0,10), closedDetailsLeaks:leaks, secretLeak:visibleText.toLowerCase().includes('/users/yoseph'), badLiteral:['undefined','null','NaN','[object Object]'].some((word)=>visibleText.includes(word)), navMetrics: nav ? (()=>{ const rect=nav.getBoundingClientRect(); nav.scrollLeft=nav.scrollWidth; const last=nav.querySelector('a:last-child')?.getBoundingClientRect(); return {position:getComputedStyle(nav).position, left:Math.round(rect.left), right:Math.round(rect.right), bottomGap:Math.round(innerHeight-rect.bottom), linkCount:nav.querySelectorAll('a').length, lastRightAfterScroll:last&&Math.round(last.right), navRight:Math.round(rect.right), linkHeights:[...nav.querySelectorAll('a')].map(a=>Math.round(a.getBoundingClientRect().height))}; })() : null };
      })())` });
      if (typeof evaluation.result?.value !== 'string') { throw new Error(`Runtime evaluation failed for ${viewport.name} ${route}: ${JSON.stringify(evaluation).slice(0,1000)}`); }
      const data = JSON.parse(evaluation.result.value);
      assert(data.mainVisible, `${viewport.name} ${route}: main missing`, data);
      assert(data.navVisible, `${viewport.name} ${route}: nav missing`, data);
      assert(data.activeCount === 1, `${viewport.name} ${route}: active nav count not 1`, data);
      assert(data.activeHref === route, `${viewport.name} ${route}: active href mismatch`, data);
      assert(data.docWidth <= data.innerWidth + 1, `${viewport.name} ${route}: document horizontal overflow`, data);
      assert(data.overflowOffenders.length === 0, `${viewport.name} ${route}: element overflow`, data);
      assert(data.closedDetailsLeaks.length === 0, `${viewport.name} ${route}: closed details leak`, data);
      assert(!data.secretLeak, `${viewport.name} ${route}: local absolute path leaked`, data);
      assert(!data.badLiteral, `${viewport.name} ${route}: undefined/null/NaN literal visible`, data);
      const badConsole = consoleEvents.filter((text) => /(same key|unique key|hydration|validateDOMNesting|Minified React error|pageerror)/i.test(text));
      assert(badConsole.length === 0, `${viewport.name} ${route}: React/runtime console failure`, { badConsole });
      if (viewport.mobile) {
        assert(data.navMetrics.position === 'fixed', `${viewport.name} ${route}: mobile nav not fixed`, data.navMetrics);
        assert(data.navMetrics.left >= 0 && data.navMetrics.right <= viewport.width, `${viewport.name} ${route}: mobile nav offscreen`, data.navMetrics);
        assert(data.navMetrics.linkHeights.every((h) => h >= 36), `${viewport.name} ${route}: mobile tap target too short`, data.navMetrics);
        assert(data.navMetrics.lastRightAfterScroll <= data.navMetrics.navRight + 1, `${viewport.name} ${route}: last nav item unreachable`, data.navMetrics);
      }
      const detailsOpen = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify((()=>{ const summaries=[...document.querySelectorAll('details summary')].slice(0,3); summaries.forEach(s=>s.click()); return {docWidth:document.documentElement.scrollWidth, openCount:document.querySelectorAll('details[open]').length}; })())` });
      const opened = JSON.parse(detailsOpen.result.value);
      assert(opened.docWidth <= viewport.width + 1, `${viewport.name} ${route}: details opened overflow`, opened);
      const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const base = `${outDir}/${slug(route)}-${viewport.name}`;
      writeFileSync(`${base}.png`, Buffer.from(screenshot.data, 'base64'));
      writeFileSync(`${base}.json`, `${JSON.stringify({ ...data, opened }, null, 2)}\n`);
      results.push({ route, viewport: viewport.name, status: 'checked', screenshot: `${base}.png`, data });
    }
  }
  ws.close();
} finally {
  proc.kill('SIGTERM');
  setTimeout(() => { try { rmSync(userData, { recursive: true, force: true }); } catch {} }, 250);
}
writeFileSync(`${outDir}/results.json`, `${JSON.stringify({ failures, results }, null, 2)}\n`);
if (failures.length) {
  console.error(JSON.stringify({ status: 'fail', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'pass', checked: results.length, outDir }, null, 2));
