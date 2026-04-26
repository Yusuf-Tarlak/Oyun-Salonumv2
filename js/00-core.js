// ============================================================
// GLOBALS
// ============================================================
let currentUser=null;         // Firebase auth user (null = guest)
let fbAuth=null;              // Firebase Auth instance
let fbDb=null, myRoomRef=null; // Firebase DB
let myPeer=null, myConn=null; // for guests: single conn to host
let hostConns=[];             // for host: array of conns to guests
let myName='', myIdx=0;       // myIdx = seat index (0=host)
let players=[];               // [{name,idx}] sorted by seat
let roomCode='', curGame='', gameActive=false, sgame='';
let isHost=false;
let maxPlayers=2; // 2 for dama/chess/tavla, 3-6 for uno/okey

const GLBL={'dama':'🔴 Dama','chess':'♟ Satranç','tavla':'🎲 Tavla','uno':'🃏 Uno','okey':'🀄 Okey','amiral':'⚓ Amiral Battı','sos':'📝 SOS','sudoku':'🔢 Sudoku','asmaca':'🎭 Adam Asmaca'};
const MULTI_GAMES=['uno','okey'];
const SINGLE_GAMES=['sudoku','asmaca'];

// ============================================================
// SCREEN
// ============================================================
function showSc(id){
  document.querySelectorAll('.screen').forEach(s=>{s.classList.remove('active');s.style.display='none';});
  const e=document.getElementById('screen-'+id);
  if(e){e.style.display='flex';e.classList.add('active');}
  // Home ekranına gelinince odaları yenile
  if(id==='home' && fbDb){
    fbDb.ref('rooms').once('value').then(snap=>renderRooms(snap.val()||{}));
  }
}

// ============================================================
// LOBBY / HOME
// ============================================================
function selGame(g,el){
  sgame=g;
  document.getElementById('sgl').textContent=GLBL[g];
  document.querySelectorAll('.gc').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  const mo=document.getElementById('multi-opts');
  const tabs=document.querySelector('.tabs');
  const joinTabBtn=document.querySelectorAll('.tab')[1];
  const createBtnLabel=document.querySelector('#btn-cr span');
  if(g==='uno'){mo.style.display='block';document.getElementById('player-count').innerHTML='<option value="3">3 Kişi</option><option value="4" selected>4 Kişi</option><option value="5">5 Kişi</option><option value="6">6 Kişi</option>';}
  else if(g==='okey'){mo.style.display='block';document.getElementById('player-count').innerHTML='<option value="4" selected>4 Kişi (Standart)</option>';}
  else{mo.style.display='none';}
  if(SINGLE_GAMES.includes(g)){
    tabs.style.display='none';
    document.getElementById('tab-jo').style.display='none';
    document.getElementById('tab-cr').style.display='block';
    if(createBtnLabel)createBtnLabel.textContent='Oyunu Başlat';
    if(joinTabBtn)joinTabBtn.style.display='none';
    document.getElementById('room-pass-field').style.display='none';
    document.getElementById('join-pass-field').style.display='none';
    document.getElementById('rcbox').style.display='none';
    document.getElementById('st-cr').style.display='none';
    document.getElementById('st-jo').style.display='none';
  }else{
    tabs.style.display='flex';
    if(joinTabBtn)joinTabBtn.style.display='block';
    if(createBtnLabel)createBtnLabel.textContent='Oda Oluştur';
  }
}
function switchTab(t){document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('active',(i===0&&t==='cr')||(i===1&&t==='jo')));document.getElementById('tab-cr').style.display=t==='cr'?'block':'none';document.getElementById('tab-jo').style.display=t==='jo'?'block':'none';}
function getU(){
  // If logged in, use display name from auth
  if(currentUser&&currentUser.displayName){
    const inp=document.getElementById('uname');
    if(inp&&!inp.value) inp.value=currentUser.displayName;
    return inp?.value?.trim()||currentUser.displayName;
  }
  const v=document.getElementById('uname').value.trim();
  if(!v){toast('Kullanıcı adı girin!');return null;}
  return v;
}
function genCode(){return Math.random().toString(36).substring(2,8).toUpperCase();}

