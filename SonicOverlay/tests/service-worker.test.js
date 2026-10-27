const vm=require('vm'),fs=require('fs'),path=require('path').join(__dirname,'..')+'/';
const log=[]; let offscreen=false, session={}, local={}, offStartResult={ok:true};
const L={}; const ev=n=>({addListener:f=>{L[n]=f}});
const tabs={1:{id:1,url:'https://open.spotify.com/'},2:{id:2,url:'https://example.com/'}};
const chrome={runtime:{id:'x',
  sendMessage:async m=>{log.push(['msg',m.type,m.target||'']); if(m.type==='so/offscreen/start') return offStartResult; if(m.type==='so/offscreen/stop') return {ok:true}; },
  getContexts:async()=>offscreen?[{}]:[],onMessage:ev('msg')},
 offscreen:{createDocument:async o=>{offscreen=true;log.push(['createDoc',o.reasons[0]])},closeDocument:async()=>{offscreen=false;log.push(['closeDoc'])}},
 storage:{session:{get:async k=>({[k]:session[k]}),set:async o=>Object.assign(session,o)},local:{get:async k=>({[k]:local[k]})}},
 tabs:{get:async id=>tabs[id],query:async q=>q.url?[tabs[1]]:[tabs[1]],sendMessage:async(id,m)=>{log.push(['tab',id,m.type,m.status||m.command||'',m.thisTab])},onRemoved:ev('removed'),onUpdated:ev('updated')},
 commands:{onCommand:ev('cmd')}, tabCapture:{getMediaStreamId:async()=>'sid123'}};
const ctx={chrome,console,URL,atob,btoa,Uint8Array,Promise,setTimeout,String,JSON,importScripts:(...f)=>f.forEach(x=>vm.runInContext(fs.readFileSync(path+'background/'+x,'utf8'),ctx))};
ctx.self=ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path+'background/service-worker.js','utf8'),ctx);
let ok=0,bad=0; const t=(n,c)=>{c?ok++:(bad++,console.log('FAIL',n))};
const send=(m,sender={id:'x'})=>new Promise(r=>{const keep=L.msg(m,sender,r); if(keep!==true) setTimeout(()=>r('nokeep'),30)});
(async()=>{
 let r=await send({type:'so/capture/get-status'},{id:'x',tab:{id:1}}); t('initial idle',r.status==='idle'&&!r.thisTab);
 r=await send({type:'so/capture/start',tabId:2,streamId:'s'}); t('rejects non-spotify tab',r.ok===false&&r.error.code==='NOT_SPOTIFY');
 r=await send({type:'so/capture/start',tabId:1,streamId:'s'}); t('start ok',r.ok===true);
 t('offscreen uses USER_MEDIA',log.some(l=>l[0]==='createDoc'&&l[1]==='USER_MEDIA'));
 r=await send({type:'so/capture/get-status'},{id:'x',tab:{id:1}}); t('capturing + thisTab',r.status==='capturing'&&r.thisTab===true);
 t('broadcast with thisTab',log.some(l=>l[0]==='tab'&&l[2]==='so/capture/status'&&l[3]==='capturing'&&l[4]===true));
 const before=log.length; await send({type:'so/frame',f:'AA==',t:'AA==',sr:48000,fft:2048,seq:1}); t('frame relayed to tab',log.slice(before).some(l=>l[0]==='tab'&&l[2]==='so/frame'));
 r=await send({type:'so/capture/start',tabId:1,streamId:'s'},{id:'attacker'}); t('foreign sender ignored',r==='nokeep');
 await send({type:'so/offscreen/event',event:'ended',error:{code:'STREAM_ENDED',message:'m',hint:'h'}}); await new Promise(r=>setTimeout(r,50));
 r=await send({type:'so/capture/get-status'},{id:'x',tab:{id:1}}); t('stream end -> error state + cleanup',r.status==='error'&&!offscreen);
 offStartResult={ok:false,error:{code:'PERMISSION_DENIED',message:'denied',hint:'h'}};
 r=await send({type:'so/capture/start',tabId:1,streamId:'s'}); t('failure surfaces error + closes offscreen',r.ok===false&&r.error.code==='PERMISSION_DENIED'&&!offscreen);
 offStartResult={ok:true}; await send({type:'so/capture/start',tabId:1,streamId:'s'});
 await L.updated(1,{url:'https://example.com/'}); r=await send({type:'so/capture/get-status'},{id:'x',tab:{id:1}}); t('navigate away stops capture',r.status==='error'&&r.error.code==='TAB_NAVIGATED'&&!offscreen);
 await send({type:'so/capture/start',tabId:1,streamId:'s'}); await L.removed(1); r=await send({type:'so/capture/get-status'},{id:'x'}); t('tab close stops capture',r.status==='idle'&&!offscreen);
 await send({type:'so/capture/start',tabId:1,streamId:'s'}); await send({type:'so/capture/stop'}); r=await send({type:'so/capture/get-status'},{id:'x'}); t('manual stop releases offscreen',r.status==='idle'&&!offscreen);
 log.length=0; await L.cmd('toggle-overlay',tabs[1]); t('command forwarded',log.some(l=>l[0]==='tab'&&l[2]==='so/overlay/command'&&l[3]==='toggle-overlay'));
 await L.cmd('toggle-capture',tabs[1]); await new Promise(r=>setTimeout(r,60)); r=await send({type:'so/capture/get-status'},{id:'x',tab:{id:1}}); t('capture shortcut starts',r.status==='capturing');
 await L.cmd('toggle-capture',tabs[1]); await new Promise(r=>setTimeout(r,60)); r=await send({type:'so/capture/get-status'},{id:'x'}); t('capture shortcut stops',r.status==='idle');
 const img=await send({type:'so/fetch-image',url:'https://i.scdn.co/image/x'},{id:'x'}); t('fetch-image requires a tab sender',img.ok===false);
 console.log(ok+' passed, '+bad+' failed');
})();
