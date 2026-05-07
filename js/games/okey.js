// ============================================================
// OKEY (4-player) — FIXED VERSION
// Fixes:
//   #1 tileIdx → tile object gönderilir
//   #2 ODRAWN desync → explicit drew flag state'e eklenir
//   #3 fromIdx doğrulaması → host mesaj sahibini bağlantıdan doğrular
//   #4 passive pointerdown → {passive:false} yapıldı
//   #5 okeySort → isOkeyT kontrolü eklendi
//   NEW: 101 puan sistemi + puan göstergesi
// ============================================================
const OCOLS=['kirmizi','sari','mavi','siyah'];
const OCLBL={kirmizi:'🔴',sari:'🟡',mavi:'🔵',siyah:'⚫'};
const OCCSS={kirmizi:'#e74c3c',sari:'#c9a800',mavi:'#2471a3',siyah:'#34495e'};

let OState={
  pile:[],discard:[],hands:{},indicator:null,
  currentIdx:0,handCounts:{},finished:[],opened:{},
  scores:{}, // NEW: oyuncu skorları
  round:1,   // NEW: tur sayısı
  drewFlags:{} // FIX #2: her oyuncunun çekme durumu sunucuda tutulur
};
let OSEL=null,ODRAWN=false,ODRAG=null,OSLOTS=null;

function buildOkeyPile(){
  const t=[];
  OCOLS.forEach(col=>{for(let n=1;n<=13;n++){t.push({col,num:n,j:false});t.push({col,num:n,j:false});}});
  t.push({col:'okey',num:0,j:true});t.push({col:'okey',num:0,j:true});
  for(let i=t.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[t[i],t[j]]=[t[j],t[i]];}
  return t;
}
function isOkeyT(t){if(!OState.indicator)return false;if(t.j)return true;const nxt=OState.indicator.num%13+1;return t.col===OState.indicator.col&&t.num===nxt;}
function otiLbl(t){if(!t)return'?';if(t.j||isOkeyT(t))return'★';return(OCLBL[t.col]||'?')+t.num;}
function otiSty(t){const ok=isOkeyT(t);if(!t||t.j||ok)return{bg:'linear-gradient(135deg,#f39c12,#e67e22)',col:'white'};return{bg:'#f5f0e8',col:OCCSS[t.col]||'#333'};}

// ============================================================
// NEW: 101 PUAN SİSTEMİ
// ============================================================
function calcHandScore(hand){
  if(!hand||hand.length===0) return 0;
  let total=0;
  hand.forEach(t=>{
    if(t.j||isOkeyT(t)) total+=50; // joker/okey en pahalı
    else total+=t.num; // taşın sayısı kadar puan
  });
  return total;
}

function calcAllScores(){
  const scores={};
  players.forEach(p=>{
    scores[p.idx]=OState.scores?.[p.idx]||0;
  });
  return scores;
}

function renderOkey101Bar(){
  const bar=document.getElementById('okey-101-bar');
  if(!bar) return;
  bar.innerHTML='';
  const target=101;
  players.forEach(p=>{
    const cumScore=(OState.scores?.[p.idx]||0);
    const handScore=isHost?(calcHandScore(OState.hands[p.idx]||[])):(p.idx===myIdx?calcHandScore(OState.hands[myIdx]||[]):0);
    const pct=Math.min(100,(cumScore/target)*100);
    const isMe=p.idx===myIdx;
    const isActive=OState.currentIdx===p.idx;
    const dangerPct=pct>=80?'#e74c3c':pct>=60?'#e67e22':'#2ecc71';

    const row=document.createElement('div');
    row.className='okey-score-row'+(isMe?' me':'')+(isActive?' active':'');
    row.innerHTML=`
      <div class="okey-score-name">${esc(p.name)}${isActive?' ▶':''}</div>
      <div class="okey-score-track">
        <div class="okey-score-fill" style="width:${pct}%;background:${dangerPct}"></div>
        <div class="okey-score-label">${cumScore}<span class="okey-score-sub"> / ${target}</span></div>
      </div>
      <div class="okey-score-hand" title="Eldeki taşların tahmini puanı">${isMe||isHost?'+'+handScore:'?'}</div>
    `;
    bar.appendChild(row);
  });
}