// ============================================================
// CREATE ROOM (HOST)
// ============================================================
function createRoom(){
  const n=getU();if(!n)return;
  if(!sgame){toast('Önce oyun seçin!');return;}
  if(SINGLE_GAMES.includes(sgame)){
    myName=n;isHost=true;curGame=sgame;roomCode='SOLO';
    myIdx=0;players=[{name:myName,idx:0}];
    maxPlayers=1;
    startGame(curGame);
    return;
  }
  myName=n;isHost=true;curGame=sgame;roomCode=genCode();
  myIdx=0;players=[{name:myName,idx:0}];
  maxPlayers=MULTI_GAMES.includes(sgame)?parseInt(document.getElementById('player-count').value):2;
  document.getElementById('btn-cr').disabled=true;
  setSt('cr','cn','Bağlantı kuruluyor...');
  document.getElementById('st-cr').style.display='flex';
  myPeer=new Peer('SLN4-'+roomCode,{host:'0.peerjs.com',port:443,secure:true});
  myPeer.on('open',()=>{
    setSt('cr','ok','Hazır! Kod: '+roomCode);
    document.getElementById('rcbox').style.display='block';
    document.getElementById('rcval').textContent=roomCode;
    document.getElementById('wait-code').textContent=roomCode;
    document.getElementById('lobby-code').textContent=roomCode;
    if(MULTI_GAMES.includes(curGame))showLobby();
    else showSc('wait');
  });
  myPeer.on('connection',c=>{
    const guestIdx=hostConns.length+1;
    hostConns.push(c);
    setupHostConn(c,guestIdx);
  });
  myPeer.on('error',e=>{setSt('cr','er','Hata: '+e.type);document.getElementById('btn-cr').disabled=false;if(e.type==='unavailable-id'){roomCode=genCode();createRoom();}});
}

function isDirectGameMsgType(t){
  return ['uno-play','uno-draw','uno-pass','uno-shout','okey-draw-pile','okey-draw-discard','okey-discard','okey-declare','dama-move','chess-move','tavla-roll','tavla-move','tavla-pass','amiral-shoot','amiral-place','sos-move','asmaca-word','asmaca-guess','asmaca-apply','asmaca-score'].includes(t);
}
function setupHostConn(c,guestIdx){
  c.on('open',()=>{
    // Send current state to new guest
    c.send({t:'welcome',idx:guestIdx,game:curGame,maxP:maxPlayers,roomCode,players:players.map(p=>({name:p.name,idx:p.idx}))});
  });
  c.on('data',d=>{
    if(d.t==='join'){
      // Guest introduces itself
      const p={name:d.name,idx:guestIdx,conn:c};
      players.push(p);
      // Broadcast updated player list to everyone
      broadcastExcept({t:'player-joined',players:players.map(p=>({name:p.name,idx:p.idx}))},null);
      updateLobby();
      if(MULTI_GAMES.includes(curGame)&&players.length>=maxPlayers){
        // Auto or manual start option
        updateLobby();
      } else if(!MULTI_GAMES.includes(curGame) && players.length>=2){
        // 2-player games should start automatically as soon as guest joins
        const startData={t:'game-start',players:players.map(p=>({name:p.name,idx:p.idx}))};
        broadcastAll(startData);
        startGame(curGame);
      }
    } else if(d.t==='msg' || isDirectGameMsgType(d.t)){
      // Relay message from guest to everyone
      const msg = d.t==='msg' && d.payload ? d.payload : d;
      broadcastExcept({...msg,fromIdx:guestIdx},c);
      handleGameMsg({...msg,fromIdx:guestIdx});
    } else if(d.t==='chat'){
      broadcastExcept({t:'chat',msg:d.msg,fromIdx:guestIdx},c);
      addChat(curGame,players.find(p=>p.idx===guestIdx)?.name||'?',d.msg,'opp');
    }
  });
  c.on('close',()=>{
    players=players.filter(p=>p.idx!==guestIdx);
    hostConns=hostConns.filter(hc=>hc!==c);
    if(gameActive){toast('Bir oyuncu ayrıldı!');broadcastAll({t:'player-left',idx:guestIdx});}
    updateLobby();
  });
}

