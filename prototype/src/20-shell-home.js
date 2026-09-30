
/* =========================================================
   STATE
   ========================================================= */
const KEY='drugshield_android_v2';
const OFFICERS = {
  'NCB-DEL-4082':{name:'Rajesh Kumar', rank:'Inspector', short:'Insp.', badge:'NCB-DEL-4082', unit:'NCB · Delhi Zonal Unit', district:'New Delhi', state:'Delhi', device:'FIELD-UNIT-07'},
  'NCB-DEL-3127':{name:'Ananya Rao', rank:'Sub-Inspector', short:'SI', badge:'NCB-DEL-3127', unit:'NCB · Delhi Zonal Unit', district:'New Delhi', state:'Delhi', device:'FIELD-UNIT-03'}
};
const officerName = o => `${o.short} ${o.name}`;
let S;
function fresh(){ return { onboarded:false, signedIn:false, officer:OFFICERS['NCB-DEL-4082'], lang:'en', voiceReplies:true, backend:'', records:seedRecords(), draft:null, chat:[] }; }
function load(){ try{ const s=JSON.parse(localStorage.getItem(KEY)); if(s&&s.records) return s; }catch(e){} return null; }
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){ S.records.sort((a,b)=>a.seq-b.seq).slice(0,-3).forEach(r=>r.photo=null); try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(_){} }
}
function thumb(src, w=360){
  const sw=src.naturalWidth||src.width, sh=src.naturalHeight||src.height;
  const c=document.createElement('canvas'); c.width=w; c.height=Math.round(w*sh/sw);
  c.getContext('2d').drawImage(src,0,0,c.width,c.height); return c.toDataURL('image/jpeg',.72);
}
function nextId(seq){ return `NL-2026-DEL-${String(1040+seq).padStart(5,'0')}`; }
function makeRecord(o){
  const prev = S && S.records.length ? [...S.records].sort((a,b)=>b.seq-a.seq)[0] : null;
  const seq = o.seq ?? ((prev?.seq||0)+1);
  const r = { seq, id:nextId(seq), createdAt:o.createdAt||new Date().toISOString(), suspect:o.suspect, fir:o.fir||'', item:o.item||'',
    location:o.location, witness:o.witness||'', kit:o.kit||{batch:'',expiry:''}, officer:{name:officerName(o.officer),badge:o.officer.badge,unit:o.officer.unit,device:o.officer.device},
    wells:o.wells, overall:combine(o.wells), light:o.light||'Balanced light', photo:o.photo||null, photoHash:o.photo?sha256(o.photo):sha256('no-photo-'+seq),
    prevHash:o.prevHash ?? (prev?prev.hash:GENESIS), confirmed:!!o.confirmed, disputed:null, synthetic:!!o.synthetic,
    events:[{t:o.createdAt||new Date().toISOString(), e:'Test recorded & sealed'}] };
  return seal(r);
}
function seedRecords(){
  const now=new Date(), at=(dDays,h,m)=>{const d=new Date(now);d.setDate(d.getDate()-dDays);d.setHours(h,m,0,0);return d.toISOString()};
  const smp=id=>SAMPLES.find(s=>s.id===id);
  const rows=[
    {d:3,h:16,m:20,s:'heroin',  sus:{name:'Karan Sood',age:'34',gender:'Male'},    fir:'219/2026', item:'Powder', loc:{place:'Paharganj, New Delhi',lat:28.6448,lng:77.2167}, off:'NCB-DEL-3127', w:'Ramesh Chand', batch:'MQ-2026-11A', exp:'08/2027', conf:true},
    {d:2,h:11,m:5, s:'negative',sus:{name:'Rahul Verma',age:'22',gender:'Male'},   fir:'231/2026', item:'Leaves / plant', loc:{place:'Chandni Chowk, Delhi',lat:28.6506,lng:77.2303}, off:'NCB-DEL-3127', w:'', batch:'HAL-NDK-2611', exp:'02/2028', conf:true},
    {d:1,h:19,m:40,s:'cocaine', sus:{name:'Suresh Pillai',age:'41',gender:'Male'}, fir:'238/2026', item:'Powder', loc:{place:'IGI Airport Cargo, Delhi',lat:28.5562,lng:77.1000}, off:'NCB-DEL-4082', w:'Customs Supdt. V. Nair', batch:'HAL-NDK-2611', exp:'02/2028', conf:true},
    {d:0,h:9, m:15,s:'unclear', sus:{name:'Nikhil Rao',age:'27',gender:'Male'},    fir:'244/2026', item:'Resin', loc:{place:'Majnu ka Tilla, Delhi',lat:28.7006,lng:77.2273}, off:'NCB-DEL-4082', w:'', batch:'HAL-NDK-2611', exp:'02/2028', conf:false},
    {d:0,h:12,m:30,s:'cannabis',sus:{name:'Arjun Mehta',age:'25',gender:'Male'},   fir:'246/2026', item:'Leaves / plant', loc:{place:'Singhu Border, Delhi',lat:28.8428,lng:77.1030}, off:'NCB-DEL-4082', w:'Satyaveer Sharma', batch:'HAL-NDK-2611', exp:'02/2028', conf:true}
  ];
  const out=[]; let prev=GENESIS;
  rows.forEach((x,i)=>{
    const s=smp(x.s); const canvas=makePlate(s.colours,{w:300,h:400,noise:6});
    const wells=s.wells.map((rid,k)=>classifyWell(rid,hexToRgb(s.colours[k])));
    const r=makeRecord({seq:i+1, createdAt:at(x.d,x.h,x.m), suspect:x.sus, fir:x.fir, item:x.item, location:x.loc, witness:x.w, kit:{batch:x.batch,expiry:x.exp},
      officer:OFFICERS[x.off], wells, photo:canvas.toDataURL('image/jpeg',.7), prevHash:prev, confirmed:x.conf, synthetic:true});
    if(x.conf) r.events.push({t:r.createdAt, e:'Officer confirmed result'});
    prev=r.hash; out.push(r);
  });
  return out;
}
function newDraft(presetId='std'){
  return { suspect:{name:'',age:'',gender:''}, fir:'', item:'', witness:'', kit:{batch:'',expiry:''},
    location:{place:'Singhu Border, Delhi', lat:28.8428, lng:77.1030}, wells:[...PRESETS.find(p=>p.id===presetId).wells],
    photo:null, markers:DEFAULT_MARKERS(), rFrac:.085, sampleId:null, maxStep:1 };
}