function applyRoundScores(winnerIdx){
  // Kazanan hariç herkes elindeki taşların puanını alır
  if(!isHost) return;
  players.forEach(p=>{
    if(p.idx===winnerIdx) return; // kazanan puan almaz
    const handScore=calcHandScore(OState.hands[p.idx]||[]);
    OState.scores[p.idx]=(OState.scores[p.idx]||0)+handScore;
  });
  // 101'i geçen var mı?
  const over=players.filter(p=>(OState.scores[p.idx]||0)>=101);
  if(over.length>0){
    // Oyun bitti, en az puanı olan kazanır
    const sorted=[...players].sort((a,b)=>(OState.scores[a.idx]||0)-(OState.scores[b.idx]||0));
    const finalWinner=sorted[0];
    const rankings=sorted.map(p=>({
      name:p.name,
      info:`${OState.scores[p.idx]||0} puan`
    }));
    broadcastAll({t:'okey-gameover',rankings,winnerIdx:finalWinner.idx,finalScores:OState.scores});
    gameOver(finalWinner.idx===myIdx,'',rankings);
    return;
  }
  // Devam: yeni tur başlat
  OState.round=(OState.round||1)+1;
  const savedScores=OState.scores;
  const savedRound=OState.round;
  // Reset tur
  const pile=buildOkeyPile();
  const iIdx=Math.floor(Math.random()*pile.length);
  const indicator=pile.splice(iIdx,1)[0];
  const hands={};
  players.forEach((p,pi)=>{hands[p.idx]=pile.splice(0,pi===0?15:14);});
  OState={pile,discard:[],hands,indicator,
    currentIdx:players[0].idx,
    handCounts:{},finished:[],opened:{},
    scores:savedScores,round:savedRound,drewFlags:{}
  };
  players.forEach(p=>{OState.handCounts[p.idx]=OState.hands[p.idx].length;});
  addSys('okey',`Tur ${OState.round} başladı!`);
  broadcastFullOkeyState();
}

// ============================================================
// FIX #3: fromIdx doğrulama yardımcısı
// ============================================================
function okeyVerifyFromIdx(d, expectedIdx){
  // Host: gelen mesajın fromIdx'i bağlantıya ait oyuncuyla eşleşmeli
  if(!isHost) return false;
  if(d.fromIdx !== expectedIdx){
    console.warn('[OKEY] fromIdx spoofing attempt:',d);
    return false;
  }
  return true;
}

function initOkey(){
  OSEL=null;ODRAWN=false;OSLOTS=null;
  maxPlayers=4;
  if(isHost){
    const pile=buildOkeyPile();
    const iIdx=Math.floor(Math.random()*pile.length);
    const indicator=pile.splice(iIdx,1)[0];
    const hands={};
    const scores={};
    players.forEach((p,pi)=>{
      hands[p.idx]=pile.splice(0,pi===0?15:14);
      scores[p.idx]=OState.scores?.[p.idx]||0; // skorları koru
    });
    OState={pile,discard:[],hands,indicator,currentIdx:players[0].idx,
      handCounts:{},finished:[],opened:{},scores,round:OState.round||1,drewFlags:{}};
    players.forEach(p=>{OState.handCounts[p.idx]=OState.hands[p.idx].length;});
    broadcastFullOkeyState();
  }
  renderOkey();updateOkeyTurn();
  addSys('okey','Oyun başladı! 4 kişilik masa.');
}

function broadcastFullOkeyState(){
  players.forEach(p=>{
    if(p.idx===myIdx)return;
    const conn=hostConns[p.idx-1];
    const state={
      t:'okey-state',
      indicator:OState.indicator,
      myHand:OState.hands[p.idx],
      discard:OState.discard,
      handCounts:{},
      currentIdx:OState.currentIdx,
      pileSize:OState.pile.length,
      finished:OState.finished,
      opened:OState.opened,
      scores:OState.scores,   // NEW
      round:OState.round,     // NEW
      drewFlag:OState.drewFlags?.[p.idx]||false // FIX #2
    };
    players.forEach(pl=>{state.handCounts[pl.idx]=OState.hands[pl.idx]?.length||0;});
    if(conn&&conn.open)conn.send(state);
  });
  renderOkey();updateOkeyTurn();
}

function okeyMsg(d){
  if(d.t==='okey-state'){
    OState.indicator=d.indicator;
    OState.hands[myIdx]=d.myHand;
    OState.discard=d.discard;
    OState.handCounts=d.handCounts;
    OState.currentIdx=d.currentIdx;
    OState.pileSize=d.pileSize;
    OState.finished=d.finished||[];
    OState.opened=d.opened||{};
    OState.scores=d.scores||{};   // NEW
    OState.round=d.round||1;      // NEW
    // FIX #2: ODRAWN doğrudan host'tan gelir
    if(d.currentIdx===myIdx){
      ODRAWN=d.drewFlag||false;
    } else {
      ODRAWN=false;OSEL=null;
    }
  } else if(d.t==='okey-drew'){
    // Guest taş çekti, sadece kendi eli güncellendi
    OState.hands[myIdx]=OState.hands[myIdx]||[];
    OState.hands[myIdx].push(d.tile);
    OState.discard=d.discard;
    OState.pileSize=d.pileSize;
    ODRAWN=true; // FIX #2: drew mesajı gelince set et
    renderOkey();
  } else if(d.t==='okey-draw-pile'&&isHost){
    // FIX #3: bağlantıdan gelen fromIdx doğrula
    const pIdx=getPlayerIdxFromConn(d._connId);
    if(pIdx&&okeyVerifyFromIdx({fromIdx:pIdx},pIdx)) applyOkeyDraw(pIdx,'pile');
  } else if(d.t==='okey-draw-discard'&&isHost){
    const pIdx=getPlayerIdxFromConn(d._connId);
    if(pIdx&&okeyVerifyFromIdx({fromIdx:pIdx},pIdx)) applyOkeyDraw(pIdx,'discard');
  } else if(d.t==='okey-discard'&&isHost){
    // FIX #1+#3: tile objesi ile çalış, fromIdx doğrula
    const pIdx=getPlayerIdxFromConn(d._connId);
    if(pIdx&&okeyVerifyFromIdx({fromIdx:pIdx},pIdx)) applyOkeyDiscard(pIdx,d.tile);
  } else if(d.t==='okey-declare'&&isHost){
    const pIdx=getPlayerIdxFromConn(d._connId);
    if(pIdx&&okeyVerifyFromIdx({fromIdx:pIdx},pIdx)) applyOkeyDeclare(pIdx);
  } else if(d.t==='okey-open'&&isHost){
    const pIdx=getPlayerIdxFromConn(d._connId);
    if(pIdx&&okeyVerifyFromIdx({fromIdx:pIdx},pIdx)) applyOkeyOpen(pIdx,d.mode);
  } else if(d.t==='okey-open-result'){
    if(!d.ok)toast(d.reason||'El açılamadı');
  }
}

