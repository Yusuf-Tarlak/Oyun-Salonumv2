// ============================================================
// TAVLA (2-player)
// ============================================================
let TP=[],TMC='',TMT=false,TDice=[],TUsed=[],TSEL=null,TVTG=[];
function initTavla(){TMC=myIdx===0?'W':'B';TMT=myIdx===0;TP=Array(28).fill(null).map(()=>({W:0,B:0}));TP[24].W=2;TP[13].W=5;TP[8].W=3;TP[6].W=5;TP[1].B=2;TP[12].B=5;TP[17].B=3;TP[19].B=5;TDice=[];TUsed=[];TSEL=null;TVTG=[];
  const sc=document.getElementById('tavla-scores');sc.innerHTML='';players.forEach(p=>{const card=document.createElement('div');card.className='pcard'+(p.idx===myIdx?' me':'');card.id='tavla-pc-'+p.idx;card.innerHTML=`<div class="pc-lbl">${p.idx===myIdx?'Sen':'Rakip'}</div><div class="pc-name">${esc(p.name)}</div><div class="pc-info">${p.idx===0?'⚪ Beyaz':'⚫ Siyah'}</div>`;sc.appendChild(card);});
  rTavla();uTavlaTurn();addSys('tavla','Oyun başladı!');}
function rTavla(){
  const b=document.getElementById('tavla-board');
  b.innerHTML='';
  const iw=TMC==='W';
  const top=iw?[13,14,15,16,17,18,19,20,21,22,23,24]:[12,11,10,9,8,7,6,5,4,3,2,1];
  const bot=iw?[12,11,10,9,8,7,6,5,4,3,2,1]:[13,14,15,16,17,18,19,20,21,22,23,24];

  function mkChecker(col, count, stackIdx){
    const ch=document.createElement('div');
    ch.className='ckr '+col;
    if(stackIdx===0 && count>5){
      const badge=document.createElement('div');
      badge.className='ckr-count';
      badge.textContent=count;
      ch.appendChild(badge);
    }
    return ch;
  }

  function mkPts(arr,pos){
    const d=document.createElement('div');
    d.className='thalf';
    arr.forEach(pi=>{
      const pt=document.createElement('div');
      pt.className='tpt '+pos+' '+(pi%2===0?'dt':'lt');
      if(TSEL!==null && TVTG.includes(pi)) pt.classList.add('hi');
      if(TSEL===pi) pt.classList.add('sel-pt');
      const nm=document.createElement('span');
      nm.className='ptnum';nm.textContent=pi;
      pt.appendChild(nm);
      const data=TP[pi];
      if(data){
        ['W','B'].forEach(col=>{
          const cnt=data[col];
          if(cnt<=0)return;
          const show=Math.min(cnt,6);
          for(let i=0;i<show;i++){
            pt.appendChild(mkChecker(col,cnt,i));
          }
        });
      }
      pt.onclick=()=>tClick(pi);
      d.appendChild(pt);
    });
    return d;
  }

  function mkBar(){
    const d=document.createElement('div');
    d.className='barcol';
    const lbl=document.createElement('div');
    lbl.className='bar-label';lbl.textContent='BAR';
    d.appendChild(lbl);
    const tbi=iw?25:0;
    const bbi=iw?0:25;
    ['W','B'].forEach((col,ci)=>{
      const barIdx=ci===0?tbi:bbi;
      const cnt=TP[barIdx]?.[col]||0;
      for(let i=0;i<Math.min(cnt,4);i++){
        const bp=document.createElement('div');
        bp.className='barp '+col;
        d.appendChild(bp);
      }
      if(cnt>4){
        const lbl2=document.createElement('div');
        lbl2.style.cssText='font-size:0.45rem;color:var(--gold);font-family:Cinzel,serif;';
        lbl2.textContent=cnt;
        d.appendChild(lbl2);
      }
    });
    d.onclick=()=>tClick(iw?25:0);
    return d;
  }

  function mkHome(){
    const d=document.createElement('div');
    d.className='homecol';
    const lbl=document.createElement('div');
    lbl.className='home-lbl';lbl.textContent='EV';
    d.appendChild(lbl);
    const wh=TP[26]?.W||0;
    const bh=TP[27]?.B||0;
    // Beyaz taşlar
    for(let i=0;i<Math.min(wh,8);i++){
      const hp=document.createElement('div');hp.className='homepc W';d.appendChild(hp);
    }
    if(wh>0){
      const cnt=document.createElement('div');cnt.className='home-count';cnt.textContent='⚪'+wh;d.appendChild(cnt);
    }
    const sep=document.createElement('div');sep.style.height='4px';d.appendChild(sep);
    // Siyah taşlar
    for(let i=0;i<Math.min(bh,8);i++){
      const hp=document.createElement('div');hp.className='homepc B';d.appendChild(hp);
    }
    if(bh>0){
      const cnt=document.createElement('div');cnt.className='home-count';cnt.textContent='⚫'+bh;d.appendChild(cnt);
    }
    return d;
  }

  const tr=document.createElement('div');tr.className='trow';
  tr.appendChild(mkPts(top.slice(0,6),'top'));
  tr.appendChild(mkBar());
  tr.appendChild(mkPts(top.slice(6,12),'top'));
  tr.appendChild(mkHome());

  const mid=document.createElement('div');mid.className='tboard-mid';

  const br=document.createElement('div');br.className='trow';
  br.appendChild(mkPts(bot.slice(0,6),'bot'));
  br.appendChild(mkBar());
  br.appendChild(mkPts(bot.slice(6,12),'bot'));
  const bh2=document.createElement('div');bh2.className='homecol';br.appendChild(bh2);

  b.appendChild(tr);b.appendChild(mid);b.appendChild(br);

  // Stats bar güncelle
  const stats=document.getElementById('tavla-stats');
  if(stats){
    const wBar=TP[25]?.W||0, bBar=TP[0]?.B||0;
    const wHome=TP[26]?.W||0, bHome=TP[27]?.B||0;
    stats.innerHTML=`
      <div class="tstat"><div class="tstat-dot W"></div><span>Beyaz: ev=${wHome} bar=${wBar}</span></div>
      <div class="tstat"><div class="tstat-dot B"></div><span>Siyah: ev=${bHome} bar=${bBar}</span></div>
    `;
  }
}

