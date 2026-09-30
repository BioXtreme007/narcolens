
/* =========================================================
   SPLASH — mark pops, then the wordmark unfolds out of it
   ========================================================= */
const markSvg = (s=64) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64">${markPaths('#FFFFFF','#1B1C1F')}</svg>`;
SCREENS.splash = () => `
  <div class="splash" data-a="splashSkip">
    <div class="sp-row"><span class="sp-mark">${markSvg(64)}</span><span class="sp-word"><span>Narco</span><b>Lens</b></span></div>
    <div class="sp-tag">Field drug tests, read right.</div>
    <div class="sp-foot">Smart India Hackathon 2026</div>
  </div>`;
let splashT=null;
AFTER.splash = () => { clearTimeout(splashT); splashT=setTimeout(()=>act('splashSkip'),2500); };

/* =========================================================
   WELCOME — story cards (auto-advance), dark like the splash
   ========================================================= */
const STORIES = [
  { bg:'#E8590C', title:'Read every well, right.', body:'Photograph the spot plate. NarcoLens corrects the lighting and reads each reagent colour in seconds.',
    art:()=>`<div class="st-plate">${['#C9361B','#2B86CC','#EFEADF'].map((c,i)=>`<i style="background:${c};animation-delay:${.1+i*.12}s"></i>`).join('')}</div>
      <div class="st-chip" style="left:22px;bottom:34px">${ic('excl',16,3)} Cannabis · 94%</div>
      <div class="st-chip light" style="right:22px;top:64px">${ic('spark',16)} Warm light corrected</div>` },
  { bg:'#7285F2', title:'Evidence that holds up.', body:'Every test is sealed with suspect, officer, time and place in a tamper-evident audit log.',
    art:()=>`<div class="st-shield">${ic('shield',84,1.6)}</div>
      <div class="st-chip light" style="left:20px;top:70px">${ic('lock',15)}<span class="mono">a41f…9c2e</span></div>
      <div class="st-chip light" style="right:20px;bottom:40px">${ic('pin',15)} Singhu Border · 12:30</div>` },
  { bg:'#1F9D5B', title:'Gloves on? Ask Prahari.', body:'Your AI field assistant guides every step by voice in Hindi, English and 8 more Indian languages.',
    art:()=>`<div class="big-orb" style="width:130px;height:130px;animation:breathe 2.4s ease-in-out infinite"></div>
      <div class="st-bubble" style="left:18px;top:62px">"Test B shuru karo"</div>
      <div class="st-bubble dark" style="right:18px;bottom:36px">Add 25 drops of B2…</div>` }
];
let storyI=0, storyT=0, storyRaf=null, storyLast=0;
const STORY_MS=4200;
SCREENS.welcome = () => `
  <div class="welcome">
    <div class="st-card" id="stCard" style="background:${STORIES[0].bg}">
      <div class="st-bars">${STORIES.map((_,i)=>`<i><b id="bar${i}"></b></i>`).join('')}</div>
      <div class="st-brand">${markSvg(22)}<span>NarcoLens</span></div>
      <div class="st-art" id="stArt">${STORIES[0].art()}</div>
      <button class="st-tap l" data-a="storyPrev" aria-label="Previous"></button><button class="st-tap r" data-a="storyNext" aria-label="Next"></button>
    </div>
    <div class="st-text" id="stText"><h1 class="headline" style="color:#fff;font-size:26px">${STORIES[0].title}</h1><p>${STORIES[0].body}</p></div>
    <div class="st-actions">
      <button class="btn btn-filled rp" data-a="welcomeSkip">Get started</button>
      <button class="btn rp st-sec" data-a="lang">${ic('spark',18)} Language · ${S.lang==='hi'?'हिंदी':'English'}</button>
      <div class="st-note">${ic('lock',14)} Works offline · records sealed on this device</div>
    </div>
  </div>`;
function showStory(i){
  storyI=(i+STORIES.length)%STORIES.length; storyT=0;
  const st=STORIES[storyI], card=$('#stCard'); if(!card) return;
  card.style.background=st.bg;
  const art=$('#stArt'); art.classList.remove('in'); void art.offsetWidth; art.innerHTML=st.art(); art.classList.add('in');
  const tx=$('#stText'); tx.classList.remove('in'); void tx.offsetWidth; tx.innerHTML=`<h1 class="headline" style="color:#fff;font-size:26px">${st.title}</h1><p>${st.body}</p>`; tx.classList.add('in');
  STORIES.forEach((_,k)=>{ const b=$('#bar'+k); if(b) b.style.width = k<storyI?'100%':'0%'; });
}
AFTER.welcome = () => {
  storyI=0; storyT=0; storyLast=performance.now(); cancelAnimationFrame(storyRaf);
  const tick=now=>{ if(cur().name!=='welcome') return; storyT+=now-storyLast; storyLast=now;
    const b=$('#bar'+storyI); if(b) b.style.width=Math.min(100,storyT/STORY_MS*100)+'%';
    if(storyT>=STORY_MS) showStory(storyI+1);
    storyRaf=requestAnimationFrame(tick); };
  storyRaf=requestAnimationFrame(tick);
};
