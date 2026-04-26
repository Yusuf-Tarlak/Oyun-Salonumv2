// ============================================================
// OKEY (4-player)
// ============================================================
const OCOLS=['kirmizi','sari','mavi','siyah'];
const OCLBL={kirmizi:'🔴',sari:'🟡',mavi:'🔵',siyah:'⚫'};
const OCCSS={kirmizi:'#e74c3c',sari:'#c9a800',mavi:'#2471a3',siyah:'#34495e'};

let OState={
  pile:[],discard:[],hands:{},indicator:null,
  currentIdx:0,handCounts:{},finished:[],opened:{}
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

function initOkey(){
  OSEL=null;ODRAWN=false;OSLOTS=null;
  maxPlayers=4;
  if(isHost){
    const pile=buildOkeyPile();
    const iIdx=Math.floor(Math.random()*pile.length);
    const indicator=pile.splice(iIdx,1)[0];
    const hands={};
    // First player gets 15, others get 14
    players.forEach((p,pi)=>{hands[p.idx]=pile.splice(0,pi===0?15:14);});
    OState={pile,discard:[],hands,indicator,currentIdx:players[0].idx,handCounts:{},finished:[],opened:{}};
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
      opened:OState.opened
    };
    players.forEach(pl=>{state.handCounts[pl.idx]=OState.hands[pl.idx]?.length||0;});
    if(conn&&conn.open)conn.send(state);
  });
  renderOkey();updateOkeyTurn();
}

function okeyMsg(d){
  if(d.t==='okey-state'){
    const prevCount=OState.hands[myIdx]?.length||0;
    OState.indicator=d.indicator;
    OState.hands[myIdx]=d.myHand;
    OState.discard=d.discard;
    OState.handCounts=d.handCounts;
    OState.currentIdx=d.currentIdx;
    OState.pileSize=d.pileSize;
    OState.finished=d.finished||[];
    OState.opened=d.opened||{};
    const newCount=OState.hands[myIdx]?.length||0;
    if(d.currentIdx===myIdx && newCount>prevCount){ODRAWN=true;}
    else if(d.currentIdx!==myIdx){ODRAWN=false;OSEL=null;}
  } else if(d.t==='okey-draw-pile'&&isHost){
    applyOkeyDraw(d.fromIdx,'pile');
  } else if(d.t==='okey-draw-discard'&&isHost){
    applyOkeyDraw(d.fromIdx,'discard');
  } else if(d.t==='okey-discard'&&isHost){
    applyOkeyDiscard(d.fromIdx,d.tileIdx);
  } else if(d.t==='okey-declare'&&isHost){
    applyOkeyDeclare(d.fromIdx);
  } else if(d.t==='okey-open'&&isHost){
    applyOkeyOpen(d.fromIdx,d.mode);
  } else if(d.t==='okey-open-result'){
    if(!d.ok)toast(d.reason||'El açılamadı');
  }
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
    // size 3
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
  // Send drawn tile only to that player + update counts to all
  if(fromIdx===myIdx){ODRAWN=true;}
  else{
    const conn=hostConns[fromIdx-1];
    if(conn&&conn.open)conn.send({t:'okey-drew',tile,source,discard:OState.discard,pileSize:OState.pile.length});
  }
  broadcastFullOkeyState();
}