// ============================================================
// JOIN ROOM (GUEST)
// ============================================================
function joinRoom(){
  const n=getU();if(!n)return;
  if(SINGLE_GAMES.includes(sgame)){toast('Bu oyun tek kişilik. Oyunu Başlat butonunu kullan.');return;}
  const code=document.getElementById('jcode').value.trim().toUpperCase();
  if(code.length<4){toast('Geçerli kod girin!');return;}
  myName=n;isHost=false;roomCode=code;
  document.getElementById('btn-jo').disabled=true;
  setSt('jo','cn','Bağlanıyor...');
  document.getElementById('st-jo').style.display='flex';
  myPeer=new Peer(undefined,{host:'0.peerjs.com',port:443,secure:true});
  myPeer.on('open',()=>{
    myConn=myPeer.connect('SLN4-'+code,{reliable:true});
    setupGuestConn();
    setSt('jo','cn','Odaya bağlanıyor...');
  });
  myPeer.on('error',e=>{setSt('jo','er','Bağlanamadı');document.getElementById('btn-jo').disabled=false;toast('Bağlantı hatası.');});
}

function setupGuestConn(){
  myConn.on('open',()=>{
    myConn.send({t:'join',name:myName});
  });
  myConn.on('data',d=>handleHostMsg(d));
  myConn.on('close',()=>{if(gameActive){toast('Sunucu bağlantısı kesildi!');setTimeout(leaveHome,2000);}});
}

function handleHostMsg(d){
  if(d.t==='welcome'){
    myIdx=d.idx;curGame=d.game;maxPlayers=d.maxP;
    players=d.players||[];
    if(MULTI_GAMES.includes(curGame))showLobby();
    else{
      // 2-player games wait on this screen until host sends game-start
      showSc('wait');
      const wc=document.getElementById('wait-code');
      if(wc)wc.textContent=roomCode;
    }
  } else if(d.t==='player-joined'){
    players=d.players;updateLobby();
    addSys(curGame,'Yeni oyuncu katıldı!');
  } else if(d.t==='player-left'){
    players=players.filter(p=>p.idx!==d.idx);
    if(gameActive)toast('Bir oyuncu ayrıldı!');
    updateLobby();
  } else if(d.t==='game-start'){
    players=d.players;maxPlayers=d.players.length;
    startGame(curGame);
  } else if(d.t==='chat'){
    const p=players.find(p=>p.idx===d.fromIdx);
    addChat(curGame,p?.name||'?',d.msg,'opp');
  } else if(d.t==='okey-drew'){
    // Guest receives the tile they drew
    if(d.tile){
      OState.hands[myIdx]=OState.hands[myIdx]||[];
      OState.hands[myIdx].push(d.tile);
    }
    if(d.discard!==undefined) OState.discard=d.discard;
    if(d.pileSize!==undefined) OState.pileSize=d.pileSize;
    ODRAWN=true;OSEL=null;
    renderOkey();updateOkeyTurn();
  } else {
    handleGameMsg(d);
  }
}

// ============================================================
// MESSAGING HELPERS
// ============================================================
function broadcastAll(data){
  hostConns.forEach(c=>{if(c&&c.open)c.send(data);});
}
function broadcastExcept(data,exceptConn){
  hostConns.forEach(c=>{if(c&&c.open&&c!==exceptConn)c.send(data);});
}
function sendToHost(data){
  if(isHost){handleGameMsg({...data,fromIdx:0});}
  else{if(myConn&&myConn.open)myConn.send({t:'msg',payload:data});}
}
function sendToAll(data){
  if(isHost){broadcastAll(data);}  // Host already applied move directly
  else sendToHost(data);
}
function sendChat_net(g,msg){
  if(isHost){broadcastAll({t:'chat',msg,fromIdx:0});addChat(g,myName,msg,'you');}
  else{if(myConn&&myConn.open)myConn.send({t:'chat',msg});addChat(g,'Sen',msg,'you');}
}

