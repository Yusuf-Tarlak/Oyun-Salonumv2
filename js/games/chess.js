// ============================================================
// SATRANÇ (2-player)
// ============================================================
let CB=[],CMC='',CMT=false,CSEL=null,CVM=[],CCast={},CEP=null;
const CPC={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const isW=p=>p&&p===p.toUpperCase()&&p!==p.toLowerCase();
const pCl=p=>{if(!p)return null;return isW(p)?'W':'B';};
const oCl=c=>c==='W'?'B':'W';
function initChess(){
  CMC=myIdx===0?'W':'B';CMT=myIdx===0;
  const bk='rnbqkbnr';CB=Array(64).fill(null);
  for(let c=0;c<8;c++){CB[c]=bk[c];CB[8+c]='p';CB[48+c]='P';CB[56+c]=bk[c].toUpperCase();}
  CCast={wK:true,wQR:true,wKR:true,bK:true,bQR:true,bKR:true};CEP=null;CSEL=null;CVM=[];window._clm=null;
  const sc=document.getElementById('chess-scores');sc.innerHTML='';
  players.forEach(p=>{const card=document.createElement('div');card.className='pcard'+(p.idx===myIdx?' me':'');card.id='chess-pc-'+p.idx;card.innerHTML=`<div class="pc-lbl">${p.idx===myIdx?'Sen':'Rakip'}</div><div class="pc-name">${esc(p.name)}</div><div class="pc-info">${p.idx===0?'⚪ Beyaz':'⚫ Siyah'}</div>`;sc.appendChild(card);});
  rChess();uChessTurn();addSys('chess','Oyun başladı!');
}
function rChess(){const b=document.getElementById('chess-board');b.innerHTML='';const fl=CMC==='B';const lm=window._clm;const ki=fKing(CMC,CB);const ick=ki!==-1&&isAtt(ki,oCl(CMC),CB);for(let i=0;i<64;i++){const idx=fl?63-i:i;const r=Math.floor(idx/8),c=idx%8;const sq=document.createElement('div');sq.className='sq '+((r+c)%2===0?'SL':'SD');if(lm&&(idx===lm.f||idx===lm.t))sq.classList.add('slm');if(CSEL===idx)sq.classList.add('ssel');const vm=CVM.find(m=>m.to===idx);if(vm){sq.classList.add('svm');if(CB[idx])sq.classList.add('hp');}if(ick&&idx===ki)sq.classList.add('schk');const p=CB[idx];if(p){const el=document.createElement('span');el.className='cp';el.textContent=CPC[p];el.style.color=isW(p)?'#f5f0e8':'#1a1212';el.style.textShadow=isW(p)?'0 1px 2px rgba(0,0,0,0.5)':'0 1px 2px rgba(255,255,255,0.2)';sq.appendChild(el);}if(c===0){const s=document.createElement('span');s.className='cr';s.textContent=8-r;sq.appendChild(s);}if(r===7){const s=document.createElement('span');s.className='cf';s.textContent='abcdefgh'[c];sq.appendChild(s);}sq.onclick=()=>cClick(idx);b.appendChild(sq);}}
function uChessTurn(){const el=document.getElementById('chess-turn');if(CMT){el.textContent='▶ Senin sıran';el.className='turnbar my';}else{el.textContent=(players.find(p=>p.idx!==myIdx)?.name||'Rakip')+' oynuyor...';el.className='turnbar opp';}}
function cClick(idx){if(!CMT||!gameActive)return;if(CSEL!==null){const mv=CVM.find(m=>m.to===idx);if(mv){aChess(mv);return;}}if(CB[idx]&&pCl(CB[idx])===CMC){CSEL=idx;CVM=getLegal(idx,CB,CMC);rChess();return;}CSEL=null;CVM=[];rChess();}
function getLegal(idx,board,col){return getRaw(idx,board).filter(m=>{const nb=applyB(board,m);const ki=fKing(col,nb);return ki!==-1&&!isAtt(ki,oCl(col),nb);});}
function getRaw(idx,board){const p=board[idx];if(!p)return[];const r=Math.floor(idx/8),c=idx%8,col=pCl(p);const mv=[];const sl=(dr,dc)=>{let nr=r+dr,nc=c+dc;while(nr>=0&&nr<8&&nc>=0&&nc<8){const ni=nr*8+nc;if(board[ni]){if(pCl(board[ni])!==col)mv.push({from:idx,to:ni});break;}mv.push({from:idx,to:ni});nr+=dr;nc+=dc;}};const jp=(dr,dc)=>{const nr=r+dr,nc=c+dc;if(nr>=0&&nr<8&&nc>=0&&nc<8){const ni=nr*8+nc;if(pCl(board[ni])!==col)mv.push({from:idx,to:ni});}};const t=p.toLowerCase();if(t==='r'||t==='q')[[0,1],[0,-1],[1,0],[-1,0]].forEach(([a,b])=>sl(a,b));if(t==='b'||t==='q')[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>sl(a,b));if(t==='n')[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([a,b])=>jp(a,b));if(t==='k'){[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([a,b])=>jp(a,b));const ck=col==='W'?CCast.wK:CCast.bK;if(ck&&!isAtt(idx,oCl(col),board)){const row=col==='W'?7:0;if((col==='W'?CCast.wKR:CCast.bKR)&&!board[row*8+5]&&!board[row*8+6]&&!isAtt(row*8+5,oCl(col),board)&&!isAtt(row*8+6,oCl(col),board))mv.push({from:idx,to:row*8+6,castle:'K'});if((col==='W'?CCast.wQR:CCast.bQR)&&!board[row*8+3]&&!board[row*8+2]&&!board[row*8+1]&&!isAtt(row*8+3,oCl(col),board)&&!isAtt(row*8+2,oCl(col),board))mv.push({from:idx,to:row*8+2,castle:'Q'});}}if(t==='p'){const dir=col==='W'?-1:1,sr=col==='W'?6:1,fwd=idx+dir*8;if(fwd>=0&&fwd<64&&!board[fwd]){mv.push({from:idx,to:fwd,promo:Math.floor(fwd/8)===0||Math.floor(fwd/8)===7});if(r===sr&&!board[idx+2*dir*8])mv.push({from:idx,to:idx+2*dir*8});}[-1,1].forEach(dc=>{const nc2=c+dc;if(nc2<0||nc2>7)return;const ci=(r+dir)*8+(c+dc);if(ci>=0&&ci<64){if(board[ci]&&pCl(board[ci])!==col)mv.push({from:idx,to:ci,promo:Math.floor(ci/8)===0||Math.floor(ci/8)===7});if(ci===CEP)mv.push({from:idx,to:ci,epC:idx+dc});}});}return mv;}
function applyB(board,mv){const nb=[...board];nb[mv.to]=nb[mv.from];nb[mv.from]=null;if(mv.castle){const row=Math.floor(mv.from/8);if(mv.castle==='K'){nb[row*8+5]=nb[row*8+7];nb[row*8+7]=null;}else{nb[row*8+3]=nb[row*8+0];nb[row*8+0]=null;}}if(mv.epC!==undefined)nb[mv.epC]=null;return nb;}
function fKing(col,board){return board.indexOf(col==='W'?'K':'k');}
function isAtt(sq,byCol,board){for(let i=0;i<64;i++){const p=board[i];if(!p||pCl(p)!==byCol)continue;if(getRawNS(i,board).some(m=>m.to===sq))return true;}return false;}
function getRawNS(idx,board){const p=board[idx];if(!p)return[];const r=Math.floor(idx/8),c=idx%8,col=pCl(p);const mv=[];const sl=(dr,dc)=>{let nr=r+dr,nc=c+dc;while(nr>=0&&nr<8&&nc>=0&&nc<8){const ni=nr*8+nc;if(board[ni]){if(pCl(board[ni])!==col)mv.push({to:ni});break;}mv.push({to:ni});nr+=dr;nc+=dc;}};const jp=(dr,dc)=>{const nr=r+dr,nc=c+dc;if(nr>=0&&nr<8&&nc>=0&&nc<8){const ni=nr*8+nc;if(pCl(board[ni])!==col)mv.push({to:ni});}};const t=p.toLowerCase();if(t==='r'||t==='q')[[0,1],[0,-1],[1,0],[-1,0]].forEach(([a,b])=>sl(a,b));if(t==='b'||t==='q')[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>sl(a,b));if(t==='n')[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([a,b])=>jp(a,b));if(t==='k')[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([a,b])=>jp(a,b));if(t==='p'){const dir=col==='W'?-1:1;[-1,1].forEach(dc=>{const nc2=c+dc;if(nc2>=0&&nc2<8){const ni=(r+dir)*8+nc2;if(ni>=0&&ni<64)mv.push({to:ni});}});}return mv;}
function aChess(mv,promo=null){
  if(mv.promo&&!promo){showPromo(CMC==='W'?'white':'black',ch=>aChess(mv,ch));return;}
  window._clm={f:mv.from,t:mv.to};const nb=applyB(CB,mv);
  if(mv.promo&&promo){const pc=CMC==='W'?promo.toUpperCase():promo.toLowerCase();nb[mv.to]=pc;}
  const p=CB[mv.from];if(p==='K'){CCast.wK=false;CCast.wQR=false;CCast.wKR=false;}if(p==='k'){CCast.bK=false;CCast.bQR=false;CCast.bKR=false;}if(mv.from===63||mv.to===63)CCast.wKR=false;if(mv.from===56||mv.to===56)CCast.wQR=false;if(mv.from===7||mv.to===7)CCast.bKR=false;if(mv.from===0||mv.to===0)CCast.bQR=false;
  if(p&&p.toLowerCase()==='p'&&Math.abs(mv.to-mv.from)===16)CEP=(mv.from+mv.to)/2;else CEP=null;
  CB=nb;sendToAll({t:'chess-move',move:mv,promo,cast:{...CCast},ep:CEP});
  CMT=false;CSEL=null;CVM=[];
  const nc=oCl(CMC);const ki=fKing(nc,CB);const ick=isAtt(ki,oCl(nc),CB);
  const hasMv=CB.some((_,i)=>pCl(CB[i])===nc&&getLegal(i,CB,nc).length>0);
  rChess();uChessTurn();
  if(!hasMv){if(ick)gameOver(true,'Şah mat!');else gameOver(null,'Pat');}
  else if(ick)toast('Şah!');
}
function chessMsg(d){if(d.fromIdx===myIdx)return;if(d.t==='chess-move'){window._clm={f:d.move.from,t:d.move.to};const nb=applyB(CB,d.move);if(d.move.promo&&d.promo){const pc=CMC==='W'?d.promo.toLowerCase():d.promo.toUpperCase();nb[d.move.to]=pc;}if(d.cast)CCast={...d.cast};CEP=(d.ep!==undefined&&d.ep!==null)?d.ep:null;CB=nb;CMT=true;CSEL=null;CVM=[];const ki=fKing(CMC,CB);const ick=isAtt(ki,oCl(CMC),CB);const hasMv=CB.some((_,i)=>pCl(CB[i])===CMC&&getLegal(i,CB,CMC).length>0);rChess();uChessTurn();if(!hasMv){if(ick)gameOver(false,'Şah mat!');else gameOver(null,'Pat');}else if(ick)toast('Şah!');}}
function showPromo(col,cb){const ps=col==='white'?['Q','R','B','N']:['q','r','b','n'];const m=document.getElementById('pmodal'),c=document.getElementById('pchoices');c.innerHTML='';ps.forEach(p=>{const btn=document.createElement('div');btn.className='promop';btn.textContent=CPC[p];btn.onclick=()=>{m.style.display='none';cb(p.toLowerCase());};c.appendChild(btn);});m.style.display='flex';}