// FIX #3: bağlantı → oyuncu idx yardımcısı
function getPlayerIdxFromConn(connId){
  if(!connId) return null;
  // hostConns dizisinde connId'ye göre bul
  for(let i=0;i<hostConns.length;i++){
    if(hostConns[i]&&hostConns[i].peer===connId) return players[i+1]?.idx;
  }
  return null;
}

function normalizeOkeyTile(t){
  return {col:t.col,num:t.num,j:!!t.j};
}
function groupLabelFromMode(mode){
  return mode==='seri'?'Seri':'Sıralı';
}
function okeyCanOpenByMode(hand,mode){
  const tiles=(hand||[]).map((t,i)=>({...normalizeOkeyTile(t),id:i}));
  const jokers=tiles.filter(t=>t.j||isOkeyT(t)).length;
  const normal=tiles.filter(t=>!(t.j||isOkeyT(t)));
  const memo=new Map();

  function key(rem,j){
    return rem.map(t=>`${t.col}:${t.num}:${t.id}`).sort().join('|')+'#'+j;
  }

  function genSetGroups(rem,j,base){
    const sameNum=rem.filter(t=>t.num===base.num && t.col!==base.col);
    const groups=[];
    const candidates=[];
    for(const t of sameNum){
      if(!candidates.some(x=>x.col===t.col)) candidates.push(t);
    }
    for(let mask=0; mask < (1<<candidates.length); mask++){
      const picked=[base];
      let colors=new Set([base.col]);
      for(let i=0;i<candidates.length;i++) if(mask&(1<<i)){
        if(colors.has(candidates[i].col)) { colors=null; break; }
        colors.add(candidates[i].col); picked.push(candidates[i]);
      }
      if(!colors) continue;
      if(picked.length>4) continue;
      const need3=Math.max(0,3-picked.length);
      const need4=Math.max(0,4-picked.length);
      if(need3<=j) groups.push({tiles:picked,jokers:need3});
      if(picked.length>=3) groups.push({tiles:picked,jokers:0});
      else if(need4<=j && picked.length<4) groups.push({tiles:picked,jokers:need4});
    }
    const uniq=[]; const seen=new Set();
    for(const g of groups){
      const k=g.tiles.map(t=>t.id).sort((a,b)=>a-b).join(',')+'#'+g.jokers;
      if(!seen.has(k) && g.tiles.length+g.jokers>=3 && g.tiles.length+g.jokers<=4){ seen.add(k); uniq.push(g); }
    }
    return uniq;
  }

  function genRunGroups(rem,j,base){
    const sameColor=rem.filter(t=>t.col===base.col);
    const numMap=new Map();
    for(const t of sameColor){ if(!numMap.has(t.num)) numMap.set(t.num,[]); numMap.get(t.num).push(t); }
    const groups=[];
    for(let start=Math.max(1,base.num-4); start<=base.num; start++){
      for(let len=3; len<=7; len++){
        const end=start+len-1;
        if(end>13 || !(base.num>=start && base.num<=end)) continue;
        const picked=[];
        let need=0;
        let valid=true;
        for(let n=start;n<=end;n++){
          const arr=numMap.get(n);
          if(arr && arr.length){ picked.push(arr[0]); }
          else need++;
          if(need>j){ valid=false; break; }
        }
        if(valid) groups.push({tiles:picked,jokers:need});
      }
    }
    const uniq=[]; const seen=new Set();
    for(const g of groups){
      const k=g.tiles.map(t=>t.id).sort((a,b)=>a-b).join(',')+'#'+g.jokers;
      if(!seen.has(k)){ seen.add(k); uniq.push(g); }
    }
    return uniq;
  }

  function solve(rem,j){
    if(rem.length===0) return j===0;
    const k=key(rem,j);
    if(memo.has(k)) return memo.get(k);
    const base=rem[0];
    let groups=[];
    if(mode==='seri') groups=genSetGroups(rem,j,base);
    else groups=genRunGroups(rem,j,base);
    for(const g of groups){
      const used=new Set(g.tiles.map(t=>t.id));
      const next=rem.filter(t=>!used.has(t.id));
      if(solve(next,j-g.jokers)){ memo.set(k,true); return true; }
    }
    memo.set(k,false); return false;
  }

  return solve(normal,jokers);
}

