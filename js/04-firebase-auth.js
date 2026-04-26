// ============================================================
// FIREBASE AUTH
// ============================================================
function initAuth(){
  try{
    fbAuth=firebase.auth();
    fbAuth.onAuthStateChanged(user=>{
      if(user){
        currentUser=user;
        // Kullanıcı adını bul: DB → localStorage → email prefix
        const emailPrefix=user.email?user.email.split('@')[0]:'Oyuncu';
        const localName=localStorage.getItem('username_'+user.uid)||'';
        function applyUserName(dname){
          currentUser._dname=dname;
          const inp=document.getElementById('uname');
          if(inp){inp.value=dname;inp.setAttribute('readonly','');inp.style.opacity='0.7';inp.style.cursor='default';}
          const av=document.getElementById('auth-avatar-home');
          const un=document.getElementById('auth-username-home');
          const em=document.getElementById('auth-email-home');
          if(av)av.textContent=dname[0]?.toUpperCase()||'?';
          if(un)un.textContent=dname;
          if(em)em.textContent=user.email||'';
          showSc('home');
        }
        if(fbDb){
          fbDb.ref('users/'+user.uid).once('value')
            .then(snap=>{
              const data=snap.val();
              const dname=data?.username||localName||emailPrefix;
              // localStorage'ı güncelle
              if(data?.username) try{localStorage.setItem('username_'+user.uid,data.username);}catch(e){}
              applyUserName(dname);
            })
            .catch(()=>applyUserName(localName||emailPrefix));
        } else {
          applyUserName(localName||emailPrefix);
        }
      } else {
        currentUser=null;
        showSc('auth');
      }
    });
  }catch(e){console.error('Auth:',e);showSc('auth');}
}
function switchAuthTab(tab){
  document.getElementById('auth-tab-login').classList.toggle('active',tab==='login');
  document.getElementById('auth-tab-register').classList.toggle('active',tab==='register');
  document.getElementById('auth-login-form').style.display=tab==='login'?'block':'none';
  document.getElementById('auth-register-form').style.display=tab==='register'?'block':'none';
  document.getElementById('auth-login-err').classList.remove('show');
  document.getElementById('auth-reg-err').classList.remove('show');
}
function showAuthErr(id,msg){const el=document.getElementById(id);if(el){el.textContent=msg;el.classList.add('show');}}
function authErrMsg(code){
  return({'auth/user-not-found':'Bu e-posta ile hesap bulunamadı.','auth/wrong-password':'Şifre yanlış.','auth/invalid-email':'Geçersiz e-posta.','auth/email-already-in-use':'Bu e-posta zaten kayıtlı.','auth/weak-password':'Şifre en az 6 karakter olmalı.','auth/too-many-requests':'Çok fazla deneme. Lütfen bekleyin.','auth/invalid-credential':'E-posta veya şifre hatalı.','auth/network-request-failed':'Bağlantı hatası.'}[code]||'Bir hata oluştu.');
}
function authLogin(){
  if(!fbAuth){
    const btn=document.getElementById('auth-login-btn');
    if(btn){btn.disabled=true;btn.querySelector('span').textContent='Bağlanıyor...';}
    setTimeout(()=>{
      if(btn){btn.disabled=false;btn.querySelector('span').textContent='Giriş Yap →';}
      if(!fbAuth){showAuthErr('auth-login-err','Bağlantı hatası. Sayfayı yenileyin.');return;}
      authLogin();
    },1500);
    return;
  }
  const email=document.getElementById('auth-login-email').value.trim();
  const pass=document.getElementById('auth-login-pass').value;
  if(!email||!pass){showAuthErr('auth-login-err','E-posta ve şifre gerekli.');return;}
  const btn=document.getElementById('auth-login-btn');
  btn.disabled=true;btn.querySelector('span').textContent='Giriş yapılıyor...';
  fbAuth.signInWithEmailAndPassword(email,pass)
    .then(()=>{document.getElementById('auth-login-err').classList.remove('show');})
    .catch(e=>{showAuthErr('auth-login-err',authErrMsg(e.code));btn.disabled=false;btn.querySelector('span').textContent='Giriş Yap →';});
}
function authRegister(){
  if(!fbAuth){
    // Firebase henüz hazır değil, kısa süre bekle
    const btn=document.getElementById('auth-reg-btn');
    if(btn){btn.disabled=true;btn.querySelector('span').textContent='Bağlanıyor...';}
    setTimeout(()=>{
      if(btn){btn.disabled=false;btn.querySelector('span').textContent='Kayıt Ol →';}
      if(!fbAuth){showAuthErr('auth-reg-err','Bağlantı hatası. Sayfayı yenileyin.');return;}
      authRegister();
    },1500);
    return;
  }
  const name=document.getElementById('auth-reg-name').value.trim();
  const email=document.getElementById('auth-reg-email').value.trim();
  const pass=document.getElementById('auth-reg-pass').value;
  if(!name){showAuthErr('auth-reg-err','Kullanıcı adı gerekli.');return;}
  if(name.length<2){showAuthErr('auth-reg-err','Kullanıcı adı en az 2 karakter olmalı.');return;}
  if(!email||!pass){showAuthErr('auth-reg-err','E-posta ve şifre gerekli.');return;}
  const btn=document.getElementById('auth-reg-btn');
  btn.disabled=true;btn.querySelector('span').textContent='Kaydediliyor...';
  // Önce hesabı oluştur
  fbAuth.createUserWithEmailAndPassword(email,pass)
    .then(cred=>{
      // Kullanıcı adını localStorage'a da kaydet (DB erişimi olmasa bile çalışsın)
      try{localStorage.setItem('username_'+cred.user.uid, name);}catch(e){}
      // DB'ye kaydetmeyi dene (başarısız olursa sessizce geç)
      if(fbDb){
        fbDb.ref('users/'+cred.user.uid).set({
          username:name, email:email,
          createdAt:firebase.database.ServerValue.TIMESTAMP
        }).catch(()=>{});
      }
      // onAuthStateChanged zaten ana sayfaya yönlendirir
    })
    .catch(e=>{
      showAuthErr('auth-reg-err',authErrMsg(e.code));
      btn.disabled=false;
      btn.querySelector('span').textContent='Kayıt Ol →';
    });
}
function authLogout(){
  if(!fbAuth)return;
  // Önce oyun bağlantılarını kapat
  gameActive=false;
  hostConns.forEach(c=>{try{c.close();}catch(e){}});hostConns=[];
  if(myConn){try{myConn.close();}catch(e){}myConn=null;}
  if(myPeer){try{myPeer.destroy();}catch(e){}myPeer=null;}
  players=[];
  // Sonra çıkış yap - onAuthStateChanged showSc('auth') çağırır
  fbAuth.signOut().catch(e=>console.error('Logout error:',e));
}
function authGuest(){
  currentUser=null;
  // Eğer fbAuth varsa oturumu kapat (başka hesap açıksa)
  if(fbAuth && fbAuth.currentUser){
    fbAuth.signOut().catch(()=>{});
  }
  const inp=document.getElementById('uname');
  if(inp){inp.value='';inp.removeAttribute('readonly');inp.style.opacity='1';inp.style.cursor='';}
  const av=document.getElementById('auth-avatar-home');
  const un=document.getElementById('auth-username-home');
  const em=document.getElementById('auth-email-home');
  const btn=document.getElementById('auth-bar-btn');
  if(av)av.textContent='👤';
  if(un)un.textContent='Misafir';
  if(em)em.textContent='Kayıt olmadan oynuyorsun';
  if(btn)btn.textContent='Giriş Yap';
  showSc('home');
  // Firebase bağlıysa odaları yükle
  if(fbDb){
    fbDb.ref('rooms').once('value').then(snap=>renderRooms(snap.val()||{}));
  }
}
function authBarAction(){
  if(currentUser) authLogout();
  else showSc('auth');
}

