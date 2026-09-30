/* =========================================================
   NarcoLens prototype — single-file, vanilla JS
   ========================================================= */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* ---------- icons ---------- */
const P = {
  home:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  scan:'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  logs:'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chart:'M4 20V10M10 20V4M16 20v-7M22 20H2',
  shield:'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z',
  check:'M5 12.5 10 17l9-10', x:'M6 6l12 12M18 6 6 18', back:'M20 12H4M10 18l-6-6 6-6', chev:'M9 5l7 7-7 7', chevd:'M6 9l6 6 6-6',
  camera:'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', gallery:'M4 4h16v16H4zM4 15l4-4 5 5M14 14l2-2 4 4M15.5 8.5h.01',
  up:'M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7', down:'M7 13V4H4v9zM7 13l4 8a2 2 0 0 0 2-2v-4h5.5a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17.3 4H7', more:'M12 5h.01M12 12h.01M12 19h.01',
  mic:'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  send:'M4 12 20 4l-6 16-3-7z', image:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01', upload:'M12 16V4M7 9l5-5 5 5M4 20h16',
  doc:'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  lock:'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3', pin:'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2', user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  speaker:'M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6', timer:'M12 9v4l2.5 1.5M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  share:'M12 3v13M7 8l5-5 5 5M5 14v6h14v-6', refresh:'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  flask:'M9 3h6M10 3v6L4.5 19A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7.5 15h9',
  spark:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  alert:'M12 9v4M12 16.5h.01M10.3 4 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z',
  bulb:'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z',
  link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  q:'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17h.01', excl:'M12 6v8M12 18h.01',
  gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  keyboard:'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  stop:'M7 7h10v10H7z', logout:'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10'
};
const ic = (n, s=22, w=2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]}"/></svg>`;
const statusIcon = st => st==='POSITIVE' ? 'excl' : st==='NEGATIVE' ? 'check' : 'q';
const stCls = st => st==='POSITIVE' ? 'pos' : st==='NEGATIVE' ? 'neg' : 'warn';
const stLabel = st => st==='POSITIVE' ? 'Detected' : st==='NEGATIVE' ? 'Not detected' : 'Unclear';

/* ---------- reagent library (HAL NDPS kit + classic spot tests) ----------
   Test B / Test E procedures & colours transcribed from the HAL kit slides.
   Other hex values are literature approximations — calibrate with real kit photos. */
