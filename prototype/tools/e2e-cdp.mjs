// Smoke E2E opcional via Chrome DevTools Protocol (Node 22+). Uso: google-chrome --headless=new --remote-debugging-port=9333 & ; node tools/e2e-cdp.mjs
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); let id=0; const pend={}; const errs=[];
ws.onmessage=(m)=>{const d=JSON.parse(m.data); if(d.id&&pend[d.id]){pend[d.id](d.result);delete pend[d.id];} if(d.method==='Runtime.exceptionThrown')errs.push(d.params.exceptionDetails.exception?.description);};
await new Promise(r=>ws.onopen=r);
const C=(method,params={})=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params}));});
const ev=async(e)=>(await C('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result.value;
const sleep=(t)=>new Promise(r=>setTimeout(r,t));
await C('Runtime.enable'); await C('Page.navigate',{url:'http://localhost:8765/index.html'}); await sleep(1500);
const M=(type,x,y,extra={})=>C('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,...extra});
const box=await ev(`(()=>{const r=document.getElementById('canvas').getBoundingClientRect();return [r.left,r.top]})()`);
const [ox,oy]=box; const canvasTop0=oy;
// adicionar LED (placeAt 100,100 → 100,100)
await ev(`document.querySelector('[data-add=led]').click()`); await sleep(100);
const sym=await ev(`document.querySelectorAll('.sym').length`);
// arrastar do pino A (75,100) até (40,150)
await M('mousePressed',ox+75,oy+100); for(let i=1;i<=5;i++){await C('Input.dispatchMouseEvent',{type:'mouseMoved',x:ox+75-7*i,y:oy+100+10*i,button:'left',buttons:1});} await M('mouseReleased',ox+40,oy+150);
await sleep(100);
const w1=await ev(`JSON.stringify([...document.querySelectorAll('polyline.wire')].map(p=>p.getAttribute('points')))`);
const btn1=await ev(`document.getElementById('wireBtn').className`);
// W mode + dblclick
await ev(`document.getElementById('wireBtn').click()`);
await M('mousePressed',ox+200,oy+200); await M('mouseReleased',ox+200,oy+200);
await M('mousePressed',ox+260,oy+200); await M('mouseReleased',ox+260,oy+200);
await M('mousePressed',ox+260,oy+200,{clickCount:2}); await M('mouseReleased',ox+260,oy+200,{clickCount:2});
await sleep(100);
const w2=await ev(`JSON.stringify([...document.querySelectorAll('polyline.wire')].map(p=>p.getAttribute('points')))`);
const btn2=await ev(`document.getElementById('wireBtn').className`);
const top2=await ev(`document.getElementById('canvas').getBoundingClientRect().top`);
// label solto → aviso
await ev(`window.prompt=()=> 'SOLTO'; document.querySelector('[data-add=netlabel]').click()`); await sleep(100);
const warn=await ev(`document.getElementById('warnings').textContent`);
// selecionar fio W e renomear
await M('mousePressed',ox+230,oy+200); await M('mouseReleased',ox+230,oy+200);
await ev(`window.prompt=()=> 'SIG'; document.getElementById('rename').click()`); await sleep(100);
const msg=await ev(`document.getElementById('warnings').textContent`);
await ev(`document.getElementById('netlistBtn').click()`);
const out=await ev(`document.getElementById('out').textContent.slice(0,200)`);
console.log(JSON.stringify({sym,w1,btn1,w2,btn2,canvasTop0,top2,warn,msg,out,errs},null,1)); process.exit(0);
