
/* =========================================================
   SCREENS — Audit logs (own bar: Home · Records · Insights · Verify · Prahari)
   ========================================================= */
const LF={q:'',f:'all'};
function filteredRecords(){
  const q=LF.q.trim().toLowerCase();
  return [...S.records].sort((a,b)=>b.seq-a.seq).filter(r=>{
    if(LF.f==='pos'&&r.overall.status!=='POSITIVE') return false;
    if(LF.f==='neg'&&r.overall.status!=='NEGATIVE') return false;
    if(LF.f==='warn'&&r.overall.status!=='INCONCLUSIVE') return false;
    if(LF.f==='todo'&&(r.confirmed||r.disputed)) return false;
    if(!q) return true;
    return [r.suspect.name,r.id,r.officer.name,r.fir,drugText(r),r.location.place].join(' ').toLowerCase().includes(q);
  });
}
function listHtml(){
  const rs=filteredRecords(); if(!rs.length) return `<div style="text-align:center;padding:56px 20px;color:var(--muted)">${ic('search',36)}<p style="font-weight:600;color:var(--ink);margin:12px 0 4px;font-size:16px">No records found</p><p style="margin:0;font-size:14px">Try another name, test ID or filter.</p></div>`;
  let html='', last='';
  rs.forEach(r=>{ const g=fmtDay(r.createdAt); if(g!==last){ html+=`<div class="group-h">${g}</div>`; last=g; } html+=recItem(r); });
  return html;
}
SCREENS.logs = () => `
  ${appbar('Audit logs',{root:true,right:`<span class="badge dim">${S.records.length} records</span>`})}
  <div style="padding:0 16px">
    <label class="search">${ic('search',22)}<input id="q" placeholder="Search name, test ID, officer" value="${esc(LF.q)}" autocomplete="off"></label>
    <div class="chips scroll-x" style="margin-top:12px">${[['all','All'],['pos','Detected'],['neg','Not detected'],['warn','Unclear'],['todo','To confirm']].map(([k,l])=>`<button class="chip rp ${LF.f===k?'on':''}" data-a="filter" data-f="${k}">${ckIcon()}${l}</button>`).join('')}</div>
  </div>
  <div class="scroll" id="list">${listHtml()}</div>
  ${logsNav('logs')}`;
AFTER.logs = () => { $('#q').addEventListener('input',e=>{LF.q=e.target.value; $('#list').innerHTML=listHtml();}); };