const FB_CONFIG = {
  apiKey: "AIzaSyC2XwMEbST0Q2yUPPedMiLltMRA_wsZ7Cw",
  authDomain: "oyun-salonu-v2.firebaseapp.com",
  databaseURL: "https://oyun-salonu-v2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "oyun-salonu-v2",
  storageBucket: "oyun-salonu-v2.firebasestorage.app",
  messagingSenderId: "147878357962",
  appId: "1:147878357962:web:88576f26acccf14ab23d33"
};


function initFirebase(){
  try{
    if(!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    fbDb=firebase.database();
    document.getElementById('fb-status-txt').textContent='Bağlandı';
    // Realtime listener for rooms
    fbDb.ref('rooms').on('value', snap=>{
      renderRooms(snap.val()||{});
    });
    // Init auth after DB ready
    initAuth();
  }catch(e){
    console.error('Firebase init error:',e);
    const st=document.getElementById('fb-status-txt');
    if(st) st.textContent='Bağlantı hatası';
    const rl=document.getElementById('rooms-list');
    if(rl) rl.innerHTML='<div class="rooms-empty">Firebase bağlanamadı.</div>';
    // Firebase olmadan misafir modda çalış
    fbDb=null; fbAuth=null;
    showSc('auth');
  }
}

function loadRooms(){
  if(!fbDb){return;}
  fbDb.ref('rooms').once('value').then(snap=>renderRooms(snap.val()||{}));
}

const GAME_ICONS={'dama':'🔴','chess':'♟','tavla':'🎲','uno':'🃏','okey':'🀄'};
const GAME_LABELS_TR={'dama':'Dama','chess':'Satranç','tavla':'Tavla','uno':'Uno','okey':'Okey'};

function renderRooms(data){
  const list=document.getElementById('rooms-list');
  if(!list)return;
  const now=Date.now();
  const rooms=Object.entries(data)
    .filter(([k,v])=>{
      if(!v||!v.code) return false;
      if(v.isPrivate) return false;
      // createdAt yoksa veya 0 ise göster (yeni oda), çok eskiyse gizle
      if(v.createdAt && v.createdAt>0 && (now-v.createdAt)>600000) return false;
      return true;
    })
    .sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));

  if(rooms.length===0){
    list.innerHTML='<div class="rooms-empty">Henüz açık oda yok.<br>Bir oyun seçip <b>Oda Oluştur</b> butonuna bas!</div>';
    return;
  }
  list.innerHTML='';
  rooms.forEach(([key,room])=>{
    const filled=room.playerCount||1;
    const max=room.maxPlayers||2;
    const isFull=filled>=max;
    const card=document.createElement('div');
    card.className='room-card'+(isFull?' full':'');
    let dots='';
    for(let i=0;i<max;i++) dots+=`<div class="room-dot${i<filled?' filled':''}"></div>`;
    const safeCode=String(room.code||'').replace(/[^A-Z0-9]/g,'');
    const safeGame=String(room.game||'').replace(/[^a-z]/g,'');
    card.innerHTML=`
      <div class="room-game-icon">${GAME_ICONS[room.game]||'🎮'}</div>
      <div class="room-info">
        <div class="room-game-name">${GAME_LABELS_TR[room.game]||esc(room.game)}</div>
        <div class="room-host">Host: ${esc(room.hostName||'?')} &nbsp;·&nbsp; Kod: ${safeCode}</div>
      </div>
      <div class="room-players">
        <div class="room-player-dots">${dots}</div>
        <div class="room-player-txt">${filled}/${max}</div>
      </div>
      <button class="room-join-btn${isFull?' disabled':''}" onclick="quickJoin('${safeCode}','${safeGame}',${isFull})">${isFull?'Dolu':'Katıl →'}</button>
    `;
    list.appendChild(card);
  });
}