/* =========================================================
   FORMAT
   ========================================================= */
const fmtTime = iso => new Date(iso).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
const fmtDate = iso => new Date(iso).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const fmtDay = iso => { const d=new Date(iso), t=new Date(); const k=x=>x.toDateString(); const y=new Date(); y.setDate(t.getDate()-1);
  return k(d)===k(t)?'Today':k(d)===k(y)?'Yesterday':d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'}); };
const isToday = iso => new Date(iso).toDateString()===new Date().toDateString();
const shortHash = h => h.slice(0,6)+'…'+h.slice(-4);
const drugText = r => r.overall.status==='POSITIVE' ? r.overall.drug : r.overall.status==='NEGATIVE' ? 'No drug detected' : 'Result unclear';
const initials = n => n.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();

/* =========================================================
   ROUTER (+ Android back via browser history)
   ========================================================= */
const view=$('#view'); let stack=[]; const AFTER={}; const SCREENS={};
function go(name, params={}, opt={}){
  if(opt.replace) stack.pop(); if(opt.reset) stack=[];
  stack.push({name,params});
  if(!opt.replace && !opt.reset && stack.length>1) history.pushState({d:stack.length},'');
  render(false);
}
function back(){ if(stack.length>1) history.back(); }
window.addEventListener('popstate',()=>{
  if($('#dialog').classList.contains('show')){ closeDialog(); history.pushState({},''); return; }
  if($('#sheet').classList.contains('show')){ closeSheet(); history.pushState({},''); return; }
  if(stack.length>1){ stack.pop(); render(true); }
});
function cur(){ return stack[stack.length-1]; }
const DARK_SCREENS=[];
function render(isBack){
  stopTimers();
  const {name,params}=cur();
  view.innerHTML = `<section class="screen ${isBack?'back-anim':''}" data-screen="${name}">${SCREENS[name](params)}</section>`;
  const dark=['splash','welcome'].includes(name); $('#statusbar').classList.toggle('light',dark); $('#gesture').classList.toggle('light',dark); $('#device').style.background=dark?'#0E0F11':'';
  AFTER[name]?.(params);
}
function rerender(){ const {name,params}=cur(); const sc=$('.scroll',view)?.scrollTop; view.innerHTML=`<section class="screen fade" data-screen="${name}">${SCREENS[name](params)}</section>`; AFTER[name]?.(params); const s=$('.scroll',view); if(s&&sc) s.scrollTop=sc; }

/* =========================================================
   SHELL — app bars, nav bars, Prahari (always bottom-right)
   ========================================================= */
const prNav = () => `<button class="nav pr rp" data-a="prahari" aria-label="Open Prahari assistant"><span class="orb">${ic('spark',22)}</span><span class="lbl">Prahari</span></button>`;
const prahariFloat = () => `<div class="prahari-float"><button class="orb rp" data-a="prahari" aria-label="Open Prahari assistant">${ic('spark',26)}</button><span class="lbl">Prahari</span></div>`;
const navItem = (on, a, to, icon, label) => `<button class="nav rp ${on?'on':''}" data-a="${a}" data-to="${to}"><span class="ind">${ic(icon,24,on?2.4:2)}</span>${label}</button>`;
function mainNav(active){ return `<nav class="navbar">${navItem(active==='home','nav','home','home','Home')}${navItem(active==='scan','nav','scan','scan','New test')}${navItem(active==='logs','nav','logs','logs','Audit logs')}${prNav()}</nav>`; }
function logsNav(active){ return `<nav class="navbar">${navItem(false,'nav','home','home','Home')}${navItem(active==='logs','lognav','logs','logs','Records')}${navItem(active==='insights','lognav','insights','chart','Insights')}${navItem(active==='verify','lognav','verify','shield','Verify')}${prNav()}</nav>`; }
/* scan flow: its own bar = Back + primary action + Prahari */
function flowBar(primaryHtml, backLabel='Back'){ return `<nav class="flowbar"><button class="btn btn-outline rp" style="width:auto;padding:0 18px" data-a="flowBack">${backLabel}</button>${primaryHtml}${prNav()}</nav>`; }
const appbar = (title, {back=true, right='', root=false}={}) => root
  ? `<div class="appbar root"><div class="title">${title}</div>${right}</div>`
  : `<div class="appbar">${back?`<button class="iconbtn rp" data-a="back" aria-label="Navigate up">${ic('back')}</button>`:''}<div class="title">${title}</div>${right}</div>`;
const scanHeader = (step, title) => `${appbar(title,{right:`<button class="iconbtn rp" data-a="cancelTest" aria-label="Discard test">${ic('x')}</button>`})}
  <div class="progress">${[1,2,3].map(n=>`<i class="${n<=step?'on':''}"></i>`).join('')}</div>
  <div class="step-label">Step ${step} of 3 · ${['','Case details','Test setup','Photo'][step]}</div>`;

/* sheet / dialog / snackbar */
let sheetClose=null;
function openSheet(html, onClose){ $('#sheetInner').innerHTML=html; $('#sheet').classList.add('show'); $('#scrim').classList.add('show'); sheetClose=onClose||null; }
function closeSheet(){ $('#sheet').classList.remove('show'); $('#scrim').classList.remove('show'); const f=sheetClose; sheetClose=null; f&&f(); }
function openDialog({icon='',title,body,actions}){ $('#dialog').innerHTML=`${icon?`<div style="color:var(--ink-2);display:flex;justify-content:center">${ic(icon,26)}</div>`:''}<h3 style="${icon?'text-align:center':''}">${title}</h3><div class="body-m">${body}</div><div class="acts">${actions.map(a=>`<button class="rp" data-a="${a.a}" ${a.attrs||''} style="${a.style||''}">${a.label}</button>`).join('')}</div>`; $('#dialog').classList.add('show'); $('#dlgScrim').classList.add('show'); }
function closeDialog(){ $('#dialog').classList.remove('show'); $('#dlgScrim').classList.remove('show'); }
let snackT; function toast(msg){ const t=$('#snack'); t.textContent=msg; const hasBar=!!$('.navbar,.flowbar',view); t.style.bottom=hasBar?'96px':'24px'; t.classList.add('show'); clearTimeout(snackT); snackT=setTimeout(()=>t.classList.remove('show'),2600); }

/* =========================================================
   SCREENS — welcome & sign-in
   ========================================================= */
const wellArt = cols => `<div style="position:relative;width:260px;height:250px">
  <div style="position:absolute;inset:48px 0;background:var(--surface);border-radius:36px"></div>
  <div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);display:flex;justify-content:space-around;padding:0 18px">
   ${cols.map((c,i)=>`<div style="width:58px;height:58px;border-radius:50%;background:${c};box-shadow:inset 0 -6px 12px rgba(0,0,0,.22),0 0 0 7px #fff;animation:pop .6s ${.15*i}s both cubic-bezier(.2,1.6,.4,1)"></div>`).join('')}
  </div>
  <div style="position:absolute;left:50%;bottom:6px;transform:translateX(-50%);background:var(--ink);color:#fff;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;display:flex;gap:6px;align-items:center;white-space:nowrap">${ic('scan',16)} 3 wells read in 2 s</div></div>`;
const sealArt = () => `<div style="position:relative;width:260px;height:250px;display:grid;place-items:center">
  <div style="width:170px;height:170px;border-radius:50%;background:var(--neg-soft);display:grid;place-items:center;color:var(--neg)">${ic('shield',90,1.6)}</div>
  <div style="position:absolute;right:0;top:34px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 10px;font-size:12px;font-weight:600;box-shadow:var(--e1);display:flex;gap:6px;align-items:center">${ic('lock',14)}<span class="mono">a41f…9c2e</span></div>
  <div style="position:absolute;left:0;bottom:40px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px 10px;font-size:12px;font-weight:600;box-shadow:var(--e1);display:flex;gap:6px;align-items:center">${ic('pin',14)} 28.84°N · 12:30</div></div>`;
const voiceArt = () => `<div style="position:relative;width:260px;height:250px;display:grid;place-items:center">
  <div class="big-orb" style="animation:breathe 2.4s ease-in-out infinite"></div>
  <div style="position:absolute;top:16px;left:0;background:var(--surface);border-radius:18px 18px 18px 4px;padding:9px 12px;font-size:13px;font-weight:500">"Test B shuru karo"</div>
  <div style="position:absolute;bottom:18px;right:0;background:var(--ink);color:#fff;border-radius:18px 18px 4px 18px;padding:9px 12px;font-size:13px;font-weight:500">Add 25 drops of B2…</div></div>`;
/* logo mark — same geometry as narcolens/brand/svg/mark.svg */
const markPaths=(shield,ring)=>`<path d="M32 5C24 8.5 16 11 9.5 12V29C9.5 43.5 18.5 54.5 32 59.5C45.5 54.5 54.5 43.5 54.5 29V12C48 11 40 8.5 32 5Z" fill="${shield}"/><path d="M32 17C32 17 43 28.5 43 36.5A11 11 0 0 1 21 36.5C21 28.5 32 17 32 17Z" fill="#E8590C"/><path d="M40.89 23.8A15.5 15.5 0 1 1 23.11 23.8" fill="none" stroke="${ring}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="27.6" cy="34.2" rx="2.1" ry="3.5" transform="rotate(-25 27.6 34.2)" fill="#fff" opacity=".9"/>`;
function logo(s=26){ return `<svg width="${s}" height="${s}" viewBox="0 0 64 64">${markPaths('#1B1C1F','#FFFFFF')}</svg>`; }
/*WELCOME*/
const langChips = () => `<div class="chips">${['en:English','hi:हिंदी'].map(x=>{const [k,l]=x.split(':');return `<button class="chip rp ${S.lang===k?'on':''}" data-a="setlang" data-v="${k}">${ic('check',16,2.4).replace('<svg','<svg class="ck"')}${l}</button>`}).join('')}<button class="chip rp" data-a="toast" data-msg="8 more languages come with the Sarvam backend">+8 more</button></div>`;
SCREENS.login = () => `
  <div class="appbar"></div>
  <div class="scroll">
    <div style="margin:8px 0 4px">${logo(40)}</div>
    <h1 class="headline" style="margin-top:16px">Sign in</h1><p class="sub">Use your department badge ID and PIN.</p>
    <label class="tf"><input id="badge" value="NCB-DEL-4082" placeholder=" " autocomplete="off"><span>Badge ID</span></label>
    <label class="tf"><input id="pin" type="password" inputmode="numeric" maxlength="4" value="1234" placeholder=" "><span>4-digit PIN</span><em class="hint" style="font-style:normal">Demo: NCB-DEL-4082 or NCB-DEL-3127 · PIN 1234</em></label>
    <div class="fieldlabel">Language</div>${langChips()}
    <button class="btn btn-dark rp" style="margin-top:28px" data-a="signin">Sign in</button>
  </div>`;

/* =========================================================
   SCREENS — home (two features: New test, Audit logs)
   ========================================================= */
function recItem(r){
  const st=r.overall.status;
  return `<button class="li rp" data-a="openRec" data-id="${r.id}">
    <span class="lead ${stCls(st)}">${ic(statusIcon(st),20,2.6)}</span>
    <span class="grow"><span class="h ellipsis" style="display:block">${esc(r.suspect.name)}</span>
      <span class="s ellipsis" style="display:block"><b style="font-weight:600;color:var(--${stCls(st)})">${esc(drugText(r))}</b> · ${esc(r.officer.name)}</span></span>
    <span><span class="t" style="display:block;margin-bottom:6px">${fmtTime(r.createdAt)}</span><span class="swrow">${r.wells.map(w=>`<span class="sw" style="background:${w.hex}"></span>`).join('')}</span></span>
  </button>`;
}
SCREENS.home = () => {
  const o=S.officer, recs=[...S.records].sort((a,b)=>b.seq-a.seq), today=recs.filter(r=>isToday(r.createdAt));
  const hour=new Date().getHours(), greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  return `
  <div class="appbar" style="padding:0 8px 0 16px;height:72px;gap:12px">
    <button class="avatar rp" data-a="profile" aria-label="Profile">${initials(o.name)}</button>
    <div class="grow"><div style="font-size:13px;color:var(--muted)">${greet}</div><div class="title-m ellipsis">${o.short} ${esc(o.name)}</div></div>
    <span class="badge neg" style="margin-right:8px"><span class="dot" style="background:var(--neg)"></span>Synced</span>
  </div>
  <div class="scroll">
    <div class="hero">
      <div class="wells"><i style="background:#DA521F"></i><i style="background:#2B86CC"></i><i style="background:#EDCB1C"></i></div>
      <div class="overline" style="color:#9A9CA3">${esc(o.unit)}</div>
      <div class="headline" style="margin-top:34px;color:#fff">New test</div>
      <div style="color:#B7B9BF;font-size:14px;margin-top:2px">3 wells · about 5 minutes</div>
      <div class="steps3"><span>1 Case</span><span>2 Reagents</span><span>3 Photo → result</span></div>
      <button class="btn btn-filled rp" style="margin-top:16px" data-a="startTest">${ic('scan',20)} Start test</button>
    </div>

    <div class="section"><h2 class="title-m">Testing for</h2></div>
    <div class="chips scroll-x" style="gap:2px">${DRUG_PICKS.map(d=>`<button class="drug-circle rp" data-a="startTest" data-preset="${d.preset}"><i><b style="background:${d.hex}"></b></i>${d.name}</button>`).join('')}</div>

    <button class="card filled rp" style="display:block;width:100%;text-align:left;margin-top:20px" data-a="nav" data-to="logs">
      <div class="row"><span style="width:40px;height:40px;border-radius:12px;background:var(--bg);display:grid;place-items:center">${ic('logs')}</span>
        <div class="grow"><div class="title-m">Audit logs</div><div style="font-size:13px;color:var(--muted)">${S.records.length} sealed records</div></div>${ic('chev',20)}</div>
      <div class="row" style="gap:8px;margin-top:14px">
        <div class="stat"><b>${today.length}</b><span>Tests today</span></div>
        <div class="stat"><b style="color:var(--pos)">${today.filter(r=>r.overall.status==='POSITIVE').length}</b><span>Detected</span></div>
        <div class="stat"><b style="color:var(--warn)">${recs.filter(r=>!r.confirmed&&!r.disputed).length}</b><span>To confirm</span></div>
      </div>
    </button>

    <div class="section"><h2 class="title-m">Recent tests</h2><button class="textbtn rp" data-a="nav" data-to="logs">See all</button></div>
    <div>${recs.slice(0,3).map(recItem).join('')}</div>

    <button class="li rp" style="margin-top:8px" data-a="kitGuide"><span class="lead dim">${ic('flask',20)}</span><span class="grow"><span class="h" style="display:block">Kit guide</span><span class="s">Steps & colour charts for ${Object.keys(REAGENTS).length} reagents</span></span>${ic('chev',20)}</button>
  </div>
  ${mainNav('home')}`;
};

SCREENS.profile = () => { const o=S.officer; return `
  ${appbar('Profile')}
  <div class="scroll">
    <div class="row" style="gap:14px;margin:4px 0 18px"><div class="avatar" style="width:64px;height:64px;font-size:22px">${initials(o.name)}</div>
      <div><div class="title-l">${o.short} ${esc(o.name)}</div><div class="sub" style="margin:2px 0 0">${esc(o.rank)} · ${esc(o.unit)}</div></div></div>
    <div class="card" style="padding:0 16px">
      <div class="kv"><span>Badge ID</span><span class="mono">${o.badge}</span></div>
      <div class="kv"><span>Device</span><span class="mono">${o.device}</span></div>
      <div class="kv"><span>District</span><span>${o.district}, ${o.state}</span></div>
    </div>
    <div class="section"><h2 class="title-m">Prahari</h2></div>
    <div class="card">
      <div class="row"><div class="grow"><div style="font-size:16px">Speak replies aloud</div><div style="font-size:13px;color:var(--muted)">Hands-free while wearing gloves</div></div><button class="switch ${S.voiceReplies?'on':''}" data-a="toggleVoice" role="switch" aria-checked="${S.voiceReplies}"></button></div>
      <div class="divider"></div>
      <div class="fieldlabel" style="margin-top:4px">Language</div>${langChips()}
      <label class="tf"><input id="backendUrl" placeholder=" " value="${esc(S.backend)}"><span>Backend URL (live Sarvam AI)</span><em class="hint" style="font-style:normal">Empty = demo mode. With the FastAPI server, chat goes to /api/voice/chat.</em></label>
      <button class="btn btn-tonal btn-sm rp" style="margin-top:12px" data-a="saveBackend">Save</button>
    </div>
    <div class="section"><h2 class="title-m">Data</h2></div>
    <button class="btn btn-outline rp" data-a="resetData">${ic('refresh',18)} Reset demo data</button>
    <button class="btn rp" style="margin-top:8px;color:var(--pos)" data-a="signout">${ic('logout',18)} Sign out</button>
    <p class="sub" style="text-align:center;font-size:12px;margin-top:16px">NarcoLens prototype · SIH 2026 · PS 26231</p>
  </div>${prahariFloat()}`; };
