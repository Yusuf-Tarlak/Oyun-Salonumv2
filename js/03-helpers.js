// ============================================================
// INIT
// ============================================================


function unoBestPlayableIndex(){
  const hand=UState.hands?.[myIdx]||[]; const top=UState.discard?.[UState.discard.length-1];
  const playable=[]; hand.forEach((c,i)=>{if(unoCanPlay(c,top,UState.currentColor)&&!UState.mustDraw) playable.push({c,i});});
  if(!playable.length) return -1;
  const score = (card)=>{ let s=0; if(card.col==='black') s-=4; if(card.val==='+2') s+=6; if(card.val==='Skip'||card.val==='Rev') s+=5; if(card.val==='Wild+4') s+=8; if(/^\d+$/.test(String(card.val))) s+=parseInt(card.val,10)/10; const sameColor=(hand.filter(x=>x.col===card.col).length); s += sameColor; return s; };
  playable.sort((a,b)=>score(b.c)-score(a.c)); return playable[0].i;
}
function unoSuggestMove(){ const idx=unoBestPlayableIndex(); if(idx<0){toast('En iyi hamle: kart çek'); return;} const card=UState.hands[myIdx][idx]; toast('Öneri: '+(card.col==='black'?'özel kart':'kartı oyna')+' · '+card.val); }
function unoApplySeatClasses(div,seat){div.classList.add(seat);}
function unoMaybePenalty(){
  if(!isHost||UPendingUno===null) return;
  const idx=UPendingUno;
  const hand=UState.hands[idx]||[];
  if(hand.length===1){
    if(UState.deck.length<2) unoReshuffleDeck();
    const drawn=UState.deck.splice(0,Math.min(2,UState.deck.length));
    hand.push(...drawn);
    addSys('uno',(players.find(p=>p.idx===idx)?.name||'Bir oyuncu')+' UNO demedi, +2 cezası aldı!');
  }
  UPendingUno=null;
}



// Okey helpers
function okeyTileKey(t){ return t ? `${t.col||'j'}-${t.num||0}-${t.j?1:0}` : 'x'; }
function okeyAllTiles(){ return OState.hands?.[myIdx]||[]; }
function okeyHintScore(tile, hand){ if(!tile) return -999; if(tile.j||isOkeyT(tile)) return 999; let score=0; const sameNum=hand.filter(t=>t&&t.col!==tile.col&&!t.j&&t.num===tile.num).length; score += sameNum*4; const sameColor=hand.filter(t=>t&&!t.j&&t.col===tile.col).map(t=>t.num); if(sameColor.includes(tile.num-1)) score+=3; if(sameColor.includes(tile.num+1)) score+=3; if(sameColor.includes(tile.num-2)) score+=1.5; if(sameColor.includes(tile.num+2)) score+=1.5; score -= tile.num===1||tile.num===13 ? .5:0; return score; }
function okeySuggestMove(){ const hand=okeyAllTiles(); if(!hand.length){toast('Elde taş yok.');return;} let bestIdx=0, bestVal=Infinity; hand.forEach((t,i)=>{ const sc=okeyHintScore(t,hand); if(sc<bestVal){bestVal=sc; bestIdx=i;} }); okeyEnsureSlots(); const slotIdx=OSLOTS.findIndex(t=>t&&okeyTileKey(t)===okeyTileKey(hand[bestIdx])); OSEL=slotIdx>=0?slotIdx:bestIdx; renderOkey(); toast('Öneri: işaretli taşı atmayı düşün.'); }
function okeyComputeHighlightKeys(mode){ const hand=okeyAllTiles().filter(Boolean); const keys=new Set(); if(!hand.length) return keys; const groups={}; hand.forEach(t=>{ if(t.j||isOkeyT(t)) return; (groups[t.col]=groups[t.col]||[]).push(t.num); }); Object.entries(groups).forEach(([col,nums])=>{ nums=[...new Set(nums)].sort((a,b)=>a-b); let run=[nums[0]]; for(let i=1;i<nums.length;i++){ if(nums[i]===nums[i-1]+1){ run.push(nums[i]); } else { if(run.length>=3 && (mode!=='seri')) run.forEach(n=>keys.add(`${col}-${n}-0`)); run=[nums[i]]; } } if(run.length>=3 && (mode!=='seri')) run.forEach(n=>keys.add(`${col}-${n}-0`)); }); const sets={}; hand.forEach(t=>{ if(t.j||isOkeyT(t)) return; (sets[t.num]=sets[t.num]||[]).push(t.col); }); Object.entries(sets).forEach(([num,cols])=>{ if(cols.length>=3 && (mode!=='sirali')) cols.forEach(col=>keys.add(`${col}-${num}-0`)); }); return keys; }
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]
// [removed duplicate]

// Initialize enhancements immediately and after load
initEnhancementUI();
setTimeout(initEnhancementUI,0);
