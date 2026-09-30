
/* =========================================================
   SCREENS — New test flow (own bar: Back · primary · Prahari)
   ========================================================= */
const ckIcon = () => ic('check',16,2.4).replace('<svg','<svg class="ck"');
const chipsBind = (key, opts, val) => `<div class="chips">${opts.map(o=>`<button class="chip rp ${val===o?'on':''}" data-a="bindChip" data-k="${key}" data-v="${esc(o)}">${ckIcon()}${esc(o)}</button>`).join('')}</div>`;
const tf = (key, val, label, extra='', hint='') => `<label class="tf"><input data-bind="${key}" value="${esc(val)}" placeholder=" " ${extra}><span>${label}</span>${hint?`<em class="hint" style="font-style:normal">${hint}</em>`:''}</label>`;

SCREENS.case = () => { const d=S.draft; return `
  ${scanHeader(1,'New test')}
  <div class="scroll">
    <h1 class="headline" style="margin-top:18px">Who is being tested?</h1>
    <div class="autofill">
      <button class="rp" data-a="ocr" data-kind="fir">${ic('doc')}<span>Scan FIR / ID<small>Fills name, age, FIR no.</small></span></button>
      <button class="rp" data-a="ocr" data-kind="kit">${ic('flask')}<span>Scan kit label<small>Fills batch & expiry</small></span></button>
    </div>
    ${tf('suspect.name',d.suspect.name,'Suspect full name *','id="f_name" autocomplete="off"')}
    <div class="grid2">${tf('suspect.age',d.suspect.age,'Age','inputmode="numeric" maxlength="3"')}${tf('fir',d.fir,'FIR / case no.')}</div>
    <div class="fieldlabel">Gender</div>${chipsBind('suspect.gender',['Male','Female','Other'],d.suspect.gender)}
    <div class="fieldlabel">Seized material</div>${chipsBind('item',['Powder','Leaves / plant','Resin','Tablet','Liquid'],d.item)}
    <div class="grid2">${tf('kit.batch',d.kit.batch,'Kit batch no.')}${tf('kit.expiry',d.kit.expiry,'Kit expiry','placeholder=" "')}</div>
    <button class="li rp" style="margin-top:10px" data-a="locate"><span class="lead dim">${ic('pin',20)}</span><span class="grow"><span class="h ellipsis" style="display:block">${esc(d.location.place)}</span><span class="s mono">${d.location.gps===false?'GPS off · place typed':`${d.location.lat.toFixed(4)}°N, ${d.location.lng.toFixed(4)}°E${d.location.acc?` · ±${d.location.acc} m`:''}`}</span></span><span style="color:var(--brand);font-weight:600;font-size:14px">Change</span></button>
    ${tf('witness',d.witness,'Independent witness (optional)')}
  </div>
  ${flowBar(`<button class="btn btn-dark rp grow" data-a="caseNext">Continue</button>`,'Cancel')}`; };

