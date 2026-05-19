import { spawn } from 'node:child_process';
const route = process.argv[2] || '/experiments';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9227', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (url) => fetch(url).then((r) => r.json());
for (let i=0;i<60;i++){try{await json('http://127.0.0.1:9227/json/list');break;}catch{await wait(100)}}
const page=(await json('http://127.0.0.1:9227/json/list')).find(x=>x.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0;
function send(method,params={}){const call=++id; ws.send(JSON.stringify({id:call,method,params})); return new Promise((res,rej)=>{function f(e){const m=JSON.parse(e.data.toString()); if(m.id!==call)return; ws.removeEventListener('message',f); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)} ws.addEventListener('message',f)})}
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await send('Page.navigate',{url:`http://127.0.0.1:3000${route}`}); await wait(900);
const result=await send('Runtime.evaluate',{returnByValue:true,expression:`JSON.stringify((()=>{
 const nav=document.querySelector('.topnav')?.getBoundingClientRect();
 const bad=[];
 for(const el of document.querySelectorAll('body *')){
  const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
  if(r.width<1||r.height<1) continue;
  const horiz=el.scrollWidth>el.clientWidth+1;
  const underNav=nav && r.top<nav.bottom && r.bottom>nav.top && !el.closest('.topnav') && (el.matches('.experimentCard, .experimentCard *'));
  if(horiz||underNav){bad.push({tag:el.tagName, cls:el.className, text:(el.textContent||'').trim().slice(0,80), rect:{top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)}, scrollWidth:el.scrollWidth, clientWidth:el.clientWidth, overflow:cs.overflow, underNav});}
 }
 return {viewport:{innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}, nav, bad:bad.slice(0,80)}
})())`});
console.log(result.result.value);
ws.close(); proc.kill('SIGTERM');