SCREENS.detail = ({id}) => { const r=S.records.find(x=>x.id===id); if(!r) return appbar('Not found'); const st=r.overall.status;
  const chain=verifyChain(S.records).find(v=>v.r.id===id);
  return `
  ${appbar('Test record',{right:`<button class="iconbtn rp" data-a="share" data-id="${r.id}" aria-label="Share">${ic('share',22)}</button>`})}
  <div class="scroll">
    <div class="banner ${stCls(st)}"><span class="bi ${stCls(st)}">${ic(statusIcon(st),26,3)}</span>
      <div class="grow"><div class="overline" style="color:var(--${stCls(st)})">${stLabel(st)}</div><div class="title-l">${esc(drugText(r))}</div><div style="font-size:13px;color:var(--ink-2)">${st==='INCONCLUSIVE'?'No clear colour match':`${r.overall.conf}% confidence`} · presumptive</div></div></div>
    <div style="margin-top:12px">${verdictBlock(r)}</div>
    <div class="section"><h2 class="title-m">Suspect</h2>${r.synthetic?'<span class="badge dim">Synthetic demo data</span>':''}</div>
    <div class="card" style="padding:0 16px">
      <div class="kv"><span>Name</span><span>${esc(r.suspect.name)}</span></div>
      <div class="kv"><span>Age · Gender</span><span>${esc(r.suspect.age||'—')} · ${esc(r.suspect.gender||'—')}</span></div>
      <div class="kv"><span>FIR / case no.</span><span class="mono">${esc(r.fir||'—')}</span></div>
      <div class="kv"><span>Material</span><span>${esc(r.item||'—')}</span></div>
      <div class="kv"><span>Witness</span><span>${esc(r.witness||'—')}</span></div>
    </div>
    <div class="section"><h2 class="title-m">Test</h2></div>
    <div class="card" style="padding:0 16px">
      <div class="kv"><span>Test ID</span><span class="mono">${r.id}</span></div>
      <div class="kv"><span>Date · Time</span><span>${fmtDate(r.createdAt)} · ${fmtTime(r.createdAt)}</span></div>
      <div class="kv"><span>Tested by</span><span>${esc(r.officer.name)}<br><span class="mono" style="color:var(--muted)">${r.officer.badge}</span></span></div>
      <div class="kv"><span>Unit</span><span>${esc(r.officer.unit)}</span></div>
      <div class="kv"><span>Location</span><span>${esc(r.location.place)}<br><span class="mono" style="color:var(--muted)">${r.location.gps===false?'GPS off · entered manually':`${r.location.lat.toFixed(4)}, ${r.location.lng.toFixed(4)}`}</span></span></div>
      <div class="kv"><span>Kit batch · expiry</span><span class="mono">${esc(r.kit.batch||'—')} · ${esc(r.kit.expiry||'—')}</span></div>
      <div class="kv"><span>Lighting</span><span>${esc(r.light)}</span></div>
    </div>
    <div class="section"><h2 class="title-m">Wells</h2></div>
    <div class="row" style="gap:12px;align-items:stretch">
      ${r.photo?`<img src="${r.photo}" alt="Plate photo" style="width:108px;border-radius:16px;object-fit:cover;background:var(--surface)">`:''}
      <div class="card grow" style="padding:0 14px">${r.wells.map((w,i)=>`<div class="well-res" style="padding:9px 0"><span class="big-sw" style="width:26px;height:26px;background:${w.hex}"></span><div class="grow" style="min-width:0"><div style="font-size:13px;font-weight:600">${i+1} · ${REAGENTS[w.reagentId].short}</div><div style="font-size:12px;color:var(--muted)" class="ellipsis">${esc(w.drug||w.colour)}</div></div><span class="badge ${stCls(w.status)}">${w.conf}%</span></div>`).join('')}</div>
    </div>
    <div class="section"><h2 class="title-m">Integrity</h2><span class="badge ${chain.ok?'neg':'pos'}">${chain.ok?ic('check',12,3)+' Intact':ic('alert',12,3)+' Altered'}</span></div>
    <div class="card" style="padding:0 16px">
      <div class="kv"><span>Sequence</span><span class="mono">#${r.seq}</span></div>
      <div class="kv"><span>Record hash</span><span class="mono">${shortHash(r.hash)}</span></div>
      <div class="kv"><span>Previous hash</span><span class="mono">${shortHash(r.prevHash)}</span></div>
      <div class="kv"><span>Photo hash</span><span class="mono">${shortHash(r.photoHash)}</span></div>
    </div>
    <div class="section"><h2 class="title-m">Timeline</h2></div>
    <ul class="timeline">${r.events.map(e=>`<li><b style="font-weight:500">${esc(e.e)}</b><small>${fmtDate(e.t)}, ${fmtTime(e.t)}</small></li>`).join('')}</ul>
    <button class="btn btn-tonal rp" data-a="askAbout" data-id="${r.id}">${ic('spark',18)} Ask Prahari about this test</button>
  </div>${prahariFloat()}`; };

