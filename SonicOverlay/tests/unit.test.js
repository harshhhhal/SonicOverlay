const vm=require('vm'),fs=require('fs'),ROOT=require('path').join(__dirname,'..')+'/';
const store={};
const ctx={console,setTimeout,clearTimeout,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),URL,JSON,Math,
 chrome:{runtime:{id:'x'},storage:{local:{get:async k=>(k in store?{[k]:store[k]}:{}),set:async o=>Object.assign(store,JSON.parse(JSON.stringify(o)))}}}};
ctx.self=ctx; vm.createContext(ctx);
for(const f of ['utils/message-types','utils/validation','utils/color-utils','utils/dom-utils','storage/settings-store','storage/preset-store','audio/audio-analysis']) vm.runInContext(fs.readFileSync(ROOT+f+'.js','utf8'),ctx,{filename:f});
const SO=ctx.SO; let pass=0,fail=0; const t=(n,c)=>{ if(c){pass++}else{fail++;console.log('FAIL',n)} };
// palette: image = 70% orange-red, 25% teal, 5% black
const px=[];for(let i=0;i<2000;i++){const r=i%100;px.push(...(r<70?[230,80,40,255]:r<95?[20,170,180,255]:[0,0,0,255]));}
const pal=SO.Color.extractPalette(new Uint8ClampedArray(px));
const hue=c=>SO.Color.rgbToHsl(...c)[0];
t('palette 3 colors',pal.length===3);
t('primary is orange/red',hue(pal[0])<30||hue(pal[0])>340);
t('secondary is teal',Math.abs(hue(pal[1])-184)<30);
const grey=new Uint8ClampedArray(Array(400).fill([128,128,128,255]).flat()); const gp=SO.Color.extractPalette(grey);
t('grey art -> neutral palette',gp.every(c=>Math.abs(c[0]-c[1])<6));
// colour source blends toward art
const cfg=SO.SettingsStore.defaults().color;
const c0=SO.Color.makeColorSource(cfg,null,0,0).at(0), c1=SO.Color.makeColorSource(cfg,{rgb:pal,weight:1},0,0).at(0), cm=SO.Color.makeColorSource({...cfg,artInfluence:0},{rgb:pal,weight:1},0,0).at(0);
t('art colours change the gradient',Math.abs(c0[0]-c1[0])>20);
t('artInfluence 0 ignores art',Math.abs(c0[0]-cm[0])<1);
// validation
const V=SO.Validation;
t('frame msg valid',V.validateMessage({type:SO.MSG.FRAME,f:'AA==',t:'AA==',sr:48000,fft:2048}));
t('bad fft rejected',!V.validateMessage({type:SO.MSG.FRAME,f:'AA==',t:'AA==',sr:48000,fft:3}));
t('unknown type rejected',!V.validateMessage({type:'evil'}));
t('non-scdn image rejected',!V.validateMessage({type:SO.MSG.FETCH_IMAGE,url:'https://evil.com/i.scdn.co/x.jpg'}));
t('scdn image accepted',V.validateMessage({type:SO.MSG.FETCH_IMAGE,url:'https://i.scdn.co/image/abc'}));
t('start needs streamId',!V.validateMessage({type:SO.MSG.CAPTURE_START,tabId:1}));
// settings sanitize clamps
const s=SO.SettingsStore.sanitize({audio:{sensitivity:9999,smoothing:-5,fftSize:3},color:{primary:'red',mode:'x'},visualizer:'nope'});
t('clamp sensitivity',s.audio.sensitivity===200); t('clamp smoothing',s.audio.smoothing===0); t('bad fft default',s.audio.fftSize===2048);
t('bad colour default',s.color.primary==='#00f0ff'); t('bad enum default',s.color.mode==='gradient'&&s.visualizer==='classic-spectrum');
(async()=>{
 const PS=SO.PresetStore; const list=await PS.list();
 t('16 built-ins',list.length===16&&['Cyberpunk Neon','AMOLED Minimal','Vaporwave','Retro Equalizer','Cinematic Ring','Purple Haze','Electric Blue','Monochrome','Ambient Particles','Minimal Waveform','Rainbow Spectrum','Neon Cyberwave','Aurora Borealis','Cosmic Vortex','Hardware Matrix','Custom'].every(n=>list.includes(n)));
 const exp=await PS.exportJSON(); t('export parses',JSON.parse(exp).presets.length===16);
 const added=await PS.importJSON(exp); t('import round trip',added.length===16);
 for(const [name,bad] of [['not json','{{{'],['wrong format','{"format":"x","version":1,"presets":[]}'],['proto pollution','{"format":"sonic-overlay-presets","version":1,"presets":[{"name":"a","settings":{"__proto__":{"x":1}}}]}'],['bad name','{"format":"sonic-overlay-presets","version":1,"presets":[{"name":"<b>","settings":{}}]}'],['huge','x'.repeat(600000)],['empty list','{"format":"sonic-overlay-presets","version":1,"presets":[]}']]){
  let rejected=false; try{await PS.importJSON(bad)}catch(e){rejected=true} t('reject '+name,rejected); }
 t('no pollution',({}).x===undefined);
 const dup=await PS.duplicate('Custom'); t('duplicate',dup==='Custom copy'); await PS.rename(dup,'Mine'); t('rename',(await PS.list()).includes('Mine')); await PS.remove('Mine'); t('delete',!(await PS.list()).includes('Mine'));
 await PS.restoreBuiltIns();
 // analysis: feed synthetic frame, verify bass vs treble separation and silence gating
 const fp=new SO.FrameProcessor(); const K=683,f=Buffer.alloc(K); for(let i=0;i<20;i++)f[i]=230; 
 const tm=Buffer.alloc(512,128);
 const msg={f:f.toString('base64'),t:tm.toString('base64'),sr:48000,fft:2048}; const A=SO.SettingsStore.defaults().audio;
 let now=1000; for(let i=0;i<60;i++){ fp.ingest(msg,now); fp.update(1/60,A,now,false); now+=16; }
 t('bass energy high, treble low',fp.low>0.3&&fp.high<0.05); t('live',fp.live);
 t('spectrum in range',fp.spectrum.every(v=>v>=0&&v<=1));
 const zero=Buffer.alloc(K); for(let i=0;i<120;i++){ fp.ingest({...msg,f:zero.toString('base64')},now); fp.update(1/60,A,now,false); now+=16; }
 t('silence decays to ~0',fp.energy<0.01); t('silence detected',fp.silentFor>1);
 const A2={...A,sensitivity:0}; for(let i=0;i<60;i++){ fp.ingest(msg,now); fp.update(1/60,A2,now,false); now+=16; } t('sensitivity 0 => flat',fp.energy<0.001);
 // no data for >700ms => not live
 fp.update(1/60,A,now+2000,false); t('stale => not live',!fp.live);
 const fakeCtx = {
   save() {}, restore() {}, setTransform() {}, translate() {}, rotate() {}, scale() {},
   beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, ellipse() {},
   fillRect() {}, clearRect() {}, rect() {}, addColorStop() {}, quadraticCurveTo() {}, bezierCurveTo() {},
   clip() {}, fillText() {}, measureText: () => ({ width: 50 }),
   createLinearGradient: () => ({ addColorStop(pos) { this.stops.push(pos); }, stops: [] }),
   createRadialGradient: () => ({ addColorStop() {} })
 };
 const csStops = SO.Color.makeColorSource({ ...cfg, stops: [{ pos: 0.8, color: '#ffffff' }, { pos: 0.2, color: '#000000' }] }, null, 0, 0);
 const fakeG = csStops.gradient(fakeCtx, 100, 100, 0, 1);
 t('gradient stops sorted in non-decreasing order', fakeG.stops.every((val, idx, arr) => idx === 0 || val >= arr[idx - 1]));
 const ctrl = SO.SettingsStore.createController(SO.SettingsStore.defaults());
 ctrl.set('layout.locked', true);
 t('controller sets layout.locked', ctrl.get('layout.locked') === true);

 // Visualizer suite tests: load renderer-manager, common, and all visualizers
 for(const vFile of [
   'visualizers/renderer-manager', 'visualizers/common',
   'visualizers/classic-spectrum', 'visualizers/radial-spectrum', 'visualizers/circular-waveform',
   'visualizers/linear-waveform', 'visualizers/mirrored-spectrum', 'visualizers/frequency-curve',
   'visualizers/dot-spectrum', 'visualizers/stacked-spectrum', 'visualizers/particle-field',
   'visualizers/ambient-orbs', 'visualizers/album-art-ring', 'visualizers/minimal-equalizer',
   'visualizers/neon-oscilloscope', 'visualizers/liquid-ribbon', 'visualizers/aurora-flow',
   'visualizers/frequency-mountain', 'visualizers/vortex-tunnel', 'visualizers/starfield-drift',
   'visualizers/plasma-orbit', 'visualizers/concentric-pulse', 'visualizers/glitch-spectrum',
   'visualizers/equalizer-matrix', 'visualizers/spectrum-ribbon', 'visualizers/orbiting-particles'
 ]) {
   vm.runInContext(fs.readFileSync(ROOT + vFile + '.js', 'utf8'), ctx, { filename: vFile });
 }

 t('24 visualizers registered in VIZ_LIST', SO.VIZ_LIST.length === 24);
 const allDefs = SO.Registry.list();
 t('all 24 visualizers found in Registry', allDefs.length === 24);

 // Validate visualizer defaults, controls, and rendering resilience
 const defSettings = SO.SettingsStore.defaults();
 const dummyCanvas = { getContext: () => fakeCtx, style: {} };
 const zeroFrame = {
   spectrum: new Float32Array(256), waveform: new Float32Array(256),
   bass: 0, mid: 0, high: 0, beat: 0, energy: 0, live: false
 };
 const loudFrame = {
   spectrum: new Float32Array(256).fill(1), waveform: new Float32Array(256).fill(0.8),
   bass: 1, mid: 0.9, high: 0.8, beat: 1, energy: 0.95, live: true
 };

 let renderZeroClean = true, renderLoudClean = true, renderRMClean = true;
 for(const def of allDefs) {
   t('has render fn: ' + def.id, typeof def.render === 'function');
   t('has layout: ' + def.id, typeof def.layout === 'string' && !!SO.LAYOUTS[def.layout]);
   const renderCtx = {
     ctx: fakeCtx, w: 800, h: 400, dt: 0.016, time: 1.0,
     s: defSettings, o: Object.assign({}, def.defaults),
     cs: SO.Color.makeColorSource(defSettings.color, null, 0, 0),
     meta: { title: 'Test Song', artist: 'Test Artist', duration: 180, position: 45 },
     art: null, st: {}, dpr: 1, rm: false, viewW: 1920, viewH: 1080, H: SO.H
   };
   try {
     renderCtx.f = zeroFrame; def.render(renderCtx);
   } catch(e) { renderZeroClean = false; console.error('Render zero fail', def.id, e); }
   try {
     renderCtx.f = loudFrame; def.render(renderCtx);
   } catch(e) { renderLoudClean = false; console.error('Render loud fail', def.id, e); }
   try {
     renderCtx.rm = true; renderCtx.f = loudFrame; def.render(renderCtx);
   } catch(e) { renderRMClean = false; console.error('Render RM fail', def.id, e); }
 }
 t('all visualizers render clean on zero audio', renderZeroClean);
 t('all visualizers render clean on loud audio', renderLoudClean);
 t('all visualizers render clean on reduced motion', renderRMClean);

 console.log(pass+' passed, '+fail+' failed');
})();