function applyOkeyOpen(fromIdx,mode){
  if(!isHost) return;
  const hand=OState.hands[fromIdx]||[];
  const ok=okeyCanOpenByMode(hand,mode);
  if(!ok){
    if(fromIdx===myIdx) toast(mode==='seri'?'Bu elde geçerli seri dizilim yok!':'Bu elde geçerli sıralı dizilim yok!');
    else {
      const conn=hostConns[fromIdx-1];
      if(conn&&conn.open) conn.send({t:'okey-open-result',ok:false,reason:mode==='seri'?'Geçerli seri dizilim bulunamadı.':'Geçerli sıralı dizilim bulunamadı.'});
    }
    return;
  }
  OState.opened[fromIdx]=mode;
  const p=players.find(x=>x.idx===fromIdx);
  addSys('okey',(p?.name||'Bir oyuncu')+' el açtı: '+groupLabelFromMode(mode));
  broadcastAll({t:'chat',msg:'El açtı: '+groupLabelFromMode(mode),fromIdx:fromIdx});
  broadcastFullOkeyState();
}

function okeyOpenHand(){
  if(!ODRAWN){toast('Önce taş çek!');return;}
  const mode=document.getElementById('okey-open-mode').value;
  if(isHost) applyOkeyOpen(myIdx,mode);
  else sendToHost({t:'okey-open',mode});
}

function applyOkeyDraw(fromIdx,source){
  if(!isHost)return;
  let tile;
  if(source==='pile'){
    if(OState.pile.length===0){toast('Deste bitti!');broadcastAll({t:'chat',msg:'Deste bitti, devam edilemiyor.',fromIdx:0});return;}
    tile=OState.pile.pop();
    OState.hands[fromIdx].push(tile);
  } else {
    if(OState.discard.length===0)return;
    tile=OState.discard.pop();
    OState.hands[fromIdx].push(tile);
  }
  OState.handCounts[fromIdx]=(OState.hands[fromIdx]?.length||0);
  // FIX #2: drew flag'i state'de tut
  if(!OState.drewFlags) OState.drewFlags={};
  OState.drewFlags[fromIdx]=true;
  if(fromIdx===myIdx){ODRAWN=true;}
  else{
    const conn=hostConns[fromIdx-1];
    if(conn&&conn.open)conn.send({t:'okey-drew',tile,source,discard:OState.discard,pileSize:OState.pile.length});
  }
  broadcastFullOkeyState();
}

// FIX #1: tileIdx yerine tile objesi alır
function applyOkeyDiscard(fromIdx, tileOrIdx){
  if(!isHost)return;
  const hand=OState.hands[fromIdx];
  if(!hand)return;
  let tileIdx=-1;
  // Geriye dönük uyumluluk: sayı geldiyse eski davranış, obje geldiyse eşleştir
  if(typeof tileOrIdx==='number'){
    tileIdx=tileOrIdx;
  } else if(tileOrIdx && typeof tileOrIdx==='object'){
    // col+num+j ile eşleştir (ilk eşleşen)
    tileIdx=hand.findIndex(t=>
      t.col===tileOrIdx.col &&
      t.num===tileOrIdx.num &&
      !!t.j===!!tileOrIdx.j
    );
  }
  if(tileIdx<0||tileIdx>=hand.length)return;
  const tile=hand.splice(tileIdx,1)[0];
  OState.discard.push(tile);
  OState.handCounts[fromIdx]=(OState.hands[fromIdx]?.length||0);
  // FIX #2: drew flag sıfırla
  if(OState.drewFlags) OState.drewFlags[fromIdx]=false;
  const activePs=players.filter(p=>!OState.finished.includes(p.idx));
  const cur=activePs.findIndex(p=>p.idx===fromIdx);
  OState.currentIdx=activePs[(cur+1)%activePs.length].idx;
  broadcastFullOkeyState();
}

function applyOkeyDeclare(fromIdx){
  if(!isHost)return;
  OState.finished.push(fromIdx);
  const p=players.find(p=>p.idx===fromIdx);
  if(OState.finished.length===1){
    // Kazanan belirlendi, puan hesapla
    applyRoundScores(fromIdx);
  }
}