SCREENS.setup = () => { const d=S.draft; return `
  ${scanHeader(2,'New test')}
  <div class="scroll">
    <h1 class="headline" style="margin-top:18px">Set up the plate</h1>
    <p class="sub">One reagent per well. Tap a well to change it.</p>
    <div class="chips scroll-x" style="margin-top:14px">${PRESETS.map(p=>`<button class="chip rp ${p.wells.join()===d.wells.join()?'on':''}" data-a="preset" data-id="${p.id}">${ckIcon()}${p.name}</button>`).join('')}</div>
    <div class="plate">${d.wells.map((w,i)=>`<button class="well rp" data-a="pickReagent" data-i="${i}"><span class="cup">${i+1}</span>${REAGENTS[w].short}<span class="edit">Change</span></button>`).join('')}</div>
    <div class="section" style="margin-bottom:0"><h2 class="title-m">Steps</h2><span class="label">Tap to expand</span></div>
    ${d.wells.map((w,i)=>{const R=REAGENTS[w];return `
      <div class="acc ${i===0?'open':''}" data-acc>
        <button class="rp" data-a="acc"><span class="n">${i+1}</span><span class="grow"><span style="display:block;font-size:16px;font-weight:500">${R.name}</span><span style="font-size:13px;color:var(--muted)">${R.target}</span></span><span class="chev">${ic('chevd',20)}</span></button>
        <div class="acc-body">
          <ol class="steps">${R.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
          <div class="note" style="margin-bottom:10px">${ic('drop',18)}<span><b>Positive:</b> ${esc(R.positive)}</span></div>
          <div class="timer"><span>${ic('timer',20)}</span><b data-timer="${i}" data-sec="${R.timer}">${mmss(R.timer)}</b><span class="grow" style="font-size:13px;color:var(--muted)">Reaction time</span>
            <button class="btn btn-sm btn-dark rp" data-a="timer" data-i="${i}">Start</button></div>
          <button class="btn btn-sm btn-tonal rp" style="margin-top:10px" data-a="readSteps" data-r="${w}">${ic('speaker',18)} Read steps aloud</button>
        </div></div>`}).join('')}
    <div class="note warn" style="margin-top:16px">${ic('alert',18)}<span>Wear gloves and eye protection. Reagents contain strong acids. Run a blank control when unsure.</span></div>
  </div>
  ${flowBar(`<button class="btn btn-dark rp grow" data-a="setupNext">Continue</button>`)}`; };
P.drop='M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z';
const mmss = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
let timers=[]; function stopTimers(){ timers.forEach(clearInterval); timers=[]; }

SCREENS.photo = () => { const d=S.draft; return `
  ${scanHeader(3,'New test')}
  <div class="scroll">
    <div class="stage" id="stage">
      ${d.photo ? `<img id="plateImg" src="${d.photo}" alt="Plate photo">${d.wells.map((w,i)=>`<div class="marker" data-m="${i}"><span>${i+1} · ${REAGENTS[w].short}</span></div>`).join('')}`
        : `<div class="reticle"><i></i><i></i><i></i><i></i></div><div class="empty"><b style="font-size:16px">Place the plate inside the frame</b><p>Top-down, all 3 wells visible,<br>some white plate around each well.</p></div>`}
    </div>
    ${d.photo ? `
      <div class="note" style="margin-top:12px">${ic('scan',18)}<span>Drag each circle onto its well. The white plate around the well corrects the lighting.</span></div>
      <div class="fieldlabel">Circle size</div><input type="range" class="range" id="rsize" min="0.03" max="0.16" step="0.005" value="${d.rFrac}">
      <div class="grid2" style="margin-top:12px"><button class="btn btn-tonal rp" data-a="upload">${ic('gallery',18)} Change photo</button><button class="btn btn-tonal rp" data-a="resetMarkers">${ic('refresh',18)} Reset circles</button></div>`
    : `<div class="tray">
         <button class="side-act rp" data-a="upload"><i>${ic('gallery',22)}</i>Gallery</button>
         <button class="shutter rp" data-a="upload" aria-label="Upload plate photo"><i>${ic('camera',28)}</i></button>
         <button class="side-act rp" data-a="photoTips"><i>${ic('bulb',22)}</i>Tips</button>
       </div>
       <p class="sub" style="text-align:center;font-size:12.5px;margin-top:2px">Prototype uploads a photo · the Android app opens the camera</p>`}
    <div class="section"><h2 class="title-m">No kit here? Try a sample</h2></div>
    <div class="chips scroll-x">${SAMPLES.map(s=>`<button class="chip rp ${d.sampleId===s.id?'on':''}" data-a="sample" data-id="${s.id}"><span class="swrow">${s.colours.map(c=>`<span class="sw" style="width:10px;height:10px;background:${c}"></span>`).join('')}</span>${s.label}</button>`).join('')}</div>
  </div>
  ${flowBar(`<button class="btn btn-filled rp grow" data-a="analyse" ${d.photo?'':'disabled'}>${ic('spark',18)} Analyse</button>`)}`; };
AFTER.photo = () => {
  const d=S.draft, img=$('#plateImg'); if(!img) return;
  const stage=$('#stage');
  const layout=()=>{ const sw=stage.clientWidth, sh=stage.clientHeight, ir=img.naturalWidth/img.naturalHeight||.75;
    let w=sw,h=sw/ir; if(h>sh){h=sh;w=sh*ir;} return {x:(sw-w)/2,y:(sh-h)/2,w,h}; };
  const place=()=>{ const L=layout(); $$('.marker',stage).forEach(m=>{const i=+m.dataset.m,p=d.markers[i],D=2*d.rFrac*L.w;
    m.style.left=(L.x+p.x*L.w)+'px'; m.style.top=(L.y+p.y*L.h)+'px'; m.style.width=m.style.height=D+'px';}); };
  img.complete ? place() : img.onload=place;
  let drag=null;
  stage.addEventListener('pointerdown',e=>{const m=e.target.closest('.marker'); if(!m) return; drag=+m.dataset.m; m.classList.add('drag'); m.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',e=>{ if(drag===null) return; const L=layout(), b=stage.getBoundingClientRect();
    d.markers[drag]={x:clamp((e.clientX-b.left-L.x)/L.w,0,1), y:clamp((e.clientY-b.top-L.y)/L.h,0,1)}; place(); });
  const end=()=>{ if(drag===null) return; $$('.marker',stage).forEach(m=>m.classList.remove('drag')); drag=null; save(); };
  stage.addEventListener('pointerup',end); stage.addEventListener('pointercancel',end);
  $('#rsize')?.addEventListener('input',e=>{d.rFrac=+e.target.value; place();});
};
/* photo tips images (generated plates) */
function tipImg(kind){
  const base=SAMPLES[0];
  const c=makePlate(base.colours,{tint:kind==='dark'?[.34,.33,.3]:[1,1,1],w:450,h:600,noise:kind==='dark'?14:8});
  const out=document.createElement('canvas'); out.width=out.height=160; const g=out.getContext('2d');
  if(kind==='blur') g.filter='blur(5px)';
  const crop = kind==='cropped' ? [260,230,160,160] : [40,190,370,220];
  g.drawImage(c,crop[0],crop[1],crop[2],crop[3],0,0,160,160*crop[3]/crop[2]>160?160:160);
  if(kind==='glare'){ g.filter='none'; const gr=g.createRadialGradient(95,70,4,95,70,55); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,160,160); }
  return out.toDataURL('image/jpeg',.8);
}

