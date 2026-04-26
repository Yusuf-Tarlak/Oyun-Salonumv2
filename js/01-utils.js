function leaveGame(){leaveHome();}
function copyCode(){navigator.clipboard.writeText(roomCode).then(()=>toast('Kopyalandı: '+roomCode));}
function setSt(p,s,t){document.getElementById('dot-'+p).className='dot '+s;document.getElementById('sttxt-'+p).textContent=t;}
function doRematch(){if(isHost){broadcastAll({t:'game-start',players:players.map(p=>({name:p.name,idx:p.idx}))});startGame(curGame);}else{sendToHost({t:'rematch'});toast('İstek gönderildi...');}}
function sendChat(g){const i=document.getElementById(g+'-ci');const m=i.value.trim();if(!m)return;i.value='';sendChat_net(g,m);}
function addChat(g,s,m,c){const b=document.getElementById(g+'-chat');if(!b)return;const cls=c==='you'?'cyou':c==='opp'?'copp':'csys';b.innerHTML+=`<div><span class="${cls}">${esc(s)}:</span> ${esc(m)}</div>`;b.scrollTop=b.scrollHeight;}
function addSys(g,m){const b=document.getElementById(g+'-chat');if(!b)return;b.innerHTML+=`<div class="csys">${esc(m)}</div>`;b.scrollTop=b.scrollHeight;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
let tT;function toast(m){const e=document.getElementById('toast');e.textContent=m;e.classList.add('show');clearTimeout(tT);tT=setTimeout(()=>e.classList.remove('show'),2800);}
function startGame(g){
  gameActive=true;
  // Reset game-specific state
  OSLOTS=null;ODRAWN=false;OSEL=null;
  UState={deck:[],discard:[],hands:{},currentIdx:0,direction:1,currentColor:'',drawStack:0,finished:[],mustDraw:false,drewThisTurn:false};
  ['dama','chess','tavla','uno','okey','amiral','sos','sudoku','asmaca'].forEach(x=>{const b=document.getElementById(x+'-chat');if(b)b.innerHTML='';});
  if(g==='dama')initDama();else if(g==='chess')initChess();else if(g==='tavla')initTavla();else if(g==='uno')initUno();else if(g==='okey')initOkey();else if(g==='amiral')initAmiral();else if(g==='sos')initSos();else if(g==='sudoku')initSudoku();else if(g==='asmaca')initAsmaca();
  showSc(g);
}
function gameOver(win,sub,rankings){
  gameActive=false;const r=document.getElementById('go-res');
  r.textContent=win===null?'BERABERE':win?'KAZANDIN!':'KAYBETTİN';
  r.className='gores '+(win===null?'draw':win?'win':'lose');
  document.getElementById('go-sub').textContent=sub||'';
  const rk=document.getElementById('go-rankings');rk.innerHTML='';
  if(rankings&&rankings.length>0){
    const medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'];
    rankings.forEach((r,i)=>{
      const div=document.createElement('div');div.className='go-rank';
      div.innerHTML=`<div class="go-rank-pos">${medals[i]||i+1}</div><div class="go-rank-name">${esc(r.name)}</div><div class="go-rank-info">${esc(r.info||'')}</div>`;
      rk.appendChild(div);
    });
  }
  showSc('gameover');
}
