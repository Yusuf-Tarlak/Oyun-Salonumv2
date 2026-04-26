// ============================================================
// SOS (2-player)
// ============================================================
let SState={board:[],size:8,myTurn:false,myScore:0,oppScore:0,selectedLetter:null,myColor:'',oppColor:''};
const SOS_SIZE=8;

function initSos(){
  SState={board:Array(SOS_SIZE*SOS_SIZE).fill(''),size:SOS_SIZE,myTurn:myIdx===0,myScore:0,oppScore:0,selectedLetter:null,myColor:'#2471a3',oppColor:'#c0392b'};
  const sc=document.getElementById('sos-scores');sc.innerHTML='';
  players.forEach(p=>{const c=document.createElement('div');c.className='pcard'+(p.idx===myIdx?' me':'');c.id='sos-pc-'+p.idx;c.innerHTML=`<div class="pc-lbl">${p.idx===myIdx?'Sen':'Rakip'}</div><div class="pc-name">${esc(p.name)}</div><div class="pc-info" id="sos-pi-${p.idx}">0 puan</div>`;sc.appendChild(c);});
  rSos();uSosTurn();
  addSys('sos','SOS oyunu başladı! S veya O seç, hücreye tıkla.');
}

function sosPickLetter(l){
  SState.selectedLetter=l;
  document.querySelectorAll('.sos-lbtn').forEach(b=>b.classList.toggle('selected',b.textContent===l));
}

function sosClick(idx){
  if(!SState.myTurn||!SState.selectedLetter||SState.board[idx])return;
  sendToHost({t:'sos-move',idx,letter:SState.selectedLetter});
  SState.myTurn=false;uSosTurn();
}

function sosCheckSOS(board,idx,size){
  const found=[];const r=Math.floor(idx/size),c=idx%size;
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  dirs.forEach(([dr,dc])=>{
    // SOS: kontrol et — bu hücre ortada mı? (S O S)
    const pr=r-dr,pc=c-dc,nr=r+dr,nc=c+dc;
    if(pr>=0&&pr<size&&pc>=0&&pc<size&&nr>=0&&nr<size&&nc>=0&&nc<size){
      const pi=pr*size+pc,ni=nr*size+nc;
      if(board[idx]==='O'&&board[pi]==='S'&&board[ni]==='S')found.push([pi,idx,ni]);
    }
    // Bu hücre S, sonra O, sonra S
    const or1=r+dr,oc1=c+dc,or2=r+dr*2,oc2=c+dc*2;
    if(or1>=0&&or1<size&&oc1>=0&&oc1<size&&or2>=0&&or2<size&&oc2>=0&&oc2<size){
      const o1=or1*size+oc1,o2=or2*size+oc2;
      if(board[idx]==='S'&&board[o1]==='O'&&board[o2]==='S')found.push([idx,o1,o2]);
    }
  });
  return found;
}

function rSos(){
  const b=document.getElementById('sos-board');b.innerHTML='';
  b.style.gridTemplateColumns=`repeat(${SState.size},1fr)`;
  SState.board.forEach((val,i)=>{
    const cell=document.createElement('div');
    cell.className='sos-cell';
    if(val){cell.classList.add('filled','sos-'+val.toLowerCase());cell.textContent=val;}
    else if(SState.myTurn)cell.onclick=()=>sosClick(i);
    b.appendChild(cell);
  });
  // Skor güncelle
  const stats=document.getElementById('sos-stats');
  stats.innerHTML=`
    <div class="sos-score"><div class="sos-score-num">${SState.myScore}</div><div class="sos-score-lbl">SEN</div></div>
    <div class="sos-score"><div class="sos-score-num">${SState.oppScore}</div><div class="sos-score-lbl">RAKİP</div></div>
  `;
  if(document.getElementById('sos-pi-'+myIdx))document.getElementById('sos-pi-'+myIdx).textContent=SState.myScore+' puan';
  const opp=players.find(p=>p.idx!==myIdx);
  if(opp&&document.getElementById('sos-pi-'+opp.idx))document.getElementById('sos-pi-'+opp.idx).textContent=SState.oppScore+' puan';
}

function uSosTurn(){
  const el=document.getElementById('sos-turn');
  if(SState.myTurn){el.textContent='▶ Senin sıran — harf seç ve hücreye tıkla';el.className='turnbar my';}
  else{el.textContent=(players.find(p=>p.idx!==myIdx)?.name||'Rakip')+' oynuyor...';el.className='turnbar opp';}
  document.getElementById('sos-letter-pick').style.opacity=SState.myTurn?'1':'0.4';
  document.getElementById('sos-letter-pick').style.pointerEvents=SState.myTurn?'auto':'none';
}