const REAGENTS = {
  testB:{ id:'testB', short:'Test B', name:'Test B · Cannabis', kit:'HAL NDPS kit', target:'Marijuana, hashish, hash oil',
    baseline:'#EDE6C8', baselineName:'Colourless / pale',
    outcomes:[{drug:'Cannabis', hex:'#E4631F', colour:'Orange (lower layer)'},{drug:'Cannabis', hex:'#B8262A', colour:'Red (lower layer)'}],
    steps:['Place a match-head amount of the suspected material in a test tube / well.','Add a match-head amount of reagent B1.','Add 25 drops of reagent B2 and shake for 1 minute.','Add 25 drops of reagent B3 and shake for 2 minutes.','Let it stand for 2 minutes. Read only the LOWER liquid layer — ignore the upper layer.'],
    positive:'Orange to red in the lower layer', timer:120 },
  testE1:{ id:'testE1', short:'Test E·1', name:'Test E · Part 1 (E1 + E2)', kit:'HAL NDPS kit', target:'Cocaine, methaqualone',
    baseline:'#F1ECE2', baselineName:'No blue',
    outcomes:[{drug:'Cocaine or Methaqualone', hex:'#2B86CC', colour:'Blue'}],
    steps:['Grind tablets to a fine powder. Place a match-head amount in a test tube / well.','Add 1 drop of reagent E1 and shake for 10 seconds.','Add 1 drop of reagent E2 and shake for 10 seconds.','Blue = positive for cocaine or methaqualone. Run Part 2 to tell them apart.'],
    positive:'Blue', timer:20 },
  testE2:{ id:'testE2', short:'Test E·2', name:'Test E · Part 2 (E3 + E4)', kit:'HAL NDPS kit', target:'Cocaine vs methaqualone',
    baseline:'#F1ECE2', baselineName:'No change',
    outcomes:[{drug:'Cocaine', hex:'#35A85A', colour:'Green'},{drug:'Methaqualone', hex:'#EDCB1C', colour:'Yellow'}],
    steps:['Place a small amount of the suspected material in a test tube / well.','Add 5 drops of reagent E3.','Add 3 drops of reagent E4.','Green = cocaine. Yellow = methaqualone.'],
    positive:'Green (cocaine) / Yellow (methaqualone)', timer:30 },
  marquis:{ id:'marquis', short:'Marquis', name:'Marquis', kit:'Colour spot test', target:'Opiates, amphetamines, MDMA',
    baseline:'#EFEDE3', baselineName:'Colourless',
    outcomes:[{drug:'Heroin / Opiates', hex:'#6B2F7D', colour:'Purple-violet'},{drug:'Amphetamines', hex:'#C2561C', colour:'Orange-brown'},{drug:'MDMA', hex:'#211C26', colour:'Black'}],
    steps:['Place a tiny amount of sample in a clean spot-plate well.','Add 2–3 drops of Marquis reagent.','Observe the colour within 60 seconds.'],
    positive:'Purple (opiates) · Orange-brown (amphetamines) · Black (MDMA)', timer:60 },
  mecke:{ id:'mecke', short:'Mecke', name:'Mecke', kit:'Colour spot test', target:'Opiates',
    baseline:'#EEEDE4', baselineName:'Colourless',
    outcomes:[{drug:'Heroin / Opiates', hex:'#1F5B4B', colour:'Blue-green'}],
    steps:['Place a tiny amount of sample in a clean well.','Add 2–3 drops of Mecke reagent.','Observe within 60 seconds.'],
    positive:'Dark blue-green', timer:60 },
  mandelin:{ id:'mandelin', short:'Mandelin', name:'Mandelin', kit:'Colour spot test', target:'Ketamine, amphetamines',
    baseline:'#E4D64A', baselineName:'Yellow (reagent)',
    outcomes:[{drug:'Ketamine', hex:'#C0602B', colour:'Orange'},{drug:'Amphetamines', hex:'#2E5E3A', colour:'Dark green'},{drug:'MDMA', hex:'#1C1C1E', colour:'Black'}],
    steps:['Place a tiny amount of sample in a clean well.','Add 2 drops of Mandelin reagent.','Observe within 60 seconds.'],
    positive:'Orange (ketamine) · Dark green (amphetamines)', timer:60 },
  scott:{ id:'scott', short:'Scott', name:'Scott (cobalt thiocyanate)', kit:'Colour spot test', target:'Cocaine',
    baseline:'#D69AB6', baselineName:'Pink (reagent)',
    outcomes:[{drug:'Cocaine', hex:'#1A58A6', colour:'Blue'}],
    steps:['Place sample in a clean well.','Add 3 drops of Scott reagent.','Blue precipitate = cocaine indicated.'],
    positive:'Blue', timer:30 }
};
const PRESETS = [
  {id:'std', name:'Standard (B + E)', wells:['testB','testE1','testE2'], desc:'Cannabis, cocaine, methaqualone'},
  {id:'opi', name:'Opiates', wells:['marquis','mecke','mandelin'], desc:'Heroin, amphetamines, ketamine'},
  {id:'coc', name:'Cocaine', wells:['testE1','testE2','scott'], desc:'Cocaine confirmation'}
];
const DRUG_PICKS = [
  {name:'Cannabis', hex:'#D9541F', preset:'std'}, {name:'Cocaine', hex:'#2B86CC', preset:'coc'}, {name:'Heroin', hex:'#6B2F7D', preset:'opi'},
  {name:'Amphet.', hex:'#C2561C', preset:'opi'}, {name:'Methaqualone', hex:'#EDCB1C', preset:'std'}, {name:'Ketamine', hex:'#C0602B', preset:'opi'}
];

