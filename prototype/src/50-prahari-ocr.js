
/* =========================================================
   PRAHARI — AI field assistant (chat + voice), same on every screen
   Demo mode answers on-device; with a backend URL it calls the
   FastAPI /api/voice/chat endpoint (Sarvam AI) instead.
   ========================================================= */
const SCREEN_CTX = { welcome:'Welcome', login:'Sign in', home:'Home', case:'New test · Case details', setup:'New test · Test setup', photo:'New test · Photo',
  analyzing:'Analysing', result:'Test result', logs:'Audit logs', detail:'Test record', insights:'Insights', verify:'Verify', profile:'Profile' };
const SUGGEST = {
  home:['How do I do Test B?','Summarise today','Start a new test'], case:['Scan the kit label','Which details are required?','Go to test setup'],
  setup:['Read Test B steps','What does blue mean?','Is brown positive?'], photo:['Tips for a good photo','Upload photo','Analyse now'],
  result:['Explain this result','What should I do next?','Open audit logs'], logs:['Show the last result','How many positives today?','Start a new test'],
  detail:['Explain this result','Is this record intact?','Open audit logs'], insights:['Summarise today','Which drug is most common?'], verify:['How does the seal work?','Show the last result']
};
let prMode='chat', recog=null;
function prSub(){ return S.backend ? `Live · Sarvam AI` : `Demo mode · on-device`; }
function openPrahari(mode='chat', seed){
  prMode=mode;
  if(!S.chat.length) S.chat.push({who:'bot', text: S.lang==='hi' ? 'नमस्ते! मैं प्रहरी हूँ, आपका फील्ड सहायक। टेस्ट के स्टेप, रंगों का मतलब या रिकॉर्ड के बारे में पूछिए।' : "Hi, I'm Prahari, your field assistant. Ask me about test steps, what a colour means, or your records. Tap the mic to talk hands-free."});
  openSheet(`
    <div class="pr-head"><span class="orb">${ic('spark',20)}</span><div class="grow"><b style="font-size:17px">Prahari</b><div style="font-size:12.5px;color:var(--muted)" id="prSub">${prSub()}</div></div>
      <button class="chip rp" data-a="prLang">${S.lang==='hi'?'हिंदी':'English'}</button><button class="iconbtn rp" data-a="prClose" aria-label="Close">${ic('x',22)}</button></div>
    <div class="seg"><button class="rp ${prMode==='chat'?'on':''}" data-a="prMode" data-m="chat">${ic('keyboard',18)}Chat</button><button class="rp ${prMode==='voice'?'on':''}" data-a="prMode" data-m="voice">${ic('mic',18)}Voice</button></div>
    <div id="prBody"></div>`, ()=>{ stopListening(); speechSynthesis?.cancel(); });
  drawPrahari();
  if(seed) prAsk(seed);
}
function drawPrahari(){
  const body=$('#prBody'); if(!body) return;
  $$('.seg button').forEach(b=>b.classList.toggle('on',b.dataset.m===prMode));
  const scr=cur().name, sugg=SUGGEST[scr]||SUGGEST.home;
  if(prMode==='chat'){
    body.innerHTML=`<div class="chat" id="chat"><div class="ctx">You're on: ${SCREEN_CTX[scr]||scr}</div>${S.chat.map(msgHtml).join('')}</div>
      <div class="chips scroll-x" style="padding:0 16px 6px;margin:0">${sugg.map(s=>`<button class="chip rp" data-a="prSuggest" data-t="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="composer"><button class="iconbtn rp" data-a="prAttach" aria-label="Scan a document">${ic('doc',22)}</button>
        <div class="field"><input id="prInput" placeholder="${S.lang==='hi'?'प्रहरी से पूछें…':'Ask Prahari…'}" autocomplete="off"><button class="iconbtn rp" style="width:40px;height:40px" data-a="prMode" data-m="voice" aria-label="Voice">${ic('mic',20)}</button></div>
        <button class="send rp" data-a="prSend" aria-label="Send">${ic('send',18)}</button></div>`;
    const c=$('#chat'); c.scrollTop=c.scrollHeight;
    $('#prInput').addEventListener('keydown',e=>{ if(e.key==='Enter') act('prSend'); });
  } else {
    body.innerHTML=`<div class="voice"><div class="big-orb" id="bigOrb"></div><div class="said" id="said">${hasSTT()?'Tap the mic and speak':'Voice input is not supported in this browser. Use Chrome, or type in Chat.'}</div>
      <div class="reply" id="vreply">${S.lang==='hi'?'"टेस्ट B के स्टेप बताओ"':'"How do I do Test B?"'}</div>
      <button class="orb rp" style="width:72px;height:72px;border-radius:24px" data-a="prMic" aria-label="Talk">${ic('mic',30)}</button>
      <div style="font-size:12.5px;color:var(--muted)">Commands: "start test", "open logs", "analyse", "last result"</div></div>`;
  }
}
function msgHtml(m){ return `<div class="msg ${m.who==='me'?'me':'bot'}">${m.img?`<img src="${m.img}" alt="">`:''}${esc(m.text)}${m.actions?`<div class="act chips">${m.actions.map(a=>`<button class="chip rp" data-a="${a.a}" ${Object.entries(a).filter(([k])=>k!=='a'&&k!=='label').map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ')}>${esc(a.label)}</button>`).join('')}</div>`:''}</div>`; }
function pushMsg(m){ S.chat.push(m); if(S.chat.length>40) S.chat=S.chat.slice(-40); save(); const c=$('#chat'); if(c){ c.insertAdjacentHTML('beforeend',msgHtml(m)); c.scrollTop=c.scrollHeight; } }
async function prAsk(text){
  pushMsg({who:'me', text});
  const c=$('#chat'); let typing; if(c){ c.insertAdjacentHTML('beforeend',`<div class="msg bot" id="typing"><span class="typing"><i></i><i></i><i></i></span></div>`); c.scrollTop=c.scrollHeight; }
  let res;
  if(S.backend){ try{ res=await remoteChat(text); }catch(e){ res={text:(S.lang==='hi'?'सर्वर से कनेक्ट नहीं हो पाया, ऑफ़लाइन जवाब: ':'Could not reach the server. Offline answer: ')+brain(text).text}; } }
  else { await sleep(450); res=brain(text); }
  $('#typing')?.remove();
  pushMsg({who:'bot', text:res.text, actions:res.actions});
  const v=$('#vreply'); if(v) v.textContent=res.text;
  if(S.voiceReplies || prMode==='voice') speak(res.text);
  if(res.run) setTimeout(res.run, 700);
  return res;
}
async function remoteChat(text){
  const hist=S.chat.slice(-8,-1).map(m=>({role:m.who==='me'?'user':'assistant',content:m.text}));
  const r=await fetch(S.backend.replace(/\/$/,'')+'/api/voice/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,language:S.lang==='hi'?'hi-IN':'en-IN',conversation_history:hist})});
  if(!r.ok) throw new Error(r.status); const j=await r.json(); return {text:j.reply};
}

/* ---------- on-device brain (demo) ---------- */
const hi = () => S.lang==='hi';
function stepsText(id){ const R=REAGENTS[id]; return (hi()?`${R.name} के स्टेप:\n`:`${R.name}:\n`)+R.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')+(hi()?`\nपॉज़िटिव: ${R.positive}`:`\nPositive: ${R.positive}`); }
function lastRec(){ return [...S.records].sort((a,b)=>b.seq-a.seq)[0]; }
function recSummary(r){ return hi() ? `${r.suspect.name} (${r.id}): ${r.overall.status==='POSITIVE'?r.overall.drug+' पाया गया':r.overall.status==='NEGATIVE'?'कोई ड्रग नहीं':'परिणाम अस्पष्ट'}, ${r.overall.conf}% विश्वास। ${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)} को ${r.officer.name} द्वारा, ${r.location.place}।`
  : `${r.suspect.name} (${r.id}): ${drugText(r)}, ${r.overall.conf}% confidence. Tested by ${r.officer.name} on ${fmtDate(r.createdAt)} at ${fmtTime(r.createdAt)}, ${r.location.place}.`; }
function brain(q){
  const t=q.toLowerCase(), has=(...w)=>w.some(x=>t.includes(x)), word=(...w)=>w.some(x=>new RegExp('(^|[^a-z])'+x+'([^a-z]|$)').test(t)), scr=cur().name, P_=cur().params;
  // navigation & commands
  if(has('start','new test','naya test','test shuru','शुरू','नया टेस्ट')&&!has('step','kaise','how')) return {text:hi()?'नया टेस्ट शुरू कर रहा हूँ।':'Starting a new test.', run:()=>{closeSheet();act('startTest');}};
  if(has('open log','audit log','logs','records','history','रिकॉर्ड','लॉग')&&!has('last','pichla','how many','kitne')) return {text:hi()?'ऑडिट लॉग खोल रहा हूँ।':'Opening audit logs.', run:()=>{closeSheet();go('logs');}};
  if(word('home')||has('go home','होम')) return {text:hi()?'होम पर जा रहा हूँ।':'Going home.', run:()=>{closeSheet();go('home',{},{reset:true});}};
  if(has('upload','photo lo','फोटो')&&scr==='photo'&&!has('tip')) return {text:hi()?'फोटो चुनिए।':'Choose the plate photo.', run:()=>{closeSheet();act('upload');}};
  if(has('analyse','analyze','check now','जाँच','चेक')&&scr==='photo') return S.draft?.photo ? {text:hi()?'तीनों वेल पढ़ रहा हूँ।':'Reading all three wells.', run:()=>{closeSheet();act('analyse');}} : {text:hi()?'पहले प्लेट की फोटो अपलोड करें।':'Upload a plate photo first.'};
  if(has('go to test setup','test setup')&&scr==='case') return {text:'OK.', run:()=>{closeSheet();act('caseNext');}};
  if(has('kit label','scan the kit','ocr','scan fir','document')) return {text:hi()?'दस्तावेज़ स्कैनर खोल रहा हूँ।':'Opening the document scanner.', run:()=>{closeSheet();act('ocr',{dataset:{kind:has('fir')?'fir':'kit'}});}};
  // records
  if(has('explain this','this result','is this record')&&(scr==='result'||scr==='detail')){ const r=S.records.find(x=>x.id===P_.id);
    if(has('intact')){ const v=verifyChain(S.records).find(x=>x.r.id===r.id); return {text:v.ok?(hi()?'हाँ, यह रिकॉर्ड सुरक्षित है — हैश और चेन दोनों सही हैं।':'Yes. The record hash and its link to the previous record both check out.'):(hi()?'नहीं! यह रिकॉर्ड बदला गया है।':'No — this record was altered after sealing.')}; }
    return {text: recSummary(r)+'\n'+r.wells.map((w,i)=>`${i+1}. ${REAGENTS[w.reagentId].short}: ${w.colour}${w.drug?' → '+w.drug:''} (${w.conf}%)`).join('\n')+(hi()?'\nयह प्रारंभिक (presumptive) परिणाम है; लैब पुष्टि ज़रूरी है।':'\nThis is a presumptive result; send the sample for lab confirmation.')}; }
  if(has('last result','last test','latest','pichla','पिछला','आखिरी','show the last')){ const r=lastRec(); return {text:recSummary(r), actions:[{a:'openRec',id:r.id,label:'Open record'}]}; }
  if(has('today','aaj','आज','summar')){ const td=S.records.filter(r=>isToday(r.createdAt)), p=td.filter(r=>r.overall.status==='POSITIVE');
    return {text:hi()?`आज ${td.length} टेस्ट हुए, ${p.length} में ड्रग पाया गया${p.length?': '+p.map(r=>r.overall.drug).join(', '):''}।`:`Today: ${td.length} tests, ${p.length} detected${p.length?' ('+p.map(r=>`${r.suspect.name} – ${r.overall.drug}`).join(', ')+')':''}. ${td.filter(r=>!r.confirmed).length} still need officer confirmation.`}; }
  if(has('how many positive','kitne')){ const p=S.records.filter(r=>r.overall.status==='POSITIVE'&&isToday(r.createdAt)); return {text:hi()?`आज ${p.length} पॉज़िटिव।`:`${p.length} positive today.`}; }
  if(has('most common')){ const m={}; S.records.forEach(r=>r.overall.drug&&(m[r.overall.drug]=(m[r.overall.drug]||0)+1)); const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0]; return {text:top?`${top[0]} (${top[1]} tests).`:'No positives yet.'}; }
  // procedures
  if(has('test b','cannabis','ganja','charas','hashish','गांजा','चरस')) return {text:stepsText('testB'), actions:[{a:'readSteps',r:'testB',label:'Read aloud'}]};
  if(has('test e','cocaine','methaqualone','कोकीन')) return {text:stepsText('testE1')+'\n\n'+stepsText('testE2')};
  if(has('marquis','heroin','opiate','smack','हेरोइन')) return {text:stepsText('marquis')+'\n\n'+(hi()?'पुष्टि के लिए Mecke भी चलाएँ।':'Run Mecke as a second test for opiates.')};
  if(has('mandelin','ketamine')) return {text:stepsText('mandelin')};
  // colours
  if(word('brown','bhura')||has('भूरा')) return {text:hi()?'भूरा रंग किसी निश्चित परिणाम से मेल नहीं खाता। ऐप इसे "अस्पष्ट" दिखाएगा। ताज़ा रीएजेंट और ब्लैंक कंट्रोल के साथ दोबारा टेस्ट करें।':'Brown is not a clean match for any outcome, so the app marks it Unclear. Re-run with fresh reagent and a blank control well.'};
  if(word('blue','neela')||has('नीला')) return {text:hi()?'Test E भाग 1 में नीला = कोकीन या मेथाक्वालोन। भाग 2 चलाएँ: हरा = कोकीन, पीला = मेथाक्वालोन।':'Blue in Test E Part 1 means cocaine or methaqualone. Run Part 2: green = cocaine, yellow = methaqualone. Blue in Scott also indicates cocaine.'};
  if(word('red','orange','laal')||has('लाल','नारंगी')) return {text:hi()?'Test B में निचली परत नारंगी से लाल = कैनबिस पॉज़िटिव। ऊपरी परत को अनदेखा करें।':'In Test B, orange to red in the LOWER layer means cannabis positive. Ignore the upper layer.'};
  if(word('green','hara')||has('हरा')) return {text:hi()?'Test E भाग 2 में हरा = कोकीन।':'Green in Test E Part 2 means cocaine. Dark blue-green in Mecke suggests opiates.'};
  if(word('yellow','peela')||has('पीला')) return {text:hi()?'Test E भाग 2 में पीला = मेथाक्वालोन।':'Yellow in Test E Part 2 means methaqualone. (Mandelin reagent is already yellow — that alone is not a result.)'};
  if(word('purple','violet','baingani')||has('बैंगनी')) return {text:hi()?'Marquis में बैंगनी = हेरोइन/ओपिएट।':'Purple-violet with Marquis indicates heroin or other opiates.'};
  // guidance
  if(has('tip','good photo','photo kaise')) return {text:hi()?'प्लेट को समतल रखें, ऊपर से सीधी फोटो लें, तीनों वेल फ्रेम में हों, छाया और फ्लैश की चमक से बचें।':'Put the plate flat, shoot straight from above, keep all three wells and some white plate around them in frame, avoid shadows and flash glare. Street-light tint is corrected automatically.'};
  if(has('required','mandatory','zaruri')) return {text:hi()?'संदिग्ध का नाम ज़रूरी है। FIR नंबर, किट बैच और गवाह भी भरें — कोर्ट में मदद करते हैं।':'Only the suspect name is required to continue. Fill FIR number, kit batch/expiry and an independent witness too — they make the record stronger in court.'};
  if(has('next','what should','52a','court','legal','ndps')) return {text:hi()?'अगला: नमूना सील करें, पंचनामा में टेस्ट ID लिखें, और नमूना FSL भेजें। NDPS धारा 52A के अनुसार मजिस्ट्रेट के सामने इन्वेंटरी और सैंपलिंग करें।':'Next: seal the sample, write the Test ID in the seizure memo, and send the sample to the FSL for confirmation. Under NDPS Sec 52A, inventory and sampling are done before a magistrate. This app record supports, not replaces, that procedure.'};
  if(has('how does the seal','hash','tamper')) return {text:'Each record is hashed with SHA-256 together with the previous record\'s hash. Editing any old record changes its hash and breaks every link after it — the Verify tab shows exactly where.'};
  if(has('safety','glove','acid')) return {text:hi()?'दस्ताने और चश्मा पहनें। रीएजेंट में तेज़ एसिड होते हैं। आँख में जाए तो 15 मिनट पानी से धोएँ।':'Wear nitrile gloves and eye protection. Reagents contain strong acids — if splashed in eyes, rinse with water for 15 minutes.'};
  if(word('hi','hello','namaste')||has('नमस्ते')) return {text:hi()?'नमस्ते! बताइए, क्या मदद करूँ?':'Hello! What do you need help with?'};
  return {text:hi()?'माफ़ कीजिए, ये समझ नहीं आया। आप टेस्ट के स्टेप, रंग का मतलब, या "पिछला रिजल्ट" पूछ सकते हैं।':'I can help with test steps (e.g. "Test B"), what a colour means ("what does blue mean"), or your records ("last result", "summarise today").',
    actions:[{a:'prSuggest',t:'How do I do Test B?',label:'Test B steps'},{a:'prSuggest',t:'Show the last result',label:'Last result'}]};
}

/* ---------- speech (browser APIs stand in for Sarvam STT/TTS in this prototype) ---------- */
const hasSTT = () => !!(window.SpeechRecognition||window.webkitSpeechRecognition);
function speak(text){ try{ if(!window.speechSynthesis) return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text.replace(/[•→]/g,' '));
  u.lang=S.lang==='hi'?'hi-IN':'en-IN'; const v=speechSynthesis.getVoices().find(v=>v.lang===u.lang); if(v) u.voice=v; u.rate=1.02;
  u.onstart=()=>$('#bigOrb')?.classList.add('speak'); u.onend=()=>$('#bigOrb')?.classList.remove('speak'); speechSynthesis.speak(u);}catch(e){} }
function stopListening(){ try{recog&&recog.abort();}catch(e){} recog=null; $('#bigOrb')?.classList.remove('listen'); }
function listen(){
  if(!hasSTT()){ toast('Voice input needs Chrome'); return; }
  if(recog){ stopListening(); return; }
  speechSynthesis?.cancel();
  const R=window.SpeechRecognition||window.webkitSpeechRecognition; recog=new R(); recog.lang=S.lang==='hi'?'hi-IN':'en-IN'; recog.interimResults=true;
  $('#bigOrb')?.classList.add('listen'); const said=$('#said'); if(said) said.textContent=S.lang==='hi'?'सुन रहा हूँ…':'Listening…';
  let final='';
  recog.onresult=e=>{ final=[...e.results].map(r=>r[0].transcript).join(' '); if($('#said')) $('#said').textContent='“'+final+'”'; };
  recog.onerror=e=>{ if($('#said')) $('#said').textContent=e.error==='not-allowed'?'Microphone permission denied':'Didn\'t catch that — tap to try again'; };
  recog.onend=()=>{ $('#bigOrb')?.classList.remove('listen'); recog=null; if(final.trim()) prAsk(final.trim()); };
  recog.start();
}

/* =========================================================
   OCR — kit label / FIR / ID (Tesseract.js stands in for Sarvam Vision)
   ========================================================= */
let tessP=null;
function loadTess(){ if(window.Tesseract) return Promise.resolve(); if(!tessP) tessP=new Promise((res,rej)=>{const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; s.onload=res; s.onerror=()=>{tessP=null;rej(new Error('offline'))}; document.head.appendChild(s);}); return tessP; }
const SAMPLE_DOCS = {
  fir:['FIRST INFORMATION REPORT','Police Station: NCB Delhi Zonal Unit','FIR No: 251/2026   Date: 30/09/2026','Name: Vikram Sethi','Age: 29   Gender: Male','Address: Rohini Sector 7, Delhi'],
  kit:['HINDUSTAN ANTIBIOTICS LIMITED','NARCOTIC DRUGS DETECTION KIT','Batch No: HAL-NDK-2703','Mfg: 03/2026   Exp: 02/2028','Pimpri, Pune - 411 018']
};
function sampleDoc(kind){
  const lines=SAMPLE_DOCS[kind], c=document.createElement('canvas'); c.width=1000; c.height=120+lines.length*70; const g=c.getContext('2d');
  g.fillStyle=kind==='kit'?'#FFF6B8':'#FFFFFF'; g.fillRect(0,0,c.width,c.height); g.fillStyle='#111';
  lines.forEach((l,i)=>{ g.font=`${i===0?'bold 44px':'38px'} Arial`; g.fillText(l,50,90+i*70); }); return c;
}
function parseDoc(text){
  const get=re=>{const m=text.match(re);return m?m[1].trim():''};
  return { name:get(/name\s*[:\-.]?\s*([A-Za-z][A-Za-z .]{2,40})/i).replace(/\s+(age|s\/o|d\/o|father)\b.*$/i,'').trim(),
    age:get(/age\s*[:\-.]?\s*(\d{1,3})/i), gender:get(/gender\s*[:\-.]?\s*(male|female|other)/i).replace(/^./,c=>c.toUpperCase()),
    fir:get(/fir\s*(?:no\.?|number)?\s*[:\-.#]?\s*(\d{1,5}\s*\/\s*\d{2,4})/i).replace(/\s/g,''),
    batch:get(/(?:batch|lot)\s*(?:no\.?)?\s*[:\-.#]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i),
    expiry:get(/exp(?:iry)?\.?\s*(?:date)?\s*[:\-.]?\s*(\d{1,2}\s*[\/\-.]\s*\d{2,4})/i).replace(/\s/g,'') };
}
function ocrStartSheet(kind, fromPrahari=false){
  openSheet(`<div class="sheet-body"><h2 class="h2">${kind==='kit'?'Scan kit label':'Scan FIR / ID'}</h2>
    <p class="sub">${kind==='kit'?'Reads batch number and expiry from the kit box.':'Reads name, age and FIR number from the document.'} In the app this uses Sarvam Vision; here it runs Tesseract OCR in the browser.</p>
    <button class="btn btn-dark rp" style="margin-top:16px" data-a="ocrUpload" data-kind="${kind}" data-pr="${fromPrahari?1:''}">${ic('upload',20)} Upload a photo</button>
    <button class="btn btn-tonal rp" style="margin-top:10px" data-a="ocrSample" data-kind="${kind}" data-pr="${fromPrahari?1:''}">${ic('doc',20)} Use a sample document</button></div>`);
}
async function runOcr(kind, source, fromPrahari){
  const preview = source instanceof HTMLCanvasElement ? source.toDataURL('image/jpeg',.8) : source;
  openSheet(`<div class="sheet-body"><h2 class="h2">Reading document…</h2><img src="${preview}" style="width:100%;border-radius:14px;margin:14px 0;max-height:220px;object-fit:contain;background:var(--surface)">
    <div class="row"><div class="spinner"></div><span id="ocrProg" style="font-weight:600">Loading OCR engine…</span></div></div>`);
  let text='', offline=false;
  try{ await loadTess(); const r=await Tesseract.recognize(source,'eng',{logger:m=>{const el=$('#ocrProg'); if(el&&m.status) el.textContent=`${m.status[0].toUpperCase()+m.status.slice(1)} ${m.progress?Math.round(m.progress*100)+'%':''}`;}}); text=r.data.text; }
  catch(e){ offline=true; text=source instanceof HTMLCanvasElement?SAMPLE_DOCS[kind].join('\n'):''; }
  const f=parseDoc(text);
  const fields = kind==='kit' ? [['Kit batch no.',f.batch,'kit.batch'],['Kit expiry',f.expiry,'kit.expiry']] : [['Name',f.name,'suspect.name'],['Age',f.age,'suspect.age'],['Gender',f.gender,'suspect.gender'],['FIR no.',f.fir,'fir']];
  const found=fields.filter(x=>x[1]);
  window._ocr={kind,fields:found,text,preview};
  openSheet(`<div class="sheet-body"><div class="row" style="gap:10px"><span class="bi neg" style="width:36px;height:36px">${ic('check',18,3)}</span><h2 class="h2">${found.length?`Found ${found.length} field${found.length>1?'s':''}`:'Nothing matched'}</h2></div>
    ${offline?`<p class="sub">OCR engine couldn't load (offline). Showing values from the sample document.</p>`:''}
    <div class="card" style="margin-top:14px;padding:4px 16px">${found.length?found.map(([l,v])=>`<div class="kv"><span>${l}</span><span>${esc(v)}</span></div>`).join(''):`<p class="sub">No ${kind==='kit'?'batch / expiry':'name / FIR'} text found. Try a sharper, flatter photo.</p>`}</div>
    <details style="margin-top:12px"><summary style="font-size:13px;font-weight:700;color:var(--muted);cursor:pointer">Raw text</summary><pre style="white-space:pre-wrap;font-size:12px;background:var(--surface);padding:10px;border-radius:10px">${esc(text.trim()||'—')}</pre></details>
    ${found.length?`<button class="btn btn-dark rp" style="margin-top:16px" data-a="ocrApply" data-pr="${fromPrahari?1:''}">${S.draft?'Fill into test':'Start a test with these'}</button>`:''}
    <button class="btn btn-tonal rp" style="margin-top:10px" data-a="closeSheet">Close</button></div>`);
}
function setPath(obj,path,val){ const k=path.split('.'); let o=obj; k.slice(0,-1).forEach(x=>o=o[x]); o[k[k.length-1]]=val; }
function getPath(obj,path){ return path.split('.').reduce((o,k)=>o?.[k],obj); }
