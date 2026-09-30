
/* =========================================================
   ACTIONS
   ========================================================= */
let fileTarget=null;
function pickFile(target){ fileTarget=target; const f=$('#fileInput'); f.value=''; f.click(); }
function fileToDataUrl(file, max=1400){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>{ const s=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas'); c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(img.src); res(c.toDataURL('image/jpeg',.88)); };
  img.onerror=rej; img.src=URL.createObjectURL(file); }); }
function ensureDraft(){ if(!S.draft) S.draft=newDraft(); return S.draft; }
const home = () => { stack=[{name:'home',params:{}}]; };
const colourGuide = R => `<div class="card filled" style="margin-top:6px"><div class="overline" style="margin-bottom:10px">Colour guide</div>
  <div class="row" style="gap:10px;margin-bottom:10px"><span class="sw" style="width:28px;height:28px;background:${R.baseline}"></span><span class="grow">${R.baselineName}</span><span class="badge neg">Negative</span></div>
  ${R.outcomes.map(o=>`<div class="row" style="gap:10px;margin-bottom:10px"><span class="sw" style="width:28px;height:28px;background:${o.hex}"></span><span class="grow">${o.colour}</span><span class="badge pos">${o.drug}</span></div>`).join('')}</div>`;

const A = {
  back:()=>back(),
  toast:el=>toast(el.dataset.msg),
  closeSheet:()=>closeSheet(),
  closeDialog:()=>closeDialog(),

  /* splash / welcome / sign-in */
  splashSkip:()=>{ clearTimeout(splashT); if(cur()?.name!=='splash') return; if(!S.onboarded) go('welcome',{},{reset:true}); else if(!S.signedIn) go('login',{},{reset:true}); else go('home',{},{reset:true}); },
  storyNext:()=>showStory(storyI+1),
  storyPrev:()=>showStory(storyI-1),
  welcomeSkip:()=>{ S.onboarded=true; save(); go('login'); },
  lang:()=>{ S.lang=S.lang==='hi'?'en':'hi'; save(); const b=$('[data-a="lang"]'); if(cur().name==='welcome'&&b){ b.innerHTML=`${ic('spark',18)} Language · ${S.lang==='hi'?'हिंदी':'English'}`; } else rerender(); },
  setlang:el=>{ S.lang=el.dataset.v; save(); rerender(); },
  signin:()=>{ const b=$('#badge').value.trim().toUpperCase(), p=$('#pin').value.trim(); const o=OFFICERS[b];
    if(!o||p!=='1234'){ toast('Badge ID or PIN is incorrect'); return; }
    S.officer=o; S.signedIn=true; S.onboarded=true; save(); go('home',{},{reset:true}); toast(`Signed in as ${officerName(o)}`); },
  signout:()=>openDialog({icon:'logout',title:'Sign out?',body:'Records stay sealed on this device.',actions:[{a:'closeDialog',label:'Cancel'},{a:'doSignout',label:'Sign out'}]}),
  doSignout:()=>{ closeDialog(); S.signedIn=false; save(); go('login',{},{reset:true}); },
  profile:()=>go('profile'),
  toggleVoice:()=>{ S.voiceReplies=!S.voiceReplies; save(); rerender(); },
  saveBackend:()=>{ S.backend=$('#backendUrl').value.trim(); save(); toast(S.backend?'Prahari will use the live backend':'Prahari in demo mode'); },
  resetData:()=>openDialog({icon:'refresh',title:'Reset demo data?',body:'All records you created will be removed and the 5 synthetic records restored.',actions:[{a:'closeDialog',label:'Cancel'},{a:'doReset',label:'Reset'}]}),
  doReset:()=>{ closeDialog(); const keep={officer:S.officer,lang:S.lang}; S=fresh(); Object.assign(S,keep,{onboarded:true,signedIn:true}); save(); go('home',{},{reset:true}); toast('Demo data reset'); },

  /* navigation */
  nav:el=>{ const to=el.dataset.to; if(to==='scan') return A.startTest(el); home(); if(to!=='home') stack.push({name:to,params:{}}); render(false); },
  lognav:el=>{ if(cur().name===el.dataset.to) return; go(el.dataset.to,{}, {replace:true}); },
  openRec:el=>{ closeSheet(); go('detail',{id:el.dataset.id}); },
  filter:el=>{ LF.f=el.dataset.f; rerender(); },
  kitGuide:()=>openSheet(`<div class="sheet-body"><h2 class="headline">Kit guide</h2><p class="sub">Steps and colour charts.</p>
      ${Object.values(REAGENTS).map(R=>`<button class="opt rp" data-a="guide" data-r="${R.id}"><span class="swrow">${R.outcomes.map(o=>`<span class="sw" style="width:14px;height:14px;background:${o.hex}"></span>`).join('')}</span><span class="grow"><span style="display:block;font-size:16px;font-weight:500">${R.name}</span><span style="font-size:13px;color:var(--muted)">${R.target}</span></span>${ic('chev',20)}</button>`).join('')}</div>`),
  guide:el=>{ const R=REAGENTS[el.dataset.r]; openSheet(`<div class="sheet-body"><div class="overline">${R.kit}</div><h2 class="headline" style="margin:4px 0 2px">${R.name}</h2><p class="sub" style="margin-top:0">${R.target}</p>
      <ol class="steps" style="margin-top:16px">${R.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${colourGuide(R)}
      <button class="btn btn-dark rp" style="margin-top:16px" data-a="readSteps" data-r="${R.id}">${ic('speaker',18)} Read aloud</button></div>`); },

  /* new test flow */
  startTest:el=>{ closeSheet(); const preset=el?.dataset?.preset||'std'; S.draft=newDraft(preset); save(); home(); go('case'); },
  cancelTest:()=>openDialog({icon:'alert',title:'Discard this test?',body:'Nothing has been saved to the audit log yet.',actions:[{a:'closeDialog',label:'Keep editing'},{a:'discard',label:'Discard',style:'color:var(--pos)'}]}),
  discard:()=>{ closeDialog(); S.draft=null; save(); go('home',{},{reset:true}); },
  flowBack:()=>{ const n=cur().name; if(n==='case') return A.cancelTest(); go(n==='setup'?'case':'setup',{}, {replace:true}); },
  bindChip:el=>{ const d=ensureDraft(); setPath(d,el.dataset.k, getPath(d,el.dataset.k)===el.dataset.v?'':el.dataset.v); save(); rerender(); },
  locate:()=>{ const d=S.draft; openSheet(`<div class="sheet-body"><h2 class="headline">Test location</h2><p class="sub">Saved with the record. GPS is used when allowed; otherwise type the place.</p>
      <button class="btn btn-dark rp" style="margin-top:16px" data-a="useGps">${ic('pin',18)} Use current GPS location</button>
      <label class="tf"><input id="placeIn" value="${esc(d.location.place)}" placeholder=" "><span>Place name</span></label>
      <button class="btn btn-tonal rp" style="margin-top:12px" data-a="savePlace">Save place</button></div>`); },
  useGps:()=>{ const d=S.draft; if(!navigator.geolocation){ toast('GPS not available — type the place'); return; } toast('Getting GPS fix…');
    navigator.geolocation.getCurrentPosition(p=>{ d.location={place:$('#placeIn')?.value||d.location.place, lat:p.coords.latitude, lng:p.coords.longitude, acc:Math.round(p.coords.accuracy), gps:true}; save(); closeSheet(); rerender(); toast(`GPS saved · ±${Math.round(p.coords.accuracy)} m`); },
      ()=>{ d.location.gps=false; save(); toast('GPS permission denied — type the place instead'); }, {timeout:8000,enableHighAccuracy:true}); },
  savePlace:()=>{ const v=$('#placeIn').value.trim(); if(!v){ toast('Enter a place name'); return; } S.draft.location.place=v; save(); closeSheet(); rerender(); },
  caseNext:()=>{ const d=S.draft; if(!d.suspect.name.trim()){ toast('Enter the suspect name'); $('#f_name')?.focus(); return; } d.maxStep=Math.max(d.maxStep,2); save(); go('setup',{}, {replace:true}); },
  preset:el=>{ S.draft.wells=[...PRESETS.find(p=>p.id===el.dataset.id).wells]; save(); rerender(); },
  pickReagent:el=>{ const i=+el.dataset.i; openSheet(`<div class="sheet-body"><h2 class="headline">Reagent for well ${i+1}</h2>
      ${Object.values(REAGENTS).map(R=>`<button class="opt rp ${S.draft.wells[i]===R.id?'on':''}" data-a="setReagent" data-i="${i}" data-r="${R.id}">
        <span class="swrow">${R.outcomes.map(o=>`<span class="sw" style="width:14px;height:14px;background:${o.hex}"></span>`).join('')}</span>
        <span class="grow"><span style="display:block;font-size:16px;font-weight:500">${R.name}</span><span style="font-size:13px;color:var(--muted)">${R.target}</span></span>${S.draft.wells[i]===R.id?`<span style="color:var(--brand)">${ic('check',22,2.6)}</span>`:''}</button>`).join('')}</div>`); },
  setReagent:el=>{ S.draft.wells[+el.dataset.i]=el.dataset.r; save(); closeSheet(); rerender(); },
  acc:el=>el.closest('[data-acc]').classList.toggle('open'),
  timer:el=>{ const i=el.dataset.i, b=$(`[data-timer="${i}"]`); if(el.dataset.run) return; let s=+b.dataset.sec; el.dataset.run=1; el.textContent='Running';
    const t=setInterval(()=>{ s--; b.textContent=mmss(Math.max(0,s)); if(s<=0){ clearInterval(t); el.textContent='Done'; el.classList.replace('btn-dark','btn-tonal'); navigator.vibrate?.(300);
      toast(`Well ${+i+1}: time's up — read the colour`); if(S.voiceReplies) speak(S.lang==='hi'?`वेल ${+i+1} का समय पूरा। रंग देखें।`:`Well ${+i+1}, time is up. Read the colour.`);} },1000); timers.push(t); },
  readSteps:el=>{ speak(stepsText(el.dataset.r)); toast('Reading steps aloud'); },
  setupNext:()=>{ S.draft.maxStep=3; save(); go('photo',{}, {replace:true}); },
  upload:()=>pickFile('plate'),
  photoTips:()=>{ const good=tipImg('good'); openSheet(`<div class="sheet-body"><h2 class="headline">How to take a good photo</h2>
      <div class="row" style="gap:8px;margin:18px 0 10px;color:var(--neg);font-weight:600">${ic('check',20,2.6)} Do this</div>
      <div class="tips-grid"><div class="tip"><img src="${good}" alt="">Shoot straight from above with all 3 wells and white plate around them.</div>
        <div class="tip"><img src="${good}" alt="" style="filter:brightness(1.05)">Use even light. Street-light tint is corrected automatically.</div></div>
      <div class="row" style="gap:8px;margin:22px 0 10px;color:var(--pos);font-weight:600">${ic('x',20,2.6)} Avoid</div>
      <div class="tips-grid"><div class="tip"><img src="${tipImg('dark')}" alt="">Too dark — colours can't be read reliably.</div>
        <div class="tip"><img src="${tipImg('glare')}" alt="">Flash glare or reflections on the wells.</div>
        <div class="tip"><img src="${tipImg('blur')}" alt="">Blurry photo — hold still or rest the phone.</div>
        <div class="tip"><img src="${tipImg('cropped')}" alt="">Cropped — a well or the plate edge is cut off.</div></div>
      <button class="btn btn-dark rp" style="margin-top:22px" data-a="closeSheet">Got it</button></div>`); },
  sample:el=>{ const s=SAMPLES.find(x=>x.id===el.dataset.id), d=S.draft; const changed=d.wells.join()!==s.wells.join();
    d.photo=makePlate(s.colours,{tint:s.tint}).toDataURL('image/jpeg',.9); d.wells=[...s.wells]; d.markers=DEFAULT_MARKERS(); d.rFrac=.085; d.sampleId=s.id; save(); rerender();
    if(changed) toast(`Plate set to ${s.wells.map(w=>REAGENTS[w].short).join(' · ')}`); },
  resetMarkers:()=>{ S.draft.markers=DEFAULT_MARKERS(); S.draft.rFrac=.085; save(); rerender(); },
  analyse:()=>{ if(!S.draft.photo) return; go('analyzing',{}, {replace:true}); },
  confirm:el=>{ const r=S.records.find(x=>x.id===el.dataset.id); r.confirmed=true; r.disputed=null; r.events.push({t:new Date().toISOString(), e:'Officer confirmed result'}); save(); rerender(); toast('Result confirmed'); },
  dispute:el=>openDialog({icon:'alert',title:"What doesn't match?",body:`<div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">${['Colour looked different to me','Reagent may be expired or contaminated','Wrong well marked in the photo','Other'].map((t,i)=>`<label class="row" style="gap:12px;padding:10px 0;cursor:pointer"><input type="radio" name="dr" value="${esc(t)}" ${i===0?'checked':''} style="width:20px;height:20px;accent-color:var(--brand)">${t}</label>`).join('')}</div>`,
    actions:[{a:'closeDialog',label:'Cancel'},{a:'doDispute',label:'Save',attrs:`data-id="${el.dataset.id}"`}]}),
  doDispute:el=>{ const r=S.records.find(x=>x.id===el.dataset.id); const why=$('input[name="dr"]:checked')?.value||'Other'; closeDialog();
    r.disputed=why; r.confirmed=false; r.events.push({t:new Date().toISOString(), e:`Officer disputed result: ${why}`}); save(); rerender(); toast('Dispute noted — consider a retest'); },
  undoVerdict:el=>{ const r=S.records.find(x=>x.id===el.dataset.id); r.confirmed=false; r.disputed=null; r.events.push({t:new Date().toISOString(), e:'Officer verdict withdrawn'}); save(); rerender(); },
  share:async el=>{ const r=S.records.find(x=>x.id===el.dataset.id);
    const text=`NarcoLens test ${r.id}\n${drugText(r)} (${r.overall.conf}%, presumptive)\nSuspect: ${r.suspect.name}\nOfficer: ${r.officer.name} (${r.officer.badge})\n${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)} · ${r.location.place}\nSeal: ${r.hash}`;
    try{ if(navigator.share) await navigator.share({title:r.id,text}); else { await navigator.clipboard.writeText(text); toast('Report copied'); } }catch(e){} },
  retest:()=>{ const d=S.draft||newDraft(); d.photo=null; d.sampleId=null; d.markers=DEFAULT_MARKERS(); d.maxStep=3; S.draft=d; save(); home(); go('photo'); },
  resultDone:()=>{ S.draft=null; save(); go('home',{},{reset:true}); },

  /* logs */
  runVerify:async()=>{ const out=$('#vres'); const res=verifyChain(S.records); out.innerHTML=`<div class="card" style="padding:0 16px" id="vlist"></div>`;
    for(const v of res){ await sleep(150); $('#vlist')?.insertAdjacentHTML('beforeend',`<div class="vrow"><span class="vic ${v.ok?'ok':'bad'}">${ic(v.ok?'check':'x',13,3)}</span><span class="grow"><b style="font-weight:600">#${v.r.seq}</b> ${esc(v.r.suspect.name)}<br><span class="mono" style="color:var(--muted)">${shortHash(v.r.hash)}</span></span><span style="font-size:12px;font-weight:600;color:var(--${v.ok?'neg':'pos'})">${v.ok?'Intact':!v.hashOk?'Content changed':'Chain broken'}</span></div>`); }
    const bad=res.filter(v=>!v.ok).length; await sleep(150);
    out.insertAdjacentHTML('afterbegin',`<div class="banner ${bad?'pos':'neg'}" style="margin-bottom:12px"><span class="bi ${bad?'pos':'neg'}">${ic(bad?'alert':'shield',24)}</span><div><div class="title-m">${bad?`${bad} record${bad>1?'s':''} failed`:`All ${res.length} records intact`}</div><div style="font-size:13px;color:var(--ink-2)">${bad?'A record was modified after it was sealed.':'No record has changed since sealing.'}</div></div></div>`); },
  tamper:()=>{ const r=[...S.records].sort((a,b)=>a.seq-b.seq).find(x=>x.overall.status==='POSITIVE'); if(!r) return;
    r._orig=JSON.stringify(r.overall); r.overall={status:'NEGATIVE',drug:null,conf:97}; save(); rerender(); toast(`Record #${r.seq} (${r.suspect.name}) now shows "Not detected"`); },
  restore:()=>{ S.records.forEach(r=>{ if(r._orig){ r.overall=JSON.parse(r._orig); delete r._orig; } }); save(); rerender(); toast('Original restored'); },
  lookup:()=>{ const q=$('#lookup').value.trim().toUpperCase(); const r=S.records.find(x=>x.id===q||x.id.endsWith(q)); if(r) go('detail',{id:r.id}); else toast('No record with that ID'); },
  askAbout:()=>openPrahari('chat','Explain this result'),

  /* OCR */
  ocr:el=>ocrStartSheet(el.dataset.kind),
  ocrUpload:el=>{ window._ocrKind=el.dataset.kind; window._ocrPr=!!el.dataset.pr; pickFile('ocr'); },
  ocrSample:el=>runOcr(el.dataset.kind, sampleDoc(el.dataset.kind), !!el.dataset.pr),
  ocrApply:el=>{ const o=window._ocr; const inScan=['case','setup','photo'].includes(cur().name); const d=ensureDraft();
    o.fields.forEach(([l,v,path])=>setPath(d,path,v)); save(); closeSheet();
    if(el.dataset.pr) pushMsg({who:'bot',text:`Filled ${o.fields.map(f=>f[0]).join(', ')} into the test.`});
    const mark=()=>setTimeout(()=>o.fields.forEach(([,,p])=>$(`[data-bind="${p}"]`)?.closest('.tf')?.classList.add('filled')),30);
    if(cur().name==='case'){ rerender(); mark(); } else { home(); go('case'); mark(); }
    toast(`${o.fields.length} field${o.fields.length>1?'s':''} filled from the document`); },

  /* Prahari */
  prahari:()=>openPrahari('chat'),
  prClose:()=>closeSheet(),
  prMode:el=>{ prMode=el.dataset.m; stopListening(); drawPrahari(); if(prMode==='voice') setTimeout(listen,250); },
  prLang:el=>{ S.lang=S.lang==='hi'?'en':'hi'; save(); el.textContent=S.lang==='hi'?'हिंदी':'English'; drawPrahari(); },
  prSend:()=>{ const i=$('#prInput'); const v=i.value.trim(); if(!v) return; i.value=''; prAsk(v); },
  prSuggest:el=>{ if(prMode!=='chat'){ prMode='chat'; drawPrahari(); } prAsk(el.dataset.t); },
  prMic:()=>listen(),
  prAttach:()=>openSheet(`<div class="sheet-body"><h2 class="headline">Prahari can read documents</h2><p class="sub">Pick what you're scanning.</p>
      <button class="opt rp" data-a="ocr2" data-kind="fir">${ic('doc')}<span class="grow"><span style="display:block;font-size:16px;font-weight:500">FIR / ID document</span><span style="font-size:13px;color:var(--muted)">Name, age, FIR no.</span></span>${ic('chev',20)}</button>
      <button class="opt rp" data-a="ocr2" data-kind="kit">${ic('flask')}<span class="grow"><span style="display:block;font-size:16px;font-weight:500">Kit label</span><span style="font-size:13px;color:var(--muted)">Batch no. & expiry</span></span>${ic('chev',20)}</button></div>`),
  ocr2:el=>ocrStartSheet(el.dataset.kind,true)
};
function act(name, el){ const f=A[name]; if(f) f(el||{dataset:{}}); }