/* ---------- colour science: sRGB → CIELAB, CIEDE2000 ---------- */
const hexToRgb = h => { h=h.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
const rgbToHex = ([r,g,b]) => '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase();
function rgbToLab([r,g,b]){
  const f=c=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
  const R=f(r),G=f(g),B=f(b);
  let X=(R*0.4124+G*0.3576+B*0.1805)/0.95047, Y=(R*0.2126+G*0.7152+B*0.0722), Z=(R*0.0193+G*0.1192+B*0.9505)/1.08883;
  const t=v=>v>0.008856?Math.cbrt(v):(7.787*v)+16/116;
  X=t(X);Y=t(Y);Z=t(Z);
  return [116*Y-16, 500*(X-Y), 200*(Y-Z)];
}
function deltaE2000(l1,l2){
  const [L1,a1,b1]=l1,[L2,a2,b2]=l2, rad=Math.PI/180;
  const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2;
  const G=0.5*(1-Math.sqrt(Math.pow(Cb,7)/(Math.pow(Cb,7)+Math.pow(25,7))));
  const a1p=a1*(1+G),a2p=a2*(1+G),C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);
  const h=(b,a)=>{if(a===0&&b===0)return 0;const x=Math.atan2(b,a)/rad;return x<0?x+360:x};
  const h1p=h(b1,a1p),h2p=h(b2,a2p);
  const dLp=L2-L1,dCp=C2p-C1p;
  let dhp=0; if(C1p*C2p!==0){dhp=h2p-h1p; if(dhp>180)dhp-=360; else if(dhp<-180)dhp+=360;}
  const dHp=2*Math.sqrt(C1p*C2p)*Math.sin(dhp*rad/2);
  const Lbp=(L1+L2)/2,Cbp=(C1p+C2p)/2;
  let hbp=h1p+h2p; if(C1p*C2p!==0){ if(Math.abs(h1p-h2p)>180) hbp=(h1p+h2p<360)?(h1p+h2p+360)/2:(h1p+h2p-360)/2; else hbp=(h1p+h2p)/2; }
  const T=1-0.17*Math.cos((hbp-30)*rad)+0.24*Math.cos(2*hbp*rad)+0.32*Math.cos((3*hbp+6)*rad)-0.20*Math.cos((4*hbp-63)*rad);
  const dTh=30*Math.exp(-Math.pow((hbp-275)/25,2));
  const Rc=2*Math.sqrt(Math.pow(Cbp,7)/(Math.pow(Cbp,7)+Math.pow(25,7)));
  const Sl=1+(0.015*Math.pow(Lbp-50,2))/Math.sqrt(20+Math.pow(Lbp-50,2)),Sc=1+0.045*Cbp,Sh=1+0.015*Cbp*T;
  const Rt=-Math.sin(2*dTh*rad)*Rc;
  return Math.sqrt(Math.pow(dLp/Sl,2)+Math.pow(dCp/Sc,2)+Math.pow(dHp/Sh,2)+Rt*(dCp/Sc)*(dHp/Sh));
}
/* ---------- per-well model (trained in narcolens/ml, exported to WELL_MODEL) ----------
   Features MUST match ml/narcolens_ml/features.py (see ml/tests/parity). */
function rgbToHsv([r,g,b]){ r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn; let h=0;
  if(d>1e-9){ if(mx===r) h=(((g-b)/d)%6+6)%6; else if(mx===g) h=(b-r)/d+2; else h=(r-g)/d+4; }
  return [h*60, mx>0?d/mx:0, mx]; }