function applyOkeyDiscard(fromIdx,tileIdx){
  if(!isHost)return;
  const hand=OState.hands[fromIdx];
  if(!hand||tileIdx>=hand.length)return;
  const tile=hand.splice(tileIdx,1)[0];
  OState.discard.push(tile);
  OState.handCounts[fromIdx]=(OState.hands[fromIdx]?.length||0);
  // Next player
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
    // First finisher wins
    const rankings=players.map(pl=>({
      name:pl.name,
      info:OState.finished.includes(pl.idx)?'Tamamladı':(OState.hands[pl.idx]?.length||0)+' taş kaldı'
    }));
    rankings.sort((a,b)=>OState.finished.indexOf(players.find(p=>p.name===a.name)?.idx)-OState.finished.indexOf(players.find(p=>p.name===b.name)?.idx));
    broadcastAll({t:'okey-gameover',rankings,winnerIdx:fromIdx});
    const iWon=fromIdx===myIdx;
    gameOver(iWon,'',rankings);
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
  // Swap: if target is empty just move, if occupied swap
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
  // Highlight closest slot or row
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
  // Only fire if dropped directly on row background, not on a tile (tiles call stopPropagation)
  okeyEnsureSlots();
  const fromIdx=ODRAG!==null?ODRAG:parseInt(ev.dataTransfer.getData('text/plain'),10);
  if(!Number.isInteger(fromIdx)){ODRAG=null;return;}
  // Find first empty slot in that row
  const start=rowIndex===0?0:15;
  const end=Math.min(OSLOTS.length,start+15);
  let toIdx=-1;
  for(let i=start;i<end;i++){ if(OSLOTS[i]===null){ toIdx=i; break; } }
  // If row is full, drop at last slot of that row (swap)
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
  // Start ghost on move, not on down (to allow click/select on short tap)
  okeyPointerDrag._startX=ev.clientX;
  okeyPointerDrag._startY=ev.clientY;
  okeyPointerDrag.active=false;
  ev.currentTarget.setPointerCapture(ev.pointerId);
  ev.currentTarget.addEventListener('pointermove',okeyPointerMove,{passive:false});
  ev.currentTarget.addEventListener('pointerup',okeyPointerUp,{once:true});
  ev.currentTarget.addEventListener('pointercancel',okeyPointerCancel,{once:true});
}
function okeyPointerMove(ev){
  const dx=ev.clientX-okeyPointerDrag._startX;
  const dy=ev.clientY-okeyPointerDrag._startY;
  if(!okeyPointerDrag.active&&Math.sqrt(dx*dx+dy*dy)>8){
    okeyPointerDrag.active=true;
    // Build ghost
    const src=document.querySelector(`[data-slot="${okeyPointerDrag.fromIdx}"]`);
    if(src){
      const g=src.cloneNode(true);
      g.style.cssText=`position:fixed;z-index:1300;pointer-events:none;width:${src.offsetWidth}px;height:${src.offsetHeight}px;opacity:0.85;transform:rotate(-4deg) scale(1.08);transition:none;left:${ev.clientX-src.offsetWidth/2}px;top:${ev.clientY-src.offsetHeight-10}px;`;
      document.body.appendChild(g);
      okeyPointerDrag.ghost=g;
      src.classList.add('dragging');
    }
  }
  if(okeyPointerDrag.active&&okeyPointerDrag.ghost){
    const w=okeyPointerDrag.ghost.offsetWidth;
    const h=okeyPointerDrag.ghost.offsetHeight;
    okeyPointerDrag.ghost.style.left=(ev.clientX-w/2)+'px';
    okeyPointerDrag.ghost.style.top=(ev.clientY-h-10)+'px';
    // Highlight target
    okeyPointerDrag.ghost.style.display='none';
    const el=document.elementFromPoint(ev.clientX,ev.clientY);
    okeyPointerDrag.ghost.style.display='';
    document.querySelectorAll('.otile.drop-target,.orack-row.drop-target').forEach(e=>e.classList.remove('drop-target'));
    const tgt=el?.closest?.('.otile')||el?.closest?.('.orack-row');
    if(tgt) tgt.classList.add('drop-target');
  }
}
function okeyPointerUp(ev){
  ev.currentTarget.removeEventListener('pointermove',okeyPointerMove);
  document.querySelectorAll('.otile.dragging').forEach(e=>e.classList.remove('dragging'));
  document.querySelectorAll('.otile.drop-target,.orack-row.drop-target').forEach(e=>e.classList.remove('drop-target'));
  okeyPointerDrag.ghost?.remove(); okeyPointerDrag.ghost=null;
  if(!okeyPointerDrag.active){
    // It was a tap/click — treat as select
    const idx=okeyPointerDrag.fromIdx;
    if(Number.isInteger(idx)){OSEL=OSEL===idx?null:idx;renderOkey();}
    okeyPointerDrag={active:false,fromIdx:null,ghost:null,pointerId:null};
    return;
  }
  const fromIdx=okeyPointerDrag.fromIdx;
  okeyPointerDrag={active:false,fromIdx:null,ghost:null,pointerId:null};
  // Find drop target
  const el=document.elementFromPoint(ev.clientX,ev.clientY);
  const tileEl=el?.closest?.('.otile');
  const rowEl=el?.closest?.('.orack-row');
  if(tileEl&&tileEl.dataset.slot!==undefined){
    const toIdx=parseInt(tileEl.dataset.slot,10);
    if(Number.isInteger(fromIdx)&&Number.isInteger(toIdx)&&fromIdx!==toIdx) okeyReorderTile(fromIdx,toIdx);
  } else if(rowEl){
    // Drop on row background — find first empty slot in that row
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
    const div=document.createElement('div');div.className='okey-opp-area '+(relPos[i]||'')+(isActive?' active-player':'');
    div.innerHTML=`<div class="okey-opp-name">${esc(p.name)}</div><div class="okey-opp-tiles"></div>`;
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
  // Mouse drag-drop on row backgrounds
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
      // Empty slots accept drops
      el.addEventListener('dragover',okeyDragOver);
      el.addEventListener('dragleave',okeyDragLeave);
      el.addEventListener('drop',(ev)=>{ev.stopPropagation();okeyDropTile(ev,i);});
      // Pointer: clicking empty slot deselects
      el.addEventListener('click',()=>{OSEL=null;renderOkey();});
    }else{
      el.className='otile'+(i===OSEL?' osel':'')+(t.j?' ojok':'');
      const s=otiSty(t);el.style.background=s.bg;
      el.draggable=true;
      el.innerHTML=`<div class="tnum" style="color:${s.col}">${t.j||isOkeyT(t)?'★':t.num}</div><div class="tcol" style="color:${s.col}">${t.j||isOkeyT(t)?'OK':OCLBL[t.col]||''}</div>`;
      // Mouse drag
      el.addEventListener('dragstart',(ev)=>okeyDragStart(ev,i));
      el.addEventListener('dragend',okeyDragEnd);
      el.addEventListener('dragover',okeyDragOver);
      el.addEventListener('dragleave',okeyDragLeave);
      el.addEventListener('drop',(ev)=>{ev.stopPropagation();okeyDropTile(ev,i);});
      // Pointer / touch drag (unified)
      el.addEventListener('pointerdown',(ev)=>okeyPointerDown(ev,i),{passive:true});
    }
    (i<15?topRow:bottomRow).appendChild(el);
  }
  mr.appendChild(topRow);
  mr.appendChild(bottomRow);
  document.getElementById('okey-mi'+(myIdx>=0?'':'')); // dummy
  const isMyTurn=OState.currentIdx===myIdx;
  document.getElementById('okey-discbtn').disabled=!isMyTurn||!ODRAWN;
  document.getElementById('okey-declbtn').disabled=!isMyTurn||!ODRAWN;
  document.getElementById('okey-openbtn').disabled=!isMyTurn||!ODRAWN;
  const selfOpened=OState.opened?.[myIdx];
  document.getElementById('okey-open-state').innerHTML=selfOpened?`Elin açık <span class="okey-open-badge">${groupLabelFromMode(selfOpened)}</span>`:'Henüz el açılmadı';
  // Update player count displays
  const mi=document.querySelector('#okey-mi')||null;
}