/* =========================================================
   EVENTS (+ Material ripple)
   ========================================================= */
$('#device').addEventListener('pointerdown',e=>{ const el=e.target.closest('.rp'); if(!el||el.disabled) return;
  const b=el.getBoundingClientRect(), z=parseFloat(getComputedStyle(document.body).zoom)||1, s=Math.max(b.width,b.height)/z;
  const r=document.createElement('span'); r.className='rip'; r.style.width=r.style.height=s+'px';
  r.style.left=((e.clientX-b.left)/z-s/2)+'px'; r.style.top=((e.clientY-b.top)/z-s/2)+'px'; el.appendChild(r); setTimeout(()=>r.remove(),600); });
$('#device').addEventListener('click',e=>{ const el=e.target.closest('[data-a]'); if(!el) return; if(el.tagName!=='INPUT') e.preventDefault(); act(el.dataset.a, el); });
$('#scrim').addEventListener('click',closeSheet);
$('#dlgScrim').addEventListener('click',closeDialog);
$('#device').addEventListener('input',e=>{ const b=e.target.dataset?.bind; if(!b||!S.draft) return; setPath(S.draft,b,e.target.value); e.target.closest('.tf')?.classList.remove('filled'); save(); });
$('#fileInput').addEventListener('change',async e=>{ const file=e.target.files[0]; if(!file) return;
  if(fileTarget==='plate'){ const d=S.draft; d.photo=await fileToDataUrl(file); d.markers=DEFAULT_MARKERS(); d.rFrac=.07; d.sampleId=null; save(); rerender(); toast('Drag the circles onto the 3 wells'); }
  else if(fileTarget==='ocr'){ const url=await fileToDataUrl(file,1800); runOcr(window._ocrKind,url,window._ocrPr); } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') history.back(); });

/* =========================================================
   TEST PANEL (desktop only) — jump straight to any screen
   ========================================================= */
const signed = () => { S.signedIn=true; S.onboarded=true; };
const withDraft = step => { S.draft=S.draft||newDraft(); S.draft.suspect.name||(S.draft.suspect.name='Vikram Sethi'); S.draft.maxStep=Math.max(step,S.draft.maxStep); };
const JUMPS = [
  ['Splash animation',()=>go('splash',{},{reset:true})],
  ['Welcome',()=>go('welcome',{},{reset:true})], ['Sign in',()=>go('login',{},{reset:true})],
  ['Home',()=>{signed();go('home',{},{reset:true});}],
  ['New test · Case',()=>{signed();act('startTest');}],
  ['New test · Setup',()=>{signed();withDraft(2);home();go('setup');}],
  ['New test · Photo',()=>{signed();withDraft(3);home();go('photo');}],
  ['Latest result',()=>{signed();home();go('result',{id:lastRec().id});}],
  ['Audit logs',()=>{signed();home();go('logs');}],
  ['Record detail',()=>{signed();home();stack.push({name:'logs',params:{}});go('detail',{id:lastRec().id});}],
  ['Insights',()=>{signed();home();go('insights');}],
  ['Verify chain',()=>{signed();home();go('verify');}],
  ['Prahari · chat',()=>{signed();if(['splash','welcome','login'].includes(cur().name)) go('home',{},{reset:true}); openPrahari('chat');}],
  ['Prahari · voice',()=>{signed();if(['splash','welcome','login'].includes(cur().name)) go('home',{},{reset:true}); openPrahari('voice');}],
  ['Profile',()=>{signed();home();go('profile');}]
];
$('#jump').innerHTML=JUMPS.map((j,i)=>`<button data-j="${i}">${j[0]}</button>`).join('');
$('#jump').addEventListener('click',e=>{ const b=e.target.closest('[data-j]'); if(!b) return; closeSheet(); closeDialog(); JUMPS[+b.dataset.j][1](); save(); });

/* =========================================================
   BOOT — splash first, then route
   ========================================================= */
S = load() || fresh();
save();
const tick=()=>{ $('#clock').textContent=new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',hour12:false}); }; tick(); setInterval(tick,30000);
go('splash');
speechSynthesis?.getVoices();
