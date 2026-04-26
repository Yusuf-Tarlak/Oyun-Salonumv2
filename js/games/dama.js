// ============================================================
// DAMA (2-player)
// ============================================================
let DB=[],DMC='',DMT=false,DSEL=null,DVM=[],DCP=null;
function initDama(){
  DMC=myIdx===0?'W':'B';DMT=myIdx===0;
  DB=Array(64).fill(null);
  for(let r=0;r<3;r++)for(let c=0;c<8;c++)if((r+c)%2===1)DB[r*8+c]={c:'B',k:false};
  for(let r=5;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2===1)DB[r*8+c]={c:'W',k:false};
  DSEL=null;DVM=[];DCP=null;
  const sc=document.getElementById('dama-scores');sc.innerHTML='';
  players.forEach(p=>{const card=document.createElement('div');card.className='pcard'+(p.idx===myIdx?' me':'');card.id='dama-pc-'+p.idx;card.innerHTML=`<div class="pc-lbl">${p.idx===myIdx?'Sen':'Rakip'}</div><div class="pc-name">${esc(p.name)}</div><div class="pc-info" id="dama-pi-${p.idx}">${p.idx===0?'⚪':'⚫'}</div>`;sc.appendChild(card);});
  rDama();uDamaTurn();addSys('dama','Oyun başladı!');
}
function rDama(){const b=document.getElementById('dama-board');b.innerHTML='';const fl=DMC==='B';for(let i=0;i<64;i++){const idx=fl?63-i:i;const r=Math.floor(idx/8),c=idx%8;const el=document.createElement('div');el.className='dc '+((r+c)%2===0?'L':'D');if(DSEL===idx)el.classList.add('sel');if(DVM.find(m=>m.to===idx))el.classList.add('vm');const p=DB[idx];if(p){const pe=document.createElement('div');pe.className='piece '+(p.c==='W'?'W':'B')+(p.k?' king':'');el.appendChild(pe);}el.onclick=()=>dClick(idx);b.appendChild(el);}let my=0,op=0;DB.forEach(p=>{if(!p)return;if(p.c===DMC)my++;else op++;});const myP=players.find(p=>p.idx===myIdx);const opP=players.find(p=>p.idx!==(myIdx));if(document.getElementById('dama-pi-'+myIdx))document.getElementById('dama-pi-'+myIdx).textContent=my+' taş';if(opP&&document.getElementById('dama-pi-'+opP.idx))document.getElementById('dama-pi-'+opP.idx).textContent=op+' taş';}
function uDamaTurn(){const el=document.getElementById('dama-turn');const tp=players[DMT&&myIdx===0?0:1];if(DMT){el.textContent='▶ Senin sıran';el.className='turnbar my';}else{el.textContent=(players.find(p=>p.idx!==myIdx)?.name||'Rakip')+' oynuyor...';el.className='turnbar opp';}document.querySelectorAll('.pcard').forEach(c=>c.classList.remove('active-turn'));const activeIdx=DMT?myIdx:(myIdx===0?1:0);const ac=document.getElementById('dama-pc-'+activeIdx);if(ac)ac.classList.add('active-turn');}
function dClick(idx){if(!DMT||!gameActive)return;const p=DB[idx];if(DCP!==null&&DCP!==idx&&!DVM.find(m=>m.to===idx)){DSEL=DCP;DVM=dMoves(DCP,true);rDama();return;}if(p&&p.c===DMC){DSEL=idx;DVM=dMoves(idx,dHasCap(DMC));rDama();return;}if(DSEL!==null){const mv=DVM.find(m=>m.to===idx);if(mv){aDama(mv);return;}}DSEL=null;DVM=[];rDama();}
function dHasCap(col){for(let i=0;i<64;i++){const p=DB[i];if(p&&p.c===col&&dMoves(i,true).length>0)return true;}return false;}
function dMoves(idx,capOnly=false){const p=DB[idx];if(!p)return[];const r=Math.floor(idx/8),c=idx%8;const dirs=p.k?[[-1,-1],[-1,1],[1,-1],[1,1]]:p.c==='W'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];const mv=[];dirs.forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(nr<0||nr>7||nc<0||nc>7)return;const ni=nr*8+nc,t=DB[ni];if(!t&&!capOnly)mv.push({from:idx,to:ni,cap:null});else if(t&&t.c!==p.c){const jr=nr+dr,jc=nc+dc;if(jr>=0&&jr<=7&&jc>=0&&jc<=7){const ji=jr*8+jc;if(!DB[ji])mv.push({from:idx,to:ji,cap:ni});}}});return capOnly?mv.filter(m=>m.cap!==null):mv;}
function aDama(mv){DB[mv.to]=DB[mv.from];DB[mv.from]=null;if(mv.cap!==null)DB[mv.cap]=null;const p=DB[mv.to],r=Math.floor(mv.to/8);if(p.c==='W'&&r===0)p.k=true;if(p.c==='B'&&r===7)p.k=true;const chainMoves=mv.cap!==null?dMoves(mv.to,true):[];
  const hasChain=chainMoves.length>0;
  sendToAll({t:'dama-move',move:mv,chain:hasChain});
  if(hasChain){DCP=mv.to;DSEL=mv.to;DVM=chainMoves;rDama();return;}DCP=null;DSEL=null;DVM=[];DMT=false;rDama();uDamaTurn();const myC=DB.filter(p=>p&&p.c===DMC).length;const opC=DB.filter(p=>p&&p.c!==DMC&&p!==null).length;if(opC===0)gameOver(true,'Tüm rakip taşlarını aldın!');else if(myC===0)gameOver(false,'Tüm taşların alındı!');}
function damaMsg(d){
  if(d.fromIdx===myIdx)return;
  if(d.t==='dama-move'){
    const mv=d.move;
    DB[mv.to]=DB[mv.from];DB[mv.from]=null;
    if(mv.cap!==null)DB[mv.cap]=null;
    const p=DB[mv.to],r=Math.floor(mv.to/8);
    if(p&&p.c==='W'&&r===0)p.k=true;
    if(p&&p.c==='B'&&r===7)p.k=true;
    DCP=null;DSEL=null;DVM=[];
    // Only switch turn if no chain capture pending
    if(!d.chain){DMT=true;}
    rDama();uDamaTurn();
    const myC=DB.filter(p=>p&&p.c===DMC).length;
    const opC=DB.filter(p=>p&&p.c!==DMC&&p!==null).length;
    if(opC===0)gameOver(false,'Tüm rakip taşları alındı!');
    else if(myC===0)gameOver(false,'Tüm taşların alındı!');
  }
}
