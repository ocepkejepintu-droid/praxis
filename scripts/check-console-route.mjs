import { spawn } from 'node:child_process';
const route = process.argv[2] || '/ideas';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9226', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (url) => fetch(url).then((r) => r.json());
for (let i = 0; i < 60; i += 1) { try { await json('http://127.0.0.1:9226/json/list'); break; } catch { await wait(100); } }
const page = (await json('http://127.0.0.1:9226/json/list')).find((item) => item.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const events = [];
function send(method, params = {}) {
  const call = ++id;
  ws.send(JSON.stringify({ id: call, method, params }));
  return new Promise((resolve, reject) => {
    function onMessage(event) {
      const msg = JSON.parse(event.data.toString());
      if (!msg.id) {
        if (msg.method === 'Runtime.consoleAPICalled' || msg.method === 'Log.entryAdded') events.push(msg);
        return;
      }
      if (msg.id !== call) return;
      ws.removeEventListener('message', onMessage);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
    ws.addEventListener('message', onMessage);
  });
}
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data.toString());
  if (msg.method === 'Runtime.consoleAPICalled' || msg.method === 'Log.entryAdded') events.push(msg);
});
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url: `http://127.0.0.1:3000${route}` });
await wait(1500);
const text = events.map((event) => JSON.stringify(event)).join('\n');
const duplicateKey = /same key|Keys should be unique|Non-unique keys/i.test(text);
console.log(JSON.stringify({ route, eventCount: events.length, duplicateKey, snippets: events.slice(0, 5).map((e) => JSON.stringify(e).slice(0, 300)) }, null, 2));
ws.close();
proc.kill('SIGTERM');
process.exit(duplicateKey ? 1 : 0);