function uTavlaTurn(){const el=document.getElementById('tavla-turn');if(TMT){el.textContent='▶ Senin sıran';el.className='turnbar my';}else{el.textContent=(players.find(p=>p.idx!==myIdx)?.name||'Rakip')+' oynuyor...';el.className='turnbar opp';}document.getElementById('btn-roll').disabled=!TMT||TDice.length>0;document.getElementById('btn-pass').disabled=!TMT||TDice.length===0;}
function rDice(){
  const area=document.getElementById('tavla-dice');
  const D=['','⚀','⚁','⚂','⚃','⚄','⚅'];
  const faces=['','1','2','3','4','5','6'];
  area.innerHTML='';
  if(TDice.length===0){
    const hint=document.createElement('div');
    hint.style.cssText='font-family:Cinzel,serif;font-size:0.65rem;color:var(--muted);letter-spacing:0.1em;';
    hint.textContent=TMT?'Zar atma sırası sende':'Rakip oynuyor...';
    area.appendChild(hint);
    return;
  }
  TDice.forEach((d,i)=>{
    const el=document.createElement('div');
    el.className='die'+(TUsed.includes(i)?' used':'');
    el.textContent=D[d];
    el.title=faces[d];
    area.appendChild(el);
  });
}
function tavlaRoll(){
  if(!TMT||!gameActive)return;
  const dice=[Math.ceil(Math.random()*6),Math.ceil(Math.random()*6)];
  if(dice[0]===dice[1])TDice=[dice[0],dice[0],dice[0],dice[0]];
  else TDice=[...dice];
  TUsed=[];
  sendToAll({t:'tavla-roll',dice:TDice});
  // Animasyonlu zar gösterimi
  const area=document.getElementById('tavla-dice');
  const D=['','⚀','⚁','⚂','⚃','⚄','⚅'];
  area.innerHTML='';
  TDice.forEach((d,i)=>{
    const el=document.createElement('div');
    el.className='die rolling';
    el.textContent=D[d];
    el.style.animationDelay=(i*0.08)+'s';
    area.appendChild(el);
  });
  setTimeout(()=>{rDice();},500);
  uTavlaTurn();
  const doubles=dice[0]===dice[1]?' (DUBLÖ! 4 hamle)':'';
  addSys('tavla','🎲 Zarlar: '+dice.join(' - ')+doubles);
  playFx('draw');
}
function tClick(pt){if(!TMT||!gameActive||TDice.length===0)return;const myBar=TMC==='W'?25:0;const bc=TP[myBar]?.[TMC]||0;if(bc>0&&pt!==myBar){const tg=tMoves(myBar);if(tg.includes(pt)){aTavla(myBar,pt);return;}TSEL=myBar;TVTG=tg;rTavla();return;}if(TSEL===null){const d=TP[pt];if(!d||!d[TMC]||d[TMC]===0)return;const tg=tMoves(pt);TSEL=pt;TVTG=tg;rTavla();return;}if(TVTG.includes(pt)){aTavla(TSEL,pt);return;}TSEL=null;TVTG=[];rTavla();tClick(pt);}
function tMoves(from){const rem=TDice.filter((_,i)=>!TUsed.includes(i));const tg=new Set();const dir=TMC==='W'?-1:1;const isBar=from===(TMC==='W'?25:0);const mH=TMC==='W'?26:27;const cBO=allHome(TMC);rem.forEach(d=>{let to=isBar?(TMC==='W'?25-d:d):from+dir*d;if(cBO&&(to<1||to>24)){tg.add(mH);return;}if(to>=1&&to<=24){const pd=TP[to];const oC=TMC==='W'?'B':'W';if(!pd||pd[oC]<=1)tg.add(to);}});return[...tg];}
function allHome(col){const hr=col==='W'?[1,2,3,4,5,6]:[19,20,21,22,23,24];const bar=col==='W'?25:0;if((TP[bar]?.[col]||0)>0)return false;for(let p=1;p<=24;p++){if(hr.includes(p))continue;if((TP[p]?.[col]||0)>0)return false;}return true;}
function aTavla(from,to){const myC=TMC;const oC=myC==='W'?'B':'W';const myBar=myC==='W'?25:0;const oppBar=myC==='W'?0:25;const myH=myC==='W'?26:27;const rem=TDice.map((_,i)=>i).filter(i=>!TUsed.includes(i));const isBar=from===(myC==='W'?25:0);const isH=to===(myC==='W'?26:27);const dir=myC==='W'?-1:1;let di=rem[0];
  // Find the exact die: for normal moves match exact, for bearing off use smallest valid die
  if(!isH){
    rem.forEach(i=>{const reach=isBar?(myC==='W'?25-TDice[i]:TDice[i]):from+dir*TDice[i];if(reach===to)di=i;});
  } else {
    // Bearing off: prefer exact, fallback to smallest die >= distance
    const dist=myC==='W'?from:(25-from);
    let exactDi=-1,overDi=-1,overVal=99;
    rem.forEach(i=>{
      const d2=TDice[i];
      if(d2===dist){exactDi=i;}
      else if(d2>dist&&d2<overVal){overVal=d2;overDi=i;}
    });
    di=exactDi>=0?exactDi:(overDi>=0?overDi:rem[0]);
  }TP[from][myC]=Math.max(0,TP[from][myC]-1);if(isH){TP[myH][myC]=(TP[myH][myC]||0)+1;}else{if(TP[to][oC]===1){TP[to][oC]=0;TP[oppBar][oC]=(TP[oppBar][oC]||0)+1;addSys('tavla','Vurdu!');}TP[to][myC]=(TP[to][myC]||0)+1;}TUsed.push(di);TSEL=null;TVTG=[];sendToAll({t:'tavla-move',from,to});const hc=TP[myH]?.[myC]||0;if(hc>=15){gameOver(true,'Tüm taşlarını çıkardın!');return;}const rem2=TDice.filter((_,i)=>!TUsed.includes(i));if(rem2.length===0||!tHasMv(myC)){setTimeout(()=>{TUsed=[];TDice=[];TMT=false;rTavla();rDice();uTavlaTurn();},320);}else{rTavla();rDice();uTavlaTurn();}}
