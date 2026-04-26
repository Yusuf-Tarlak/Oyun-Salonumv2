// ===== ENHANCED UX PACK =====
let audioCtx=null, currentTheme=localStorage.getItem('oyunSalonuTheme')||'classic';
let touchDrag={active:false,fromIdx:null,ghost:null};
let UPendingUno=null;
function getAudio(){if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); return audioCtx;}
function playFx(type){
  try{
    const ctx=getAudio(), now=ctx.currentTime;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    if(type==='draw'){o.type='triangle';o.frequency.setValueAtTime(460,now);o.frequency.exponentialRampToValueAtTime(620,now+.08);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.03,now+.02);g.gain.exponentialRampToValueAtTime(.0001,now+.12);}
    else if(type==='discard'){o.type='square';o.frequency.setValueAtTime(280,now);o.frequency.exponentialRampToValueAtTime(180,now+.09);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.025,now+.01);g.gain.exponentialRampToValueAtTime(.0001,now+.12);}
    else if(type==='win'){o.type='sine';o.frequency.setValueAtTime(440,now);o.frequency.exponentialRampToValueAtTime(660,now+.12);o.frequency.exponentialRampToValueAtTime(880,now+.28);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.04,now+.03);g.gain.exponentialRampToValueAtTime(.0001,now+.34);}
    else {o.type='triangle';o.frequency.setValueAtTime(340,now);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.02,now+.02);g.gain.exponentialRampToValueAtTime(.0001,now+.08);}
    o.start(now); o.stop(now+.4);
  }catch(e){}
}
function statKey(name){return 'oyunSalonuStats:'+String(name||'Misafir').trim().toLowerCase();}
function getStats(name){try{return JSON.parse(localStorage.getItem(statKey(name))||'{"games":0,"wins":0,"history":[]}');}catch(e){return {games:0,wins:0,history:[]};}}
function saveStats(name,stats){localStorage.setItem(statKey(name),JSON.stringify(stats));}
function rankFromWins(wins){ if(wins>=25) return 'Usta'; if(wins>=12) return 'Kıdemli'; if(wins>=5) return 'Oyuncu'; return 'Çaylak'; }
function updateProfileUI(){
  const host=document.getElementById('profile-mini-host'); if(!host) return;
  const name=(document.getElementById('uname')?.value||myName||'Misafir').trim()||'Misafir';
  const s=getStats(name); const wr=s.games?Math.round((s.wins/s.games)*100):0;
  host.innerHTML=`<div class="profile-mini"><div class="avatar">${name[0]?.toUpperCase()||'?'}</div><div class="profile-stats"><b>${esc(name)} · ${rankFromWins(s.wins)}</b><span>${s.games} maç · ${s.wins} galibiyet · %${wr} kazanma</span></div></div>`;
  const list=document.getElementById('history-list'); if(list){
    list.innerHTML='';
    (s.history||[]).slice(0,8).forEach(h=>{const d=document.createElement('div'); d.className='history-item'; d.innerHTML=`<div><b>${esc(h.game)}</b><div>${esc(h.result)}</div></div><div>${esc(h.date)}</div>`; list.appendChild(d);});
    if(!list.children.length) list.innerHTML='<div class="history-item"><div>Henüz maç yok</div><div>—</div></div>';
  }
}
function recordMatchForCurrentPlayer(win, rankings){
  const name=(myName||document.getElementById('uname')?.value||'Misafir').trim()||'Misafir';
  const s=getStats(name); s.games += 1; if(win) s.wins += 1;
  s.history = s.history || [];
  const pos = rankings?.findIndex?.(r=>r.name===name); const place = pos>=0 ? (pos+1)+'. sıra' : (win?'Kazandı':'Bitti');
  s.history.unshift({game:GLBL[curGame]||curGame,result: win===null ? 'Berabere · '+place : (win?'Kazandı':'Kaybetti')+' · '+place,date:new Date().toLocaleDateString('tr-TR')});
  s.history=s.history.slice(0,12); saveStats(name,s); updateProfileUI();
}