let _okeyJokerCounter=0;
function okeyEnsureSlots(){
  const hand=OState.hands?.[myIdx]||[];
  const desired=Math.max(30, hand.length);
  if(!Array.isArray(OSLOTS)){
    OSLOTS=new Array(desired).fill(null);
    hand.forEach((t,i)=>{OSLOTS[i]=t;});
    return;
  }
  if(OSLOTS.length<desired){
    while(OSLOTS.length<desired) OSLOTS.push(null);
  }
  const counts={};
  hand.forEach(t=>{const k=okeyTileKey(t);counts[k]=(counts[k]||0)+1;});
  const nextSlots=OSLOTS.map(slot=>{
    if(!slot) return null;
    const k=okeyTileKey(slot);
    if(counts[k]>0){counts[k]--; return slot;}
    return null;
  });
  hand.forEach(t=>{
    const k=okeyTileKey(t);
    if(counts[k]>0){
      const emptyIdx=nextSlots.findIndex(x=>x===null);
      if(emptyIdx===-1) nextSlots.push(t);
      else nextSlots[emptyIdx]=t;
      counts[k]--;
    }
  });
  while(nextSlots.length<desired) nextSlots.push(null);
  OSLOTS=nextSlots;
}
function okeySyncHandFromSlots(){
  if(!Array.isArray(OSLOTS)) return;
  OState.hands[myIdx]=OSLOTS.filter(Boolean);
  OState.handCounts[myIdx]=OState.hands[myIdx].length;
}
function okeyReorderTile(fromIdx,toIdx){
  okeyEnsureSlots();
  if(fromIdx===null||toIdx===null||fromIdx===toIdx) return;
  if(fromIdx<0||toIdx<0||fromIdx>=OSLOTS.length||toIdx>=OSLOTS.length) return;
  const fromTile=OSLOTS[fromIdx];
  if(!fromTile) return;
  const targetTile=OSLOTS[toIdx];
  OSLOTS[toIdx]=fromTile;
  OSLOTS[fromIdx]=targetTile||null;
  OSEL=toIdx;
  okeySyncHandFromSlots();
  renderOkey();
}

// ---- DRAG & DROP (mouse) ----
function okeyDragStart(ev,idx){
  ODRAG=idx;
  ev.dataTransfer.effectAllowed='move';
  try{ev.dataTransfer.setData('text/plain',String(idx));}catch(e){}
  setTimeout(()=>{ const el=document.querySelector(`[data-slot="${idx}"]`); if(el) el.classList.add('dragging'); },0);
}
function okeyDragEnd(ev){
  document.querySelectorAll('.otile.dragging').forEach(el=>el.classList.remove('dragging'));
  document.querySelectorAll('.orack-row.drag-over,.otile.drag-over').forEach(el=>el.classList.remove('drag-over'));
  ODRAG=null;
}
function okeyDragOver(ev){
  ev.preventDefault();
  ev.dataTransfer.dropEffect='move';
  const tile=ev.currentTarget.classList.contains('otile')?ev.currentTarget:null;
  const row=ev.currentTarget.classList.contains('orack-row')?ev.currentTarget:ev.currentTarget.closest('.orack-row');
  document.querySelectorAll('.orack-row.drag-over,.otile.drag-over').forEach(el=>el.classList.remove('drag-over'));
  if(tile) tile.classList.add('drag-over');
  else if(row) row.classList.add('drag-over');
}
function okeyDragLeave(ev){
  const related=ev.relatedTarget;
  if(!related||(!related.classList?.contains('otile')&&!related.closest?.('.orack-row'))) {
    document.querySelectorAll('.orack-row.drag-over,.otile.drag-over').forEach(el=>el.classList.remove('drag-over'));
  }
}
function okeyDropTile(ev,toIdx){
  ev.preventDefault();
  ev.stopPropagation();
  document.querySelectorAll('.orack-row.drag-over,.otile.drag-over').forEach(el=>el.classList.remove('drag-over'));
  const fromIdx=ODRAG!==null?ODRAG:parseInt(ev.dataTransfer.getData('text/plain'),10);
  if(Number.isInteger(fromIdx)&&fromIdx!==toIdx) okeyReorderTile(fromIdx,toIdx);
  ODRAG=null;
}
function okeyDropOnRow(ev,rowIndex){
  ev.preventDefault();
  document.querySelectorAll('.orack-row.drag-over,.otile.drag-over').forEach(el=>el.classList.remove('drag-over'));
  okeyEnsureSlots();
  const fromIdx=ODRAG!==null?ODRAG:parseInt(ev.dataTransfer.getData('text/plain'),10);
  if(!Number.isInteger(fromIdx)){ODRAG=null;return;}
  const start=rowIndex===0?0:15;
  const end=Math.min(OSLOTS.length,start+15);
  let toIdx=-1;
  for(let i=start;i<end;i++){ if(OSLOTS[i]===null){ toIdx=i; break; } }
  if(toIdx===-1) toIdx=end-1;
  if(fromIdx!==toIdx) okeyReorderTile(fromIdx,toIdx);
  ODRAG=null;
}

