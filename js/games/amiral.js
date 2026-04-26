// ============================================================
// AMİRAL BATTI (2-player)
// ============================================================
let AState={phase:'place',myGrid:[],oppGrid:[],ships:[],myShips:[],placedShips:[],selectedShip:null,orientation:'H',preview:[],myTurn:false,shotsFired:0,shotsReceived:0};
const AMIRAL_SHIPS=[{name:'Uçak Gemisi',size:5,count:1},{name:'Zırhlı',size:4,count:1},{name:'Kruvazör',size:3,count:1},{name:'Destroyer',size:3,count:1},{name:'Denizaltı',size:2,count:1}];
const AGRID=10;

function initAmiral(){
  AState={phase:'place',myGrid:Array(100).fill(null),oppGrid:Array(100).fill(null),ships:[...AMIRAL_SHIPS],myShips:[],placedShips:[],selectedShip:null,orientation:'H',preview:[],myTurn:myIdx===0,shotsFired:0,shotsReceived:0};
  const sc=document.getElementById('amiral-scores');sc.innerHTML='';
  players.forEach(p=>{const c=document.createElement('div');c.className='pcard'+(p.idx===myIdx?' me':'');c.id='amiral-pc-'+p.idx;c.innerHTML=`<div class="pc-lbl">${p.idx===myIdx?'Sen':'Rakip'}</div><div class="pc-name">${esc(p.name)}</div><div class="pc-info" id="amiral-pi-${p.idx}">—</div>`;sc.appendChild(c);});
  document.getElementById('amiral-ship-select').style.display='block';
  document.getElementById('amiral-opp-board').style.pointerEvents='none';
  rAmiral();
  uAmiralTurn();
  buildShipList();
  addSys('amiral','Gemileri yerleştir!');
}

function buildShipList(){
  const list=document.getElementById('amiral-ships-list');list.innerHTML='';
  AMIRAL_SHIPS.forEach((s,i)=>{
    const placed=AState.placedShips.filter(p=>p.name===s.name).length;
    const btn=document.createElement('button');
    btn.className='amiral-ship-btn'+(placed>=s.count?' placed':'')+(AState.selectedShip===i?' selected':'');
    btn.textContent=s.name+' ('+('█'.repeat(s.size))+')';
    btn.disabled=placed>=s.count;
    btn.onclick=()=>{if(placed<s.count){AState.selectedShip=i;buildShipList();document.getElementById('amiral-place-btn').disabled=false;}};
    list.appendChild(btn);
  });
  // Tüm gemiler yerleştirildi mi?
  const allPlaced=AMIRAL_SHIPS.every(s=>AState.placedShips.filter(p=>p.name===s.name).length>=s.count);
  document.getElementById('amiral-ready-btn').style.display=allPlaced?'inline-block':'none';
  document.getElementById('amiral-place-btn').disabled=AState.selectedShip===null||allPlaced;
}

function amiralRotate(){
  AState.orientation=AState.orientation==='H'?'V':'H';
  AState.preview=[];rAmiral();
  toast('Yön: '+(AState.orientation==='H'?'Yatay':'Dikey'));
}

function amiralCellHover(idx){
  if(AState.phase!=='place'||AState.selectedShip===null)return;
  const s=AMIRAL_SHIPS[AState.selectedShip];
  const cells=amiralGetCells(idx,s.size,AState.orientation);
  AState.preview=cells;rAmiral();
}

function amiralGetCells(start,size,ori){
  const cells=[];const r=Math.floor(start/AGRID),c=start%AGRID;
  for(let i=0;i<size;i++){
    if(ori==='H'){if(c+i>=AGRID)return null;cells.push(r*AGRID+c+i);}
    else{if(r+i>=AGRID)return null;cells.push((r+i)*AGRID+c);}
  }
  return cells;
}

function amiralConfirmPlace(){
  if(AState.selectedShip===null||!AState.preview||!AState.preview.length)return;
  const s=AMIRAL_SHIPS[AState.selectedShip];
  // Çakışma kontrolü
  if(AState.preview.some(idx=>AState.myGrid[idx]==='ship')){toast('Gemiler çakışıyor!');return;}
  AState.preview.forEach(idx=>AState.myGrid[idx]='ship');
  AState.placedShips.push({name:s.name,size:s.size,cells:[...AState.preview]});
  AState.selectedShip=null;AState.preview=[];
  buildShipList();rAmiral();
}

function amiralReady(){
  if(AState.placedShips.length<AMIRAL_SHIPS.length){toast('Tüm gemileri yerleştir!');return;}
  // Host'a yerleşim gönder
  sendToHost({t:'amiral-place',ships:AState.placedShips.map(s=>s.cells)});
  document.getElementById('amiral-ship-select').style.display='none';
  AState.phase='wait';
  document.getElementById('amiral-phase-info').textContent='Rakip gemilerini yerleştiriyor...';
  addSys('amiral','Hazır! Rakip bekleniyor...');
}

function rAmiral(){
  rAmiralBoard('amiral-my-board',AState.myGrid,false);
  rAmiralBoard('amiral-opp-board',AState.oppGrid,true);
  // Phase info
  const info=document.getElementById('amiral-phase-info');
  if(AState.phase==='place')info.textContent='Gemi yerleştirme aşaması';
  else if(AState.phase==='battle')info.textContent=AState.myTurn?'Ateş et!':'Rakip ateş ediyor...';
}