// ============================================================
// LOBBY
// ============================================================
function showLobby(){
  document.getElementById('lobby-game-title').textContent=GLBL[curGame];
  document.getElementById('lobby-code').textContent=roomCode;
  updateLobby();
  showSc('lobby');
}
function updateLobby(){
  const cnt=players.length;
  document.getElementById('lobby-count').textContent=cnt+' / '+maxPlayers;
  document.getElementById('lobby-prog').style.width=Math.round(cnt/maxPlayers*100)+'%';
  const slots=document.getElementById('lobby-slots');slots.innerHTML='';
  for(let i=0;i<maxPlayers;i++){
    const p=players.find(pl=>pl.idx===i);
    const slot=document.createElement('div');
    slot.className='lp-slot'+(p?' filled':'')+(i===0?' host-slot':'');
    if(p){
      const av=document.createElement('div');
      av.className='lp-avatar';av.textContent=['🎮','👤','🎯','🌟','💎','🎲'][i]||'👤';
      av.style.background=['rgba(201,168,76,0.15)','rgba(41,128,185,0.15)','rgba(192,57,43,0.15)','rgba(39,174,96,0.15)','rgba(125,60,152,0.15)','rgba(202,111,30,0.15)'][i]||'rgba(255,255,255,0.05)';
      const nm=document.createElement('div');nm.className='lp-name';nm.textContent=p.name;
      const bd=document.createElement('div');bd.className='lp-badge';bd.textContent=i===0?'HOST':'';
      slot.appendChild(av);slot.appendChild(nm);slot.appendChild(bd);
    } else {
      const av=document.createElement('div');av.className='lp-avatar';av.textContent='⋯';av.style.opacity='0.3';
      const nm=document.createElement('div');nm.className='lp-empty';nm.textContent='Boş slot';
      slot.appendChild(av);slot.appendChild(nm);
    }
    slots.appendChild(slot);
  }
  const startBtn=document.getElementById('lobby-start-btn');
  const waitDots=document.getElementById('lobby-wait-dots');
  const stxt=document.getElementById('lobby-status-txt');
  if(isHost&&cnt>=2){
    startBtn.style.display='block';
    waitDots.style.display='none';
    stxt.textContent=cnt<maxPlayers?'Yeterli oyuncu var — başlayabilirsiniz!':'Oda dolu!';
  } else {
    startBtn.style.display='none';
    waitDots.style.display='flex';
    stxt.textContent=(maxPlayers-cnt)+' oyuncu daha bekleniyor...';
  }
}
function hostStartGame(){
  if(!isHost||players.length<2)return;
  const startData={t:'game-start',players:players.map(p=>({name:p.name,idx:p.idx}))};
  broadcastAll(startData);
  startGame(curGame);
}

// ============================================================
// UTILS
// ============================================================
function leaveHome(){
  gameActive=false;
  hostConns.forEach(c=>{try{c.close();}catch(e){}});hostConns=[];
  if(myConn){try{myConn.close();}catch(e){}myConn=null;}
  if(myPeer){try{myPeer.destroy();}catch(e){}myPeer=null;}
  document.getElementById('btn-cr').disabled=false;document.getElementById('btn-jo').disabled=false;
  document.getElementById('rcbox').style.display='none';document.getElementById('st-cr').style.display='none';document.getElementById('st-jo').style.display='none';
  document.getElementById('multi-opts').style.display='none';
  sgame='';document.getElementById('sgl').textContent='— Oyun Seç —';
  document.querySelectorAll('.gc').forEach(c=>c.classList.remove('sel'));
  switchTab('cr');players=[];hostConns=[];
  // If guest mode, re-enable uname input
  if(!currentUser){
    const inp=document.getElementById('uname');
    if(inp){inp.removeAttribute('readonly');inp.style.opacity='1';inp.style.cursor='';}
  }
  showSc('home');
}