// ---- TOUCH / POINTER drag ----
let okeyPointerDrag={active:false,fromIdx:null,ghost:null,pointerId:null};
function okeyPointerDown(ev,idx){
  if(ev.pointerType==='mouse'&&ev.button!==0) return;
  okeyPointerDrag.fromIdx=idx;
  okeyPointerDrag.pointerId=ev.pointerId;
  okeyPointerDrag._startX=ev.clientX;
  okeyPointerDrag._startY=ev.clientY;
  okeyPointerDrag.active=false;
  ev.currentTarget.setPointerCapture(ev.pointerId);
  // FIX #4: passive:false — pointermove'da preventDefault çalışsın
  ev.currentTarget.addEventListener('pointermove',okeyPointerMove,{passive:false});
  ev.currentTarget.addEventListener('pointerup',okeyPointerUp,{once:true});
  ev.currentTarget.addEventListener('pointercancel',okeyPointerCancel,{once:true});
}
function okeyPointerMove(ev){
  const dx=ev.clientX-okeyPointerDrag._startX;
  const dy=ev.clientY-okeyPointerDrag._startY;
  if(!okeyPointerDrag.active&&Math.sqrt(dx*dx+dy*dy)>8){
    okeyPointerDrag.active=true;
    const src=document.querySelector(`[data-slot="${okeyPointerDrag.fromIdx}"]`);
    if(src){
      const g=src.cloneNode(true);
      g.style.cssText=`position:fixed;z-index:1300;pointer-events:none;width:${src.offsetWidth}px;height:${src.offsetHeight}px;opacity:0.85;transform:rotate(-4deg) scale(1.08);transition:none;left:${ev.clientX-src.offsetWidth/2}px;top:${ev.clientY-src.offsetHeight-10}px;`;
      document.body.appendChild(g);
      okeyPointerDrag.ghost=g;
      src.classList.add('dragging');
    }
  }
  if(okeyPointerDrag.active){
    // FIX #4: sürükleme sırasında sayfayı kaydırma
    ev.preventDefault();
    if(okeyPointerDrag.ghost){
      const w=okeyPointerDrag.ghost.offsetWidth;
      const h=okeyPointerDrag.ghost.offsetHeight;
      okeyPointerDrag.ghost.style.left=(ev.clientX-w/2)+'px';
      okeyPointerDrag.ghost.style.top=(ev.clientY-h-10)+'px';
      okeyPointerDrag.ghost.style.display='none';
      const el=document.elementFromPoint(ev.clientX,ev.clientY);
      okeyPointerDrag.ghost.style.display='';
      document.querySelectorAll('.otile.drop-target,.orack-row.drop-target').forEach(e=>e.classList.remove('drop-target'));
      const tgt=el?.closest?.('.otile')||el?.closest?.('.orack-row');
      if(tgt) tgt.classList.add('drop-target');
    }
  }
}
function okeyPointerUp(ev){
  ev.currentTarget.removeEventListener('pointermove',okeyPointerMove);
  document.querySelectorAll('.otile.dragging').forEach(e=>e.classList.remove('dragging'));
  document.querySelectorAll('.otile.drop-target,.orack-row.drop-target').forEach(e=>e.classList.remove('drop-target'));
  okeyPointerDrag.ghost?.remove(); okeyPointerDrag.ghost=null;
  if(!okeyPointerDrag.active){
    const idx=okeyPointerDrag.fromIdx;
    if(Number.isInteger(idx)){OSEL=OSEL===idx?null:idx;renderOkey();}
    okeyPointerDrag={active:false,fromIdx:null,ghost:null,pointerId:null};
    return;
  }
  const fromIdx=okeyPointerDrag.fromIdx;
  okeyPointerDrag={active:false,fromIdx:null,ghost:null,pointerId:null};
  const el=document.elementFromPoint(ev.clientX,ev.clientY);
  const tileEl=el?.closest?.('.otile');
  const rowEl=el?.closest?.('.orack-row');
  if(tileEl&&tileEl.dataset.slot!==undefined){
    const toIdx=parseInt(tileEl.dataset.slot,10);
    if(Number.isInteger(fromIdx)&&Number.isInteger(toIdx)&&fromIdx!==toIdx) okeyReorderTile(fromIdx,toIdx);
  } else if(rowEl){
    okeyEnsureSlots();
    const rowIdx=rowEl.dataset.rowIndex!==undefined?parseInt(rowEl.dataset.rowIndex,10):0;
    const start=rowIdx===0?0:15;
    const end=Math.min(OSLOTS.length,start+15);
    let toIdx=-1;
    for(let i=start;i<end;i++){ if(OSLOTS[i]===null){ toIdx=i; break; } }
    if(toIdx===-1) toIdx=end-1;
    if(Number.isInteger(fromIdx)&&fromIdx!==toIdx) okeyReorderTile(fromIdx,toIdx);
  }
}
function okeyPointerCancel(ev){
  ev.currentTarget.removeEventListener('pointermove',okeyPointerMove);
  document.querySelectorAll('.otile.dragging').forEach(e=>e.classList.remove('dragging'));
  okeyPointerDrag.ghost?.remove(); okeyPointerDrag.ghost=null;
  okeyPointerDrag={active:false,fromIdx:null,ghost:null,pointerId:null};
}