SCREENS.analyzing = () => `
  <div class="appbar"><div class="title" style="text-align:center;padding:0">Reading wells</div></div>
  <div class="analyzing" style="flex:1">
    <div class="photo"><img src="${S.draft.photo}" alt=""><div class="beam"></div></div>
    <ul class="checklist" id="checklist">
      ${['Correcting for lighting','Reading well 1','Reading well 2','Reading well 3','Sealing the record'].map((t,i)=>`<li><span class="ck">${i===0?'<span class="spinner"></span>':''}</span>${t}</li>`).join('')}
    </ul>
  </div>`;
AFTER.analyzing = async () => {
  try{
    const d=S.draft, img=new Image(); img.src=d.photo; await img.decode();
    const read=readWells(img, d.markers, d.rFrac);
    const wells=d.wells.map((rid,i)=>({...classifyWell(rid, read.corrected[i], read.whites[i]), raw:read.raw[i]}));
    const items=$$('#checklist li');
    for(let i=0;i<items.length;i++){
      await sleep(i===0?650:430);
      items[i].classList.add('done'); items[i].querySelector('.ck').innerHTML=ic('check',20,2.8);
      if(items[i+1]) items[i+1].querySelector('.ck').innerHTML='<span class="spinner"></span>';
    }
    const rec=makeRecord({ suspect:{...d.suspect}, fir:d.fir, item:d.item, location:{...d.location}, witness:d.witness, kit:{...d.kit},
      officer:S.officer, wells, light:read.light, photo:thumb(img,420) });
    S.records.push(rec); save();
    await sleep(300);
    if(cur().name==='analyzing') go('result',{id:rec.id},{replace:true});
    if(S.voiceReplies) speak(resultSpeech(rec));
  }catch(e){ console.error(e); toast('Could not read this photo — try another'); go('photo',{}, {replace:true}); }
};
function resultSpeech(r){
  if(S.lang==='hi') return r.overall.status==='POSITIVE' ? `परिणाम: ${r.overall.drug} पाया गया। विश्वास ${r.overall.conf} प्रतिशत।` : r.overall.status==='NEGATIVE' ? 'कोई ड्रग नहीं पाया गया।' : 'परिणाम स्पष्ट नहीं है। कृपया बेहतर रोशनी में दोबारा फोटो लें।';
  return r.overall.status==='POSITIVE' ? `Result: ${r.overall.drug} detected, ${r.overall.conf} percent confidence.` : r.overall.status==='NEGATIVE' ? 'No drug detected.' : 'Result unclear. Please retake the photo in better light.';
}
function verdictBlock(r){
  if(r.confirmed) return `<div class="verdict row" style="text-align:left"><span class="lead" style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--neg-soft);color:var(--neg)">${ic('check',20,2.6)}</span><div class="grow"><div class="title-m">Confirmed by you</div><div style="font-size:13px;color:var(--muted)">Logged in the record timeline</div></div><button class="textbtn rp" data-a="undoVerdict" data-id="${r.id}">Undo</button></div>`;
  if(r.disputed) return `<div class="verdict row" style="text-align:left"><span style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--warn-soft);color:var(--warn)">${ic('alert',20)}</span><div class="grow"><div class="title-m">Disputed by you</div><div style="font-size:13px;color:var(--muted)">${esc(r.disputed)}</div></div><button class="textbtn rp" data-a="undoVerdict" data-id="${r.id}">Undo</button></div>`;
  return `<div class="verdict"><div class="title-m">Does this match what you see?</div><div style="font-size:13px;color:var(--muted);margin-top:2px">Your answer is added to the record.</div>
    <div class="grid2"><button class="btn btn-pos rp" data-a="dispute" data-id="${r.id}">${ic('down',18)} No</button><button class="btn btn-neg rp" data-a="confirm" data-id="${r.id}">${ic('up',18)} Yes, confirm</button></div></div>`;
}
SCREENS.result = ({id}) => { const r=S.records.find(x=>x.id===id); const st=r.overall.status; return `
  <div class="scroll" style="padding-top:0">
    <div class="res-top ${stCls(st)}">
      <div class="big-ic ${stCls(st)}">${ic(statusIcon(st),46,3)}</div>
      <div class="overline" style="color:var(--${stCls(st)})">${st==='POSITIVE'?'Drug detected':st==='NEGATIVE'?'Test complete':'Needs a retest'}</div>
      <div class="res-drug">${esc(drugText(r))}</div>
      <div style="font-size:14px;color:var(--ink-2)">${st==='INCONCLUSIVE'?'No clear colour match':`${r.overall.conf}% confidence`} · presumptive · ${fmtTime(r.createdAt)}</div>
    </div>
    ${st==='INCONCLUSIVE'?`<div class="note warn" style="margin-top:14px">${ic('alert',18)}<span>A well doesn't clearly match a known colour. Retake the photo in even light, or re-run with fresh reagent.</span></div>`:''}
    <div class="card" style="margin-top:16px;padding:2px 16px">
      ${r.wells.map((w,i)=>`<div class="well-res"><span class="big-sw" style="background:${w.hex}"></span>
        <div class="grow"><div style="font-size:15px;font-weight:500">${i+1} · ${REAGENTS[w.reagentId].name}</div><div style="font-size:13px;color:var(--muted)">${esc(w.colour)}${w.drug?` → ${esc(w.drug)}`:''}</div></div>
        <div style="text-align:right"><span class="badge ${stCls(w.status)}">${stLabel(w.status)}</span><div class="mono" style="color:var(--muted);margin-top:4px">${w.conf}%</div></div></div>`).join('')}
    </div>
    <div style="margin-top:12px">${verdictBlock(r)}</div>
    <details class="fp"><summary>${ic('alert',18)}<span class="grow">Known false positives & limits</span><span class="chev">${ic('chevd',18)}</span></summary>
      <ul><li>Sugar, soap, some cold/OTC medicines and herbal teas can react like drugs.</li><li>Acid reagents (Marquis, Mecke, Mandelin) turn most organic material dark if left too long — read within the timer.</li><li>Mixtures and low purity give weak or muddy colours.</li><li>Keep part of the seized sample untouched for the lab.</li></ul></details>
    <div class="card" style="margin-top:12px;padding:0 16px">
      <div class="kv"><span>Suspect</span><span>${esc(r.suspect.name)}${r.suspect.age?`, ${esc(r.suspect.age)}`:''}</span></div>
      <div class="kv"><span>Test ID</span><span class="mono">${r.id}</span></div>
      <div class="kv"><span>Tested by</span><span>${esc(r.officer.name)}</span></div>
      <div class="kv"><span>Date & time</span><span>${fmtDate(r.createdAt)}, ${fmtTime(r.createdAt)}</span></div>
      <div class="kv"><span>Location</span><span>${esc(r.location.place)}</span></div>
      <div class="kv"><span>Lighting</span><span>${esc(r.light)}</span></div>
    </div>
    <div class="seal" style="margin-top:12px"><span style="color:var(--neg)">${ic('lock',20)}</span><div class="grow">Sealed in the audit log<br><span class="mono" style="color:var(--muted)">SHA-256 ${shortHash(r.hash)}</span></div></div>
    <div class="grid2" style="margin-top:12px">
      <button class="btn btn-tonal rp" data-a="share" data-id="${r.id}">${ic('share',18)} Share</button>
      <button class="btn btn-tonal rp" data-a="retest">${ic('refresh',18)} Retest</button>
    </div>
    <p class="sub" style="font-size:12px;text-align:center;margin-top:14px">Field result is presumptive. Send the sample for lab confirmation.</p>
  </div>
  <nav class="flowbar"><button class="btn btn-dark rp grow" data-a="resultDone">Done</button>${prNav()}</nav>`; };