SCREENS.insights = () => {
  const rs=S.records, pos=rs.filter(r=>r.overall.status==='POSITIVE');
  const byDrug={}; pos.forEach(r=>r.overall.drug.split(' + ').forEach(d=>byDrug[d]=(byDrug[d]||0)+1));
  const max=Math.max(1,...Object.values(byDrug));
  const days=[...Array(7)].map((_,i)=>{const d=new Date(); d.setDate(d.getDate()-6+i); const k=d.toDateString();
    const dayRs=rs.filter(r=>new Date(r.createdAt).toDateString()===k); return {l:d.toLocaleDateString('en-IN',{weekday:'narrow'}),n:dayRs.length,p:dayRs.filter(r=>r.overall.status==='POSITIVE').length};});
  const dmax=Math.max(1,...days.map(d=>d.n));
  const byOff={}; rs.forEach(r=>byOff[r.officer.name]=(byOff[r.officer.name]||0)+1);
  return `
  ${appbar('Insights',{root:true,right:'<span class="badge dim">Last 7 days</span>'})}
  <div class="scroll">
    <div class="card filled row" style="gap:8px;padding:10px">
      <div class="stat"><b>${rs.length}</b><span>Total tests</span></div>
      <div class="stat"><b style="color:var(--pos)">${Math.round(pos.length/Math.max(1,rs.length)*100)}%</b><span>Detected</span></div>
      <div class="stat"><b>${rs.filter(r=>r.confirmed).length}</b><span>Confirmed</span></div>
    </div>
    <div class="card" style="margin-top:12px"><h3 class="title-m">Tests per day</h3>
      <div class="cols">${days.map(d=>`<div class="c"><div style="width:100%;display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:2px"><i style="height:${(d.n-d.p)/dmax*90}%"></i>${d.p?`<i class="p" style="height:${d.p/dmax*90}%"></i>`:''}</div>${d.l}</div>`).join('')}</div>
      <div class="row" style="gap:16px;margin-top:10px;font-size:12px;color:var(--muted)"><span class="row" style="gap:6px"><span class="dot" style="background:var(--pos)"></span>Detected</span><span class="row" style="gap:6px"><span class="dot" style="background:var(--ink)"></span>Other</span></div>
    </div>
    <div class="card" style="margin-top:12px"><h3 class="title-m">Detected by drug</h3>
      <div class="bars">${Object.entries(byDrug).sort((a,b)=>b[1]-a[1]).map(([d,n])=>`<div class="b"><span style="width:100px">${esc(d)}</span><span class="track"><span class="fill" style="width:${n/max*100}%"></span></span><b>${n}</b></div>`).join('')||'<p class="sub">No positives yet.</p>'}</div>
    </div>
    <div class="card" style="margin-top:12px;padding:0 16px">${Object.entries(byOff).map(([o,n])=>`<div class="kv"><span>${esc(o)}</span><span>${n} tests</span></div>`).join('')}</div>
  </div>
  ${logsNav('insights')}`;
};

SCREENS.verify = () => {
  const tampered=S.records.some(r=>r._orig);
  return `
  ${appbar('Verify',{root:true})}
  <div class="scroll">
    <p class="sub" style="margin-top:0">Each record is sealed with SHA-256 and linked to the one before it. Changing any past record breaks the chain.</p>
    <button class="btn btn-dark rp" style="margin-top:16px" data-a="runVerify">${ic('shield',20)} Verify all ${S.records.length} records</button>
    <div id="vres" style="margin-top:14px"></div>
    <div class="section"><h2 class="title-m">Demo: tamper test</h2></div>
    <div class="card filled"><p style="margin:0 0 12px;font-size:14px;color:var(--ink-2)">Quietly change a past result from "Detected" to "Not detected", then run Verify to see it get caught.</p>
      ${tampered?`<button class="btn btn-outline btn-sm rp" data-a="restore">${ic('refresh',16)} Restore original</button>`:`<button class="btn btn-outline btn-sm rp" style="color:var(--pos)" data-a="tamper">${ic('alert',16)} Tamper with a record</button>`}</div>
    <div class="section"><h2 class="title-m">Look up a test ID</h2></div>
    <div class="row" style="gap:8px;align-items:flex-start"><label class="tf grow" style="margin:0"><input id="lookup" placeholder=" "><span>e.g. NL-2026-DEL-01045</span></label><button class="btn btn-dark btn-sm rp" style="height:56px;border-radius:28px" data-a="lookup">Find</button></div>
  </div>
  ${logsNav('verify')}`;
};