function quickJoin(code,game,isFull){
  if(isFull){toast('Oda dolu!');return;}
  const name=document.getElementById('uname').value.trim();
  if(!name){toast('Önce kullanıcı adı girin!');document.getElementById('uname').focus();return;}
  // Fill in join form and connect
  sgame=game;
  document.getElementById('jcode').value=code;
  switchTab('jo');
  joinRoom();
}

function publishRoom(){
  if(!fbDb||!roomCode||!curGame||!isHost)return;
  myRoomRef=fbDb.ref('rooms/room_'+roomCode);
  myRoomRef.set({
    code:roomCode,
    game:curGame,
    hostName:myName,
    maxPlayers:maxPlayers,
    playerCount:1,
    createdAt:Date.now()
  });
  myRoomRef.onDisconnect().remove();
}

function updateRoomCount(){
  if(!myRoomRef||!isHost)return;
  myRoomRef.update({playerCount:players.length});
}

function removeRoom(){
  if(myRoomRef){try{myRoomRef.remove();}catch(e){}myRoomRef=null;}
}

// Patch createRoom to publish to Firebase after peer opens
const _fbOrigCreateRoom=createRoom;
createRoom=function(){
  roomType=roomType||'public'; // ensure roomType set
  _fbOrigCreateRoom();
  // Wait for peer to open and roomCode to be set, then publish
  let attempts=0;
  const t=setInterval(()=>{
    attempts++;
    if(roomCode&&isHost&&myPeer){
      clearInterval(t);
      setTimeout(()=>{if(myPeer&&roomCode)publishRoom();},800);
    }
    if(attempts>30)clearInterval(t);
  },200);
};

// Patch leaveHome to remove room from Firebase
const _fbOrigLeaveHome=leaveHome;
leaveHome=function(){
  removeRoom();
  _fbOrigLeaveHome();
  setTimeout(updateProfileUI,0);
};

// Patch updateLobby to sync player count
const _fbOrigUpdateLobby=updateLobby;
updateLobby=function(){
  _fbOrigUpdateLobby();
  if(isHost)updateRoomCount();
};

// Remove room when game starts (oda doldu, artık listede gözükmesin)
const _fbOrigHostStart=hostStartGame;
hostStartGame=function(){
  removeRoom();
  _fbOrigHostStart();
};

// Init - Firebase scriptleri yüklendikten sonra başlat
function safeInitFirebase(){
  if(typeof firebase === 'undefined'){
    setTimeout(safeInitFirebase, 100);
    return;
  }
  initFirebase();
}
safeInitFirebase();
// showSc handled by auth state change