function tHasMv(col){const bar=col==='W'?25:0;const srcs=[];if((TP[bar]?.[col]||0)>0)srcs.push(bar);else for(let i=1;i<=24;i++)if((TP[i]?.[col]||0)>0)srcs.push(i);return srcs.some(s=>tMoves(s).length>0);}
function tavlaPass(){if(!TMT)return;TDice=[];TUsed=[];TMT=false;sendToAll({t:'tavla-pass'});rTavla();rDice();uTavlaTurn();}
function tavlaMsg(d){
  if(d.fromIdx===myIdx)return;
  if(d.t==='tavla-roll'){
    TDice=[...d.dice];TUsed=[];rDice();uTavlaTurn();
    addSys('tavla',(players.find(p=>p.idx===d.fromIdx)?.name||'Rakip')+' zar attı: '+d.dice.join(' - '));
  } else if(d.t==='tavla-move'){
    // actC = opponent's color (the one who moved)
    const actC = TMC==='W'?'B':'W';
    const myBarC = TMC; // my color for hit detection
    const myBar = TMC==='W'?25:0;
    const oppH = actC==='W'?26:27;
    const oppBar = actC==='W'?25:0;
    if(d.from>=0) TP[d.from][actC]=Math.max(0,(TP[d.from][actC]||0)-1);
    const isH = d.to===(actC==='W'?26:27);
    if(isH){
      TP[oppH][actC]=(TP[oppH][actC]||0)+1;
    } else {
      // Check if my piece was hit
      if(TP[d.to][myBarC]===1){
        TP[d.to][myBarC]=0;
        TP[myBar][myBarC]=(TP[myBar][myBarC]||0)+1;
        addSys('tavla','Vuruldun!');
      }
      TP[d.to][actC]=(TP[d.to][actC]||0)+1;
    }
    TDice=[];TUsed=[];TMT=true;
    rTavla();rDice();uTavlaTurn();
    const hc=TP[oppH]?.[actC]||0;
    if(hc>=15) gameOver(false,'Rakip tüm taşlarını çıkardı!');
  } else if(d.t==='tavla-pass'){
    TDice=[];TUsed=[];TMT=true;rTavla();rDice();uTavlaTurn();
  }
}
