// ============================================================
// YÜZEN TEMA PANELİ JS
// ============================================================
const THEMES_LIST=[
  {id:'classic',label:'🟢 Klasik Kahvehane'},
  {id:'night',  label:'🌙 Gece / Mor'},
  {id:'emerald',label:'💚 Zümrüt'},
  {id:'royal',  label:'👑 Royal Altın'},
  {id:'casino', label:'🎰 Retro Casino'},
  {id:'light',  label:'☀️ Açık Tema'},
];
function toggleThemePanel(){
  const panel=document.getElementById('float-theme-panel');
  const list=document.getElementById('float-theme-list');
  if(!panel)return;
  const isOpen=panel.style.display!=='none';
  if(!isOpen){
    list.innerHTML='';
    THEMES_LIST.forEach(t=>{
      const btn=document.createElement('button');
      btn.textContent=t.label;
      const isActive=currentTheme===t.id;
      btn.style.cssText='background:'+(isActive?'rgba(201,168,76,0.15)':'transparent')+';border:1px solid '+(isActive?'var(--gold)':'transparent')+';border-radius:6px;color:var(--text);font-family:"Crimson Pro",serif;font-size:0.85rem;padding:7px 10px;cursor:pointer;text-align:left;width:100%;transition:all 0.15s;';
      btn.onmouseover=()=>{if(currentTheme!==t.id)btn.style.background='rgba(201,168,76,0.08)';};
      btn.onmouseout=()=>{if(currentTheme!==t.id)btn.style.background='transparent';};
      btn.onclick=()=>{applyTheme(t.id);toggleThemePanel();};
      list.appendChild(btn);
    });
    panel.style.display='block';
    setTimeout(()=>document.addEventListener('click',_closePanelOutside,{once:true}),50);
  }else{
    panel.style.display='none';
  }
}
function _closePanelOutside(e){
  const wrap=document.getElementById('float-theme-btn');
  if(wrap&&!wrap.contains(e.target)){
    const p=document.getElementById('float-theme-panel');
    if(p)p.style.display='none';
  }else if(wrap&&wrap.contains(e.target)){
    // still inside, re-add listener
    setTimeout(()=>document.addEventListener('click',_closePanelOutside,{once:true}),50);
  }
}