function updateOkeyTurn(){
  const el=document.getElementById('okey-turn');
  const isMyTurn=OState.currentIdx===myIdx;
  if(isMyTurn){
    el.textContent='▶ Senin sıran — Taş çek!';el.className='turnbar my';
  } else {
    const p=players.find(p=>p.idx===OState.currentIdx);
    el.textContent=(p?.name||'?')+' oynuyor...';el.className='turnbar opp';
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
  const tileIdx=OSLOTS.slice(0,OSEL+1).filter(Boolean).length-1;
  if(isHost){applyOkeyDiscard(myIdx,tileIdx);OSLOTS[OSEL]=null;okeySyncHandFromSlots();OSEL=null;ODRAWN=false;renderOkey();}
  else{sendToHost({t:'okey-discard',tileIdx:tileIdx});OSEL=null;}
}
function okeySort(){
  const hand=OState.hands[myIdx];if(!hand)return;
  hand.sort((a,b)=>{if(a.j)return 1;if(b.j)return-1;const ci=OCOLS.indexOf(a.col)-OCOLS.indexOf(b.col);return ci||a.num-b.num;});
  OSLOTS=new Array(Math.max(30,hand.length)).fill(null);
  hand.forEach((t,i)=>{OSLOTS[i]=t;});
  OSEL=null;renderOkey();
}
function okeyDeclare(){
  if(!ODRAWN){toast('Önce taş çek!');return;}
  if(isHost){applyOkeyDeclare(myIdx);}
  else sendToHost({t:'okey-declare'});
}

// Handle okey drew message (guest)
const _origOkeyMsg=okeyMsg;
// Patched in handleHostMsg above