function changeTheme(t){applyTheme(t);}
function applyTheme(theme){
  currentTheme=theme||'classic';
  localStorage.setItem('oyunSalonuTheme',currentTheme);
  document.body.classList.remove('theme-classic','theme-night','theme-emerald','theme-royal','theme-casino','theme-light');
  document.body.classList.add('theme-'+currentTheme);
  ['main-theme-select','profile-theme-select'].forEach(id=>{
    const sel=document.getElementById(id);
    if(sel) sel.value=currentTheme;
  });
}
function initEnhancementUI(){applyTheme(currentTheme); updateProfileUI(); const uname=document.getElementById('uname'); if(uname && !uname._bindProfile){uname._bindProfile=true; uname.addEventListener('input',updateProfileUI);} }
const _origStartGame = startGame;
startGame = function(g){ _origStartGame(g); setTimeout(()=>{updateProfileUI(); if(g==='uno') renderUno(); if(g==='okey') renderOkey();},0); };
const _origGameOver = gameOver;
gameOver = function(win,sub,rankings){ if(win!==undefined) recordMatchForCurrentPlayer(win, rankings||[]); if(win) playFx('win'); _origGameOver(win,sub,rankings); };
const _origLeaveHome = leaveHome;
leaveHome = function(){ _origLeaveHome(); setTimeout(updateProfileUI,0); };

// UNO helpers
const _origApplyUnoPlay = applyUnoPlay;
applyUnoPlay = function(fromIdx,cardIdx,chosenColor,cardRef=null,matchOrdinal=0){ if(isHost) unoMaybePenalty(); const before=(UState.hands[fromIdx]||[]).length; _origApplyUnoPlay(fromIdx,cardIdx,chosenColor,cardRef,matchOrdinal); try{playFx('discard'); document.getElementById('uno-discard')?.classList.add('uno-play-burst'); setTimeout(()=>document.getElementById('uno-discard')?.classList.remove('uno-play-burst'),260);}catch(e){} if(isHost){ const after=(UState.hands[fromIdx]||[]).length; if(after===1) UPendingUno=fromIdx; else if(UPendingUno===fromIdx && after!==1) UPendingUno=null; } };
const _origApplyUnoDraw = applyUnoDraw;
applyUnoDraw = function(fromIdx){ if(isHost) unoMaybePenalty(); _origApplyUnoDraw(fromIdx); playFx('draw'); document.getElementById('uno-deck-btn')?.classList.add('fx-pulse'); setTimeout(()=>document.getElementById('uno-deck-btn')?.classList.remove('fx-pulse'),220); };
const _origApplyUnoPass = applyUnoPass;
applyUnoPass = function(fromIdx){ if(isHost) unoMaybePenalty(); _origApplyUnoPass(fromIdx); };
const _origShoutUno = shoutUno;
shoutUno = function(){ if(isHost && UState.hands?.[myIdx]?.length===1) UPendingUno=null; _origShoutUno(); };
const _origUnoMsg = unoMsg;
unoMsg = function(d){ if(d.t==='uno-shout' && isHost && d.fromIdx!==undefined && (UState.hands[d.fromIdx]||[]).length===1) UPendingUno=null; _origUnoMsg(d); };
const _origRenderUno = renderUno;
renderUno = function(){ _origRenderUno(); };