function renderOkey(){
  // Indicator
  const ind=document.getElementById('okey-ind');
  if(OState.indicator){const s=otiSty(OState.indicator);ind.style.background=s.bg;ind.style.color=s.col;ind.style.fontFamily="'Cinzel',serif";ind.style.fontSize='0.65rem';ind.style.fontWeight='700';ind.textContent=otiLbl(OState.indicator);}
  // Pile count
  const pc=OState.pileSize!==undefined?OState.pileSize:OState.pile?.length||0;
  document.getElementById('okey-pilecnt').textContent=pc+' taş';
  // Discard
  const dt=document.getElementById('okey-disctp');const dc=document.getElementById('okey-disccnt');
  dc.textContent=(OState.discard?.length||0)+' taş';
  if(OState.discard?.length>0){const top=OState.discard[OState.discard.length-1];const s=otiSty(top);dt.style.background=s.bg;dt.style.color=s.col;dt.style.fontFamily="'Cinzel',serif";dt.style.fontSize='0.65rem';dt.style.fontWeight='700';dt.textContent=otiLbl(top);}
  // Opponents
  const oppArea=document.getElementById('okey-opponents');oppArea.innerHTML='';
  const relPos=['pos-left','pos-top','pos-right'];
  players.filter(p=>p.idx!==myIdx).forEach((p,i)=>{
    const cnt=isHost?OState.hands[p.idx]?.length:OState.handCounts?.[p.idx]||0;
    const isActive=OState.currentIdx===p.idx;
    const pScore=OState.scores?.[p.idx]||0;
    const div=document.createElement('div');div.className='okey-opp-area '+(relPos[i]||'')+(isActive?' active-player':'');
    div.innerHTML=`<div class="okey-opp-name">${esc(p.name)}<span class="okey-opp-score">${pScore}p</span></div><div class="okey-opp-tiles"></div>`;
    const tilesDiv=div.querySelector('.okey-opp-tiles');
    for(let i=0;i<Math.min(cnt||0,14);i++){const tb=document.createElement('div');tb.className='otb';tilesDiv.appendChild(tb);}
    oppArea.appendChild(div);
  });
  // My rack
  const myHand=OState.hands?.[myIdx]||[];
  okeyEnsureSlots();
  const mr=document.getElementById('okey-myr');mr.innerHTML='';
  const topRow=document.createElement('div');topRow.className='orack-row';topRow.dataset.rowIndex='0';
  const bottomRow=document.createElement('div');bottomRow.className='orack-row';bottomRow.dataset.rowIndex='1';
  topRow.addEventListener('dragover',okeyDragOver);
  bottomRow.addEventListener('dragover',okeyDragOver);
  topRow.addEventListener('dragleave',okeyDragLeave);
  bottomRow.addEventListener('dragleave',okeyDragLeave);
  topRow.addEventListener('drop',(ev)=>okeyDropOnRow(ev,0));
  bottomRow.addEventListener('drop',(ev)=>okeyDropOnRow(ev,1));
  const slotCount=Math.max(30,OSLOTS.length);
  for(let i=0;i<slotCount;i++){
    const t=OSLOTS[i]||null;
    const el=document.createElement('div');
    el.dataset.slot=String(i);
    if(!t){
      el.className='otile empty';
      el.addEventListener('dragover',okeyDragOver);
      el.addEventListener('dragleave',okeyDragLeave);
      el.addEventListener('drop',(ev)=>{ev.stopPropagation();okeyDropTile(ev,i);});
      el.addEventListener('click',()=>{OSEL=null;renderOkey();});
    }else{
      el.className='otile'+(i===OSEL?' osel':'')+(t.j?' ojok':'');
      const s=otiSty(t);el.style.background=s.bg;
      el.draggable=true;
      el.innerHTML=`<div class="tnum" style="color:${s.col}">${t.j||isOkeyT(t)?'★':t.num}</div><div class="tcol" style="color:${s.col}">${t.j||isOkeyT(t)?'OK':OCLBL[t.col]||''}</div>`;
      el.addEventListener('dragstart',(ev)=>okeyDragStart(ev,i));
      el.addEventListener('dragend',okeyDragEnd);
      el.addEventListener('dragover',okeyDragOver);
      el.addEventListener('dragleave',okeyDragLeave);
      el.addEventListener('drop',(ev)=>{ev.stopPropagation();okeyDropTile(ev,i);});
      // FIX #4: passive:false
      el.addEventListener('pointerdown',(ev)=>okeyPointerDown(ev,i),{passive:false});
    }
    (i<15?topRow:bottomRow).appendChild(el);
  }
  mr.appendChild(topRow);
  mr.appendChild(bottomRow);
  const isMyTurn=OState.currentIdx===myIdx;
  document.getElementById('okey-discbtn').disabled=!isMyTurn||!ODRAWN;
  document.getElementById('okey-declbtn').disabled=!isMyTurn||!ODRAWN;
  document.getElementById('okey-openbtn').disabled=!isMyTurn||!ODRAWN;
  const selfOpened=OState.opened?.[myIdx];
  document.getElementById('okey-open-state').innerHTML=selfOpened?`Elin açık <span class="okey-open-badge">${groupLabelFromMode(selfOpened)}</span>`:'Henüz el açılmadı';
  // NEW: 101 puan barını güncelle
  renderOkey101Bar();
}