function wellFeatures(reagentId, wellRgb, whiteRgb){
  const R=REAGENTS[reagentId], T=246;
  const corr=wellRgb.map((v,k)=>clamp(v*(T/Math.max(whiteRgb[k],30)),0,255));
  const lab=rgbToLab(corr), [hd,sat,val]=rgbToHsv(corr), hr=hd*Math.PI/180, wl=rgbToLab(whiteRgb), raw=rgbToLab(wellRgb);
  const drugs=[...new Set(R.outcomes.map(o=>o.drug))];
  const dE=[deltaE2000(lab, rgbToLab(hexToRgb(R.baseline)))];
  drugs.forEach(d=>dE.push(Math.min(...R.outcomes.filter(o=>o.drug===d).map(o=>deltaE2000(lab, rgbToLab(hexToRgb(o.hex)))))));
  while(dE.length<4) dE.push(100);
  return { x:[lab[0],lab[1],lab[2],Math.hypot(lab[1],lab[2]),Math.cos(hr)*sat,Math.sin(hr)*sat,sat,val,wl[0],wl[1],wl[2],raw[0],...dE.slice(0,4)], lab, dE, drugs, corr };
}
function predictWell(reagentId, x){
  const m=WELL_MODEL.reagents[reagentId];
  const z=x.map((v,i)=>(v-m.mean[i])/(m.std[i]||1));
  const logits=m.W.map((row,k)=>row.reduce((a,w,i)=>a+w*z[i],m.b[k]));
  const mx=Math.max(...logits), ex=logits.map(l=>Math.exp(l-mx)), sum=ex.reduce((a,b)=>a+b,0);
  const p=ex.map(e=>e/sum); let k=p.indexOf(Math.max(...p));
  return { label: p[k] < WELL_MODEL.unclear_below ? 'unclear' : m.classes[k], p: p[k], probs:Object.fromEntries(m.classes.map((c,i)=>[c,+p[i].toFixed(3)])) };
}
/* classify one well: model decides, colour distance explains */
function classifyWell(reagentId, rgb, white=[246,246,246]){
  const R=REAGENTS[reagentId], F=wellFeatures(reagentId, rgb, white), P=predictWell(reagentId, F.x);
  let status, drug=null, colour;
  if(P.label==='negative'){ status='NEGATIVE'; colour=R.baselineName; }
  else if(P.label==='unclear'){ status='INCONCLUSIVE';
    const k=F.dE.slice(1,1+F.drugs.length).reduce((b,v,i,a)=>v<a[b]?i:b,0), o=R.outcomes.find(o=>o.drug===F.drugs[k]);
    colour=`Between ${R.baselineName.toLowerCase()} and ${o.colour.toLowerCase()}`; }
  else { status='POSITIVE'; drug=P.label;
    const o=R.outcomes.filter(o=>o.drug===drug).sort((a,b)=>deltaE2000(F.lab,rgbToLab(hexToRgb(a.hex)))-deltaE2000(F.lab,rgbToLab(hexToRgb(b.hex))))[0]; colour=o.colour; }
  return { reagentId, hex:rgbToHex(F.corr), status, drug, colour, conf:Math.min(99,Math.round(P.p*100)), dE:+Math.min(...F.dE).toFixed(1), probs:P.probs, model:`v${WELL_MODEL.version}` };
}
function combine(wells){
  const pos=wells.filter(w=>w.status==='POSITIVE');
  const status = pos.length ? 'POSITIVE' : wells.every(w=>w.status==='NEGATIVE') ? 'NEGATIVE' : 'INCONCLUSIVE';
  let drugs=[...new Set(pos.map(w=>w.drug))];
  if(drugs.includes('Cocaine or Methaqualone') && drugs.some(d=>d==='Cocaine'||d==='Methaqualone')) drugs=drugs.filter(d=>d!=='Cocaine or Methaqualone');
  const pool = status==='POSITIVE' ? pos : wells;
  const conf = status==='INCONCLUSIVE' ? Math.min(...wells.map(w=>w.conf)) : Math.round(pool.reduce((a,w)=>a+w.conf,0)/pool.length);
  return { status, drug: drugs.join(' + ') || null, conf };
}