function rAmiralBoard(id,grid,isOpp){
  const b=document.getElementById(id);b.innerHTML='';
  b.style.gridTemplateColumns='repeat(10,1fr)';
  for(let i=0;i<100;i++){
    const cell=document.createElement('div');
    cell.className='ab-cell';
    const val=grid[i];
    if(val==='ship'&&!isOpp)cell.classList.add('ship');
    if(val==='hit')cell.classList.add('hit');
    if(val==='miss')cell.classList.add('miss');
    if(val==='sunk')cell.classList.add('sunk');
    if(val==='hit')cell.textContent='💥';
    if(val==='miss')cell.textContent='·';
    if(val==='sunk')cell.textContent='🔥';
    // Preview (gemi yerleştirme)
    if(!isOpp&&AState.phase==='place'){
      const isPreview=AState.preview&&AState.preview.includes(i);
      if(isPreview){
        cell.classList.add('ship-preview');
        if(AState.preview.some(p=>AState.myGrid[p]==='ship'))cell.classList.add('invalid');
      }
      cell.onmouseenter=()=>amiralCellHover(i);
      cell.onmouseleave=()=>{AState.preview=[];rAmiral();};
    }
    // Ateş etme
    if(isOpp&&AState.phase==='battle'&&AState.myTurn&&!val){
      cell.onclick=()=>amiralShoot(i);
    }
    b.appendChild(cell);
  }
}

function amiralShoot(idx){
  if(!AState.myTurn||AState.oppGrid[idx])return;
  sendToHost({t:'amiral-shoot',idx});
  AState.myTurn=false;
  uAmiralTurn();
}

function uAmiralTurn(){
  const el=document.getElementById('amiral-turn');
  if(AState.phase==='place'){el.textContent='⚓ Gemileri Yerleştir';el.className='turnbar my';return;}
  if(AState.phase==='wait'){el.textContent='⏳ Rakip hazırlanıyor...';el.className='turnbar opp';return;}
  if(AState.myTurn){el.textContent='🎯 Ateş et!';el.className='turnbar my';}
  else{el.textContent=(players.find(p=>p.idx!==myIdx)?.name||'Rakip')+' ateş ediyor...';el.className='turnbar opp';}
  document.getElementById('amiral-opp-board').style.pointerEvents=AState.myTurn?'auto':'none';
}

function amiralMsg(d){
  if(d.fromIdx===myIdx)return;
  if(d.t==='amiral-place'&&isHost){
    // Host her iki oyuncunun yerleşimini takip eder
    if(!AState._placed)AState._placed={};
    AState._placed[d.fromIdx]=d.ships;
    // Her ikisi de hazır mı?
    if(AState._placed[0]&&AState._placed[1]){
      broadcastAll({t:'amiral-start',placed:AState._placed});
      handleGameMsg({t:'amiral-start',placed:AState._placed});
    }
  } else if(d.t==='amiral-start'){
    // Oyun başla
    AState._opponentCells=d.placed[myIdx===0?1:0];
    AState.phase='battle';
    document.getElementById('amiral-ship-select').style.display='none';
    uAmiralTurn();rAmiral();
    addSys('amiral','Savaş başladı!');
  } else if(d.t==='amiral-shoot'&&isHost){
    // Atış işle
    const targetCells=AState.myGrid; // host kendi grid'ine atar
    const hit=targetCells[d.idx]==='ship';
    let sunk=false;
    if(hit){
      AState.myGrid[d.idx]='hit';
      // Gemi battı mı?
      const ship=AState.placedShips.find(s=>s.cells.includes(d.idx));
      if(ship&&ship.cells.every(c=>AState.myGrid[c]==='hit')){
        ship.cells.forEach(c=>AState.myGrid[c]='sunk');sunk=true;
      }
    } else {
      AState.myGrid[d.idx]='miss';
    }
    broadcastAll({t:'amiral-result',idx:d.idx,hit,sunk,shooter:d.fromIdx});
    handleGameMsg({t:'amiral-result',idx:d.idx,hit,sunk,shooter:d.fromIdx});
  } else if(d.t==='amiral-result'){
    if(d.shooter===myIdx){
      AState.oppGrid[d.idx]=d.sunk?'sunk':d.hit?'hit':'miss';
      AState.myTurn=!d.hit; // Vurduysa tekrar at
    } else {
      AState.myGrid[d.idx]=d.sunk?'sunk':d.hit?'hit':'miss';
      AState.myTurn=d.hit; // Rakip vurduysa rakip devam
    }
    const msg=d.hit?(d.sunk?'💥 GEMİ BATTI!':'💥 İsabet!'):'· Iskala!';
    addSys('amiral',msg);
    rAmiral();uAmiralTurn();
    playFx(d.hit?'win':'draw');
    // Oyun bitti mi?
    const mySunk=AState.myGrid.filter(v=>v==='hit'||v==='sunk').length;
    const oppSunk=AState.oppGrid.filter(v=>v==='hit'||v==='sunk').length;
    if(oppSunk>=17)gameOver(true,'Tüm rakip gemileri battı!');
    else if(mySunk>=17)gameOver(false,'Tüm gemilerin battı!');
  }
}