// Okey helpers
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
const _origApplyOkeyDraw = applyOkeyDraw;
applyOkeyDraw = function(fromIdx,source){ _origApplyOkeyDraw(fromIdx,source); playFx('draw'); document.getElementById(source==='pile'?'okey-pilecnt':'okey-disccnt')?.classList.add('fx-pulse'); setTimeout(()=>document.getElementById(source==='pile'?'okey-pilecnt':'okey-disccnt')?.classList.remove('fx-pulse'),250); };
const _origApplyOkeyDiscard = applyOkeyDiscard;
applyOkeyDiscard = function(fromIdx,tileIdx){ _origApplyOkeyDiscard(fromIdx,tileIdx); playFx('discard'); document.getElementById('okey-disctp')?.classList.add('fx-pulse'); setTimeout(()=>document.getElementById('okey-disctp')?.classList.remove('fx-pulse'),250); };
const _origRenderOkey = renderOkey;
renderOkey = function(){ _origRenderOkey();
  const mode=document.getElementById('okey-open-mode')?.value||'sirali'; const hintKeys=okeyComputeHighlightKeys(mode);
  document.querySelectorAll('#okey-myr .otile').forEach(el=>{ const idx=parseInt(el.dataset.slot||'-1',10); if(idx>=0 && OSLOTS[idx]){ const k=okeyTileKey(OSLOTS[idx]); if(hintKeys.has(k)) el.classList.add('group-hint'); const hand=okeyAllTiles(); let suggested=null, best=Infinity; hand.forEach((t,i)=>{ const s=okeyHintScore(t,hand); if(s<best){best=s; suggested=i;} }); const tileIdx=OSLOTS.slice(0,idx+1).filter(Boolean).length-1; if(suggested===tileIdx) el.classList.add('best-discard'); } });
  const relPos=['pos-left','pos-top','pos-right']; [...document.querySelectorAll('#okey-opponents .okey-opp-area')].forEach((el,i)=>{ const name=el.querySelector('.okey-opp-name'); if(name && !name.querySelector('.seat-badge')){ const badge=document.createElement('span'); badge.className='seat-badge'; badge.textContent=['SOL','KARŞI','SAĞ'][i]||'OY'; name.appendChild(badge);} });
  document.querySelectorAll('#okey-myr .otile').forEach(el=>{ const idx=parseInt(el.dataset.slot||'-1',10); if(Number.isInteger(idx) && idx>=0){ el.addEventListener('pointerdown',ev=>okeyTouchStart(ev,idx),{passive:true}); } });
};
const _prevOkeyRenderMaybe = renderOkey;
// Patch attributes after original render structure exists
const _origRenderOkey2 = renderOkey;
renderOkey = function(){ _origRenderOkey2(); document.querySelectorAll('#okey-myr .otile').forEach((el,i)=>{ el.dataset.slot = String(i); }); };
// re-wrap to keep enhancements
const __renderOkeyBase = renderOkey;
renderOkey = function(){ __renderOkeyBase(); const mode=document.getElementById('okey-open-mode')?.value||'sirali'; const hintKeys=okeyComputeHighlightKeys(mode); document.querySelectorAll('#okey-myr .otile').forEach(el=>{ const idx=parseInt(el.dataset.slot||'-1',10); el.classList.remove('group-hint','best-discard'); if(idx>=0 && OSLOTS[idx]){ const k=okeyTileKey(OSLOTS[idx]); if(hintKeys.has(k)) el.classList.add('group-hint'); } if(Number.isInteger(idx) && idx>=0){ el.onpointerdown=(ev)=>okeyTouchStart(ev,idx);} }); const hand=okeyAllTiles(); let suggested=0,best=Infinity; hand.forEach((t,i)=>{ const s=okeyHintScore(t,hand); if(s<best){best=s; suggested=i;} }); document.querySelectorAll('#okey-myr .otile').forEach(el=>{ const idx=parseInt(el.dataset.slot||'-1',10); const tileIdx=Number.isInteger(idx)? OSLOTS.slice(0,idx+1).filter(Boolean).length-1 : -1; if(tileIdx===suggested && idx>=0 && OSLOTS[idx]) el.classList.add('best-discard'); }); const selfOpened=OState.opened?.[myIdx]; if(selfOpened){ const openState=document.getElementById('okey-open-state'); if(openState) openState.innerHTML=`Elin açık <span class="okey-open-badge">${groupLabelFromMode(selfOpened)}</span> · Uyumlu taşlar yeşil işaretli.`; } };

// Initialize enhancements immediately and after load
initEnhancementUI();
setTimeout(initEnhancementUI,0);