/* ---------- SHA-256 (sync, UTF-8) for the tamper-evident chain ---------- */
function sha256(str){
  const ascii=unescape(encodeURIComponent(str));
  function rr(v,a){return(v>>>a)|(v<<(32-a))}
  const mp=Math.pow,mw=mp(2,32);let i,j,res='';const words=[],bl=ascii.length*8;
  let hash=sha256.h=sha256.h||[];const k=sha256.k=sha256.k||[];let pc=k.length;const comp={};
  for(let c=2;pc<64;c++){if(!comp[c]){for(i=0;i<313;i+=c)comp[i]=c;hash[pc]=(mp(c,.5)*mw)|0;k[pc++]=(mp(c,1/3)*mw)|0}}
  let s=ascii+'\x80';while(s.length%64-56)s+='\x00';
  for(i=0;i<s.length;i++){j=s.charCodeAt(i);words[i>>2]|=j<<((3-i)%4)*8}
  words[words.length]=((bl/mw)|0);words[words.length]=bl;
  for(j=0;j<words.length;){const w=words.slice(j,j+=16);const old=hash;hash=hash.slice(0,8);
    for(i=0;i<64;i++){const w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4];
      const t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
      const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(t1+t2)|0].concat(hash);hash[4]=(hash[4]+t1)|0}
    for(i=0;i<8;i++)hash[i]=(hash[i]+old[i])|0}
  for(i=0;i<8;i++)for(j=3;j+1;j--){const b=(hash[i]>>(j*8))&255;res+=((b<16)?0:'')+b.toString(16)}
  return res;
}
const GENESIS='0'.repeat(64);
const sealPayload = r => JSON.stringify({seq:r.seq,id:r.id,createdAt:r.createdAt,suspect:r.suspect,fir:r.fir,item:r.item,location:r.location,witness:r.witness,kit:r.kit,officer:r.officer,wells:r.wells,overall:r.overall,photoHash:r.photoHash,prevHash:r.prevHash});
function seal(r){ r.hash = sha256(r.prevHash + '|' + sealPayload(r)); return r; }
function verifyChain(records){
  const sorted=[...records].sort((a,b)=>a.seq-b.seq); let prev=GENESIS;
  return sorted.map(r=>{
    const linkOk = r.prevHash===prev;
    const hashOk = sha256(r.prevHash+'|'+sealPayload(r))===r.hash;
    prev=r.hash; return {r, ok:linkOk&&hashOk, linkOk, hashOk};
  });
}