function updateOkeyTurn(){
  const el=document.getElementById('okey-turn');
  const isMyTurn=OState.currentIdx===myIdx;
  const round=OState.round||1;
  if(isMyTurn){
    el.textContent=`▶ Senin sıran — Taş çek! (Tur ${round})`;el.className='turnbar my';
  } else {
    const p=players.find(p=>p.idx===OState.currentIdx);
    el.textContent=`${p?.name||'?'} oynuyor... (Tur ${round})`;el.className='turnbar opp';
  }
}

function okeyDraw(source){
  if(OState.currentIdx!==myIdx||ODRAWN||!gameActive)return;
  if(source==='pile'){
    if(isHost){applyOkeyDraw(myIdx,'pile');ODRAWN=true;renderOkey();}
    else sendToHost({t:'okey-draw-pile'});
  } else {
    if(OState.discard?.length===0){toast('Çöplük boş!');return;}
    if(isHost){applyOkeyDraw(myIdx,'discard');ODRAWN=true;renderOkey();}
    else sendToHost({t:'okey-draw-discard'});
  }
}

function okeyDiscard(){
  if(OSEL===null){toast('Atmak için taş seç!');return;}
  okeyEnsureSlots();
  if(!OSLOTS[OSEL]){toast('Atmak için dolu bir taş seç!');return;}
  if(!ODRAWN){toast('Önce taş çek!');return;}
  // FIX #1: index yerine taşın kendisini gönder
  const tile=OSLOTS[OSEL];
  if(isHost){
    // Host: tileOrIdx olarak tile objesi gönder
    applyOkeyDiscard(myIdx,tile);
    OSLOTS[OSEL]=null;okeySyncHandFromSlots();OSEL=null;ODRAWN=false;renderOkey();
  } else {
    sendToHost({t:'okey-discard',tile:tile}); // FIX #1
    OSEL=null;
  }
}

// FIX #5: okeySort — isOkeyT kontrolü eklendi
function okeySort(){
  const hand=OState.hands[myIdx];if(!hand)return;
  hand.sort((a,b)=>{
    const aJok=a.j||isOkeyT(a);
    const bJok=b.j||isOkeyT(b);
    if(aJok&&bJok) return 0;
    if(aJok) return 1;  // joker/okey sona
    if(bJok) return -1;
    const ci=OCOLS.indexOf(a.col)-OCOLS.indexOf(b.col);
    return ci||a.num-b.num;
  });
  OSLOTS=new Array(Math.max(30,hand.length)).fill(null);
  hand.forEach((t,i)=>{OSLOTS[i]=t;});
  OSEL=null;renderOkey();
}

function okeyDeclare(){
  if(!ODRAWN){toast('Önce taş çek!');return;}
  if(isHost){applyOkeyDeclare(myIdx);}
  else sendToHost({t:'okey-declare'});
}

// ============================================================
// HTML/CSS EKİ — 101 puan paneli için gereken CSS
// Bu string'i oyun HTML'ine ekle (okey bölümündeki <style> içine)
// ============================================================
const OKEY_101_CSS = `
.okey-score-panel{margin:6px 0;background:rgba(0,0,0,0.12);border-radius:8px;padding:6px 8px;}
.okey-score-panel-title{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;opacity:.6;margin-bottom:4px;}
.okey-score-row{display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 4px;border-radius:5px;}
.okey-score-row.me{background:rgba(255,255,255,0.1);}
.okey-score-row.active{outline:1px solid rgba(255,255,255,0.3);}
.okey-score-name{width:68px;font-size:0.62rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:inherit;}
.okey-score-track{flex:1;position:relative;height:14px;background:rgba(0,0,0,0.25);border-radius:7px;overflow:hidden;}
.okey-score-fill{height:100%;border-radius:7px;transition:width .4s ease;}
.okey-score-label{position:absolute;right:5px;top:50%;transform:translateY(-50%);font-size:0.6rem;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.5);}
.okey-score-sub{opacity:.7;}
.okey-score-hand{width:26px;text-align:right;font-size:0.58rem;opacity:.7;color:inherit;}
.okey-opp-score{margin-left:4px;font-size:0.58rem;opacity:.75;font-weight:600;}
`;
