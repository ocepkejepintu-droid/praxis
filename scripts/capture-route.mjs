import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const [, , route = '/repos', outDir = '.omx/artifacts/visual-ralph/repos-fix'] = process.argv;
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(outDir, { recursive: true });
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=9225', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (url) => fetch(url).then((r) => r.json());
for (let i = 0; i < 60; i += 1) { try { await json('http://127.0.0.1:9225/json/list'); break; } catch { await wait(100); } }
const page = (await json('http://127.0.0.1:9225/json/list')).find((item) => item.type === 'page');
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
for (const item of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  await send('Emulation.setDeviceMetricsOverride', { width: item.width, height: item.height, deviceScaleFactor: 1, mobile: item.width < 720 });
  await send('Page.navigate', { url: `http://127.0.0.1:3000${route}` });
  await wait(900);
  const metrics = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyScrollWidth:document.body.scrollWidth,cards:document.querySelectorAll('.repoWatchCard').length,table:!!document.querySelector('table'),errors:[...document.querySelectorAll('nextjs-portal')].length})` });
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(`${outDir}/${item.name}.png`, Buffer.from(screenshot.data, 'base64'));
  writeFileSync(`${outDir}/${item.name}.json`, `${metrics.result.value}\n`);
  console.log(`${item.name}: ${metrics.result.value}`);
}
ws.close();
proc.kill('SIGTERM');