/* ---------- sample plate photo generator (demo uploads + seed thumbnails) ---------- */
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function shade(hex,f){return rgbToHex(hexToRgb(hex).map(v=>v*f))}
function makePlate(colours, {tint=[1,1,1], w=900, h=1200, noise=10}={}){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  const tone=hex=>{const [r,gg,b]=hexToRgb(hex);return `rgb(${Math.min(255,r*tint[0])|0},${Math.min(255,gg*tint[1])|0},${Math.min(255,b*tint[2])|0})`};
  g.fillStyle=tone('#6E6259'); g.fillRect(0,0,w,h);
  g.fillStyle=tone('#8A7C70'); g.globalAlpha=.08; for(let i=0;i<40;i++) g.fillRect(0,i*30,w,12); g.globalAlpha=1;
  const px=w*.08, py=h*.36, pw=w*.84, ph=h*.28;
  g.shadowColor='rgba(0,0,0,.35)'; g.shadowBlur=30; g.shadowOffsetY=12;
  g.fillStyle=tone('#F6F6F2'); roundRect(g,px,py,pw,ph,40); g.fill(); g.shadowColor='transparent';
  const r=w*.085;
  colours.forEach((hex,i)=>{
    const cx=w*(.25+.25*i), cy=h*.5;
    g.fillStyle=tone('#DCDCD6'); g.beginPath(); g.arc(cx,cy+3,r*1.08,0,7); g.fill();
    const grd=g.createRadialGradient(cx-r*.3,cy-r*.3,r*.1,cx,cy,r);
    grd.addColorStop(0,tone(shade(hex,1.05))); grd.addColorStop(.75,tone(hex)); grd.addColorStop(1,tone(shade(hex,.84)));
    g.fillStyle=grd; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill();
    g.fillStyle='rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(cx-r*.42,cy-r*.5,r*.14,r*.07,-.6,0,7); g.fill();
  });
  const img=g.getImageData(0,0,w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*noise;d[i]+=n;d[i+1]+=n;d[i+2]+=n}
  g.putImageData(img,0,0);
  return c;
}
const DEFAULT_MARKERS = () => [{x:.25,y:.5},{x:.5,y:.5},{x:.75,y:.5}];
const SAMPLES = [
  {id:'cannabis', label:'Cannabis +', colours:['#DA521F','#EFEADF','#EEE9DE'], tint:[1.04,.95,.80], wells:['testB','testE1','testE2']},
  {id:'cocaine',  label:'Cocaine +',  colours:['#ECE6CC','#2B86CC','#3AA85C'], tint:[1,1,1], wells:['testB','testE1','testE2']},
  {id:'negative', label:'All clear',  colours:['#ECE6CA','#F0EBE1','#EFEAE0'], tint:[.92,.96,1.06], wells:['testB','testE1','testE2']},
  {id:'unclear',  label:'Unclear',    colours:['#A8764A','#B9B6C9','#EFEAE0'], tint:[.78,.76,.74], wells:['testB','testE1','testE2']},
  {id:'heroin',   label:'Heroin +',   colours:['#6D307E','#205C4C','#E3D64C'], tint:[1,1,1], wells:['marquis','mecke','mandelin']}
];

/* ---------- read wells from an image (white plate around each well = reference) ---------- */
function readWells(imgEl, markers, rFrac){
  const sc=Math.min(1,1000/imgEl.naturalWidth);
  const W=Math.round(imgEl.naturalWidth*sc), H=Math.round(imgEl.naturalHeight*sc);
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(imgEl,0,0,W,H); const d=g.getImageData(0,0,W,H).data;
  const med=a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};
  const r=rFrac*W, out=[], whites=[];
  markers.forEach(m=>{
    const cx=m.x*W, cy=m.y*H, R=[],G=[],B=[], wr=[],wg=[],wb=[], r2=r*1.9;
    for(let y=Math.max(0,(cy-r2)|0);y<Math.min(H,cy+r2);y+=2){
      for(let x=Math.max(0,(cx-r2)|0);x<Math.min(W,cx+r2);x+=2){
        const dist=Math.hypot(x-cx,y-cy), i=(y*W+x)*4, pr=d[i],pg=d[i+1],pb=d[i+2];
        if(dist<=r*.65){ if(pr>245&&pg>245&&pb>245) continue; R.push(pr);G.push(pg);B.push(pb); }
        else if(dist>=r*1.3&&dist<=r*1.9){ wr.push(pr);wg.push(pg);wb.push(pb); }
      }
    }
    const lum=wr.map((v,i)=>v+wg[i]+wb[i]);
    const idx=lum.map((v,i)=>i).sort((a,b)=>lum[b]-lum[a]).slice(0,Math.max(1,lum.length>>1));
    whites.push([med(idx.map(i=>wr[i])),med(idx.map(i=>wg[i])),med(idx.map(i=>wb[i]))]);
    out.push([med(R),med(G),med(B)]);
  });
  const white=[0,1,2].map(k=>med(whites.map(w=>w[k])));
  const corrected=out;                       // raw well colours; each well is corrected by its own plate ring in the model
  const lumW=(white[0]+white[1]+white[2])/3, warmth=white[2]/Math.max(1,white[0]);
  let light='Balanced light';
  if(lumW<205) light='Low light · corrected'; else if(warmth<.88) light='Warm light · corrected'; else if(warmth>1.06) light='Cool light · corrected';
  return { raw:out.map(rgbToHex), corrected, whites, light, white:rgbToHex(white) };
}