function sosMsg(d){
  if(d.fromIdx===myIdx)return;
  if(d.t==='sos-move'&&isHost){
    const board=[...SState.board];
    board[d.idx]=d.letter;
    const found=sosCheckSOS(board,d.idx,SState.size);
    const scored=found.length;
    const nextTurn=scored>0?d.fromIdx:(d.fromIdx===0?1:0); // SOS yapan tekrar oynar
    broadcastAll({t:'sos-result',idx:d.idx,letter:d.letter,found,scored,scorer:d.fromIdx,nextTurn});
    handleGameMsg({t:'sos-result',idx:d.idx,letter:d.letter,found,scored,scorer:d.fromIdx,nextTurn});
  } else if(d.t==='sos-result'){
    SState.board[d.idx]=d.letter;
    if(d.scorer===myIdx)SState.myScore+=d.scored;
    else SState.oppScore+=d.scored;
    SState.myTurn=d.nextTurn===myIdx;
    // SOS hücrelerini vurgula
    if(d.found&&d.found.length>0){
      d.found.forEach(cells=>{
        cells.forEach(ci=>{
          const el=document.getElementById('sos-board')?.children[ci];
          if(el)el.classList.add('sos-win');
        });
      });
      addSys('sos','SOS! '+(d.scorer===myIdx?'Sen':'Rakip')+' '+(d.scored)+' puan kazandı!');
      playFx('win');
    }
    // Tahta dolu mu?
    const full=SState.board.every(v=>v!=='');
    if(full){
      const iWon=SState.myScore>SState.oppScore;
      const isDraw=SState.myScore===SState.oppScore;
      gameOver(isDraw?null:iWon,`${SState.myScore} - ${SState.oppScore}`);
    }
    rSos();uSosTurn();
  }
}


// ===== ÖZEL ODA =====
let roomType='public'; // 'public' | 'private'

function setRoomType(type){
  roomType=type;
  document.getElementById('rtype-public').classList.toggle('active',type==='public');
  document.getElementById('rtype-private').classList.toggle('active',type==='private');
  document.getElementById('room-pass-field').style.display=type==='private'?'block':'none';
}

function checkJoinPassword(){
  // Oda koduna göre şifre gerekip gerekmediğini Firebase'den kontrol et
  const code=document.getElementById('jcode').value.trim().toUpperCase();
  if(code.length<4||!fbDb){document.getElementById('join-pass-field').style.display='none';return;}
  fbDb.ref('rooms/room_'+code).once('value').then(snap=>{
    const room=snap.val();
    if(room&&room.hasPassword){
      document.getElementById('join-pass-field').style.display='block';
    } else {
      document.getElementById('join-pass-field').style.display='none';
    }
  });
}

// Patch quickJoin to check password for private rooms
const _origQuickJoin=window.quickJoin;
window.quickJoin=function(code,game,isFull){
  if(isFull){toast('Oda dolu!');return;}
  const name=document.getElementById('uname').value.trim();
  if(!name){toast('Önce kullanıcı adı girin!');document.getElementById('uname').focus();return;}
  // Check if private room
  if(fbDb){
    fbDb.ref('rooms/room_'+code).once('value').then(snap=>{
      const room=snap.val();
      if(room&&room.hasPassword){
        // Show password prompt
        const pass=prompt('🔒 Bu oda şifreli!\nŞifreyi girin:');
        if(!pass){return;}
        if(pass.trim()!==room.password){toast('❌ Yanlış şifre!');return;}
      }
      // Password ok or no password — join
      sgame=game;
      document.getElementById('jcode').value=code;
      switchTab('jo');
      joinRoom();
    });
  } else {
    sgame=game;
    document.getElementById('jcode').value=code;
    switchTab('jo');
    joinRoom();
  }
};

// Patch joinRoom to check password when joining manually
const _privOrigJoinRoom=joinRoom;
joinRoom=function(){
  const code=document.getElementById('jcode').value.trim().toUpperCase();
  const enteredPass=document.getElementById('join-password')?.value?.trim()||'';
  const passField=document.getElementById('join-pass-field');

  if(passField&&passField.style.display!=='none'&&fbDb){
    // Verify password first
    fbDb.ref('rooms/room_'+code).once('value').then(snap=>{
      const room=snap.val();
      if(room&&room.hasPassword){
        if(enteredPass!==room.password){
          toast('❌ Yanlış şifre!');
          document.getElementById('join-password').focus();
          return;
        }
      }
      _privOrigJoinRoom();
    });
  } else {
    _privOrigJoinRoom();
  }
};

// Patch publishRoom to include password info
const _privOrigPublish=publishRoom;
publishRoom=function(){
  if(!fbDb||!roomCode||!curGame||!isHost)return;
  const pass=document.getElementById('room-password')?.value?.trim()||'';
  const isPrivate=roomType==='private';
  myRoomRef=fbDb.ref('rooms/room_'+roomCode);
  const data={
    code:roomCode,
    game:curGame,
    hostName:myName,
    maxPlayers:maxPlayers,
    playerCount:1,
    createdAt:firebase.database.ServerValue.TIMESTAMP,
    isPrivate:isPrivate,
    hasPassword:isPrivate&&pass.length>0
  };
  if(isPrivate&&pass.length>0) data.password=pass;
  myRoomRef.set(data);
  myRoomRef.onDisconnect().remove();
};

// Re-init with patched publishRoom (override the FB patch chain)
