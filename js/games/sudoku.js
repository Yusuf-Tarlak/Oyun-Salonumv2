// ============================================================
// SUDOKU (Offline - Tek Kişi)
// ============================================================
let SudokuState={board:[],solution:[],given:[],selected:-1,errors:0,hints:3,timerInterval:null,seconds:0,diff:'medium'};

function sudokuChangeDiff(){SudokuState.diff=document.getElementById('sudoku-diff')?.value||'medium';}

function initSudoku(){
  if(SudokuState.timerInterval)clearInterval(SudokuState.timerInterval);
  SudokuState={board:[],solution:[],given:[],selected:-1,errors:0,hints:3,timerInterval:null,seconds:0,diff:document.getElementById('sudoku-diff')?.value||'medium'};
  sudokuGenerate();
  rSudoku();
  sudokuStartTimer();
  document.getElementById('sudoku-status').textContent='';
}

function sudokuNew(){
  if(SudokuState.timerInterval)clearInterval(SudokuState.timerInterval);
  SudokuState.seconds=0;SudokuState.errors=0;SudokuState.hints=3;SudokuState.selected=-1;
  sudokuGenerate();rSudoku();sudokuStartTimer();
  document.getElementById('sudoku-status').textContent='';
}

function sudokuStartTimer(){
  SudokuState.timerInterval=setInterval(()=>{
    SudokuState.seconds++;
    const m=Math.floor(SudokuState.seconds/60),s=SudokuState.seconds%60;
    const el=document.getElementById('sudoku-timer');
    if(el)el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  },1000);
}

function sudokuGenerate(){
  // Tam çözüm oluştur
  const sol=Array(81).fill(0);
  sudokuSolve(sol,true);
  SudokuState.solution=[...sol];
  // Zorluk seviyesine göre hücre sil
  const remove={easy:36,medium:46,hard:54}[SudokuState.diff]||46;
  const puzzle=[...sol];
  let removed=0,attempts=0;
  while(removed<remove&&attempts<200){
    const idx=Math.floor(Math.random()*81);
    if(puzzle[idx]!==0){puzzle[idx]=0;removed++;}
    attempts++;
  }
  SudokuState.board=puzzle.map(v=>v===0?0:v);
  SudokuState.given=puzzle.map(v=>v!==0);
}

function sudokuSolve(board,randomize=false){
  const empty=board.indexOf(0);
  if(empty===-1)return true;
  const nums=[1,2,3,4,5,6,7,8,9];
  if(randomize)for(let i=nums.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[nums[i],nums[j]]=[nums[j],nums[i]];}
  for(const n of nums){
    if(sudokuValid(board,empty,n)){
      board[empty]=n;
      if(sudokuSolve(board,randomize))return true;
      board[empty]=0;
    }
  }
  return false;
}

function sudokuValid(board,idx,n){
  const r=Math.floor(idx/9),c=idx%9;
  for(let i=0;i<9;i++){
    if(board[r*9+i]===n||board[i*9+c]===n)return false;
  }
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(board[(br+i)*9+(bc+j)]===n)return false;
  return true;
}

function rSudoku(){
  const b=document.getElementById('sudoku-board');if(!b)return;
  b.innerHTML='';
  SudokuState.board.forEach((val,i)=>{
    const cell=document.createElement('div');
    cell.className='sc';
    const r=Math.floor(i/9),c=i%9;
    if(c===2||c===5)cell.classList.add('s3');
    if(r===2||r===5)cell.classList.add('s3b');
    if(SudokuState.given[i])cell.classList.add('given');
    if(i===SudokuState.selected)cell.classList.add('selected');
    // Related cells highlight
    if(SudokuState.selected>=0&&i!==SudokuState.selected){
      const sr=Math.floor(SudokuState.selected/9),sc2=SudokuState.selected%9;
      if(r===sr||c===sc2||(Math.floor(r/3)===Math.floor(sr/3)&&Math.floor(c/3)===Math.floor(sc2/3)))
        cell.classList.add('related');
    }
    if(val&&val!==SudokuState.solution[i]&&!SudokuState.given[i])cell.classList.add('error');
    if(val)cell.textContent=val;
    if(!SudokuState.given[i])cell.onclick=()=>{SudokuState.selected=i;rSudoku();};
    b.appendChild(cell);
  });
}

function sudokuInput(n){
  const idx=SudokuState.selected;
  if(idx<0||SudokuState.given[idx])return;
  SudokuState.board[idx]=n;
  rSudoku();
  // Tamamlandı mı?
  if(SudokuState.board.every((v,i)=>v===SudokuState.solution[i])){
    clearInterval(SudokuState.timerInterval);
    const m=Math.floor(SudokuState.seconds/60),s=SudokuState.seconds%60;
    document.getElementById('sudoku-status').textContent=`🏆 Tebrikler! ${m}:${String(s).padStart(2,'0')} sürede tamamladın!`;
    playFx('win');
  }
}

function sudokuHint(){
  if(SudokuState.hints<=0){toast('İpucu hakkın kalmadı!');return;}
  // Yanlış veya boş hücre bul
  for(let i=0;i<81;i++){
    if(!SudokuState.given[i]&&SudokuState.board[i]!==SudokuState.solution[i]){
      SudokuState.board[i]=SudokuState.solution[i];
      SudokuState.hints--;
      SudokuState.selected=i;
      rSudoku();
      toast('💡 İpucu kullanıldı! Kalan: '+SudokuState.hints);
      return;
    }
  }
  toast('Tüm hücreler doğru!');
}

function sudokuCheck(){
  let errors=0;
  SudokuState.board.forEach((v,i)=>{if(v&&!SudokuState.given[i]&&v!==SudokuState.solution[i])errors++;});
  const status=document.getElementById('sudoku-status');
  if(errors===0)status.textContent='✓ Şu ana kadar hata yok!';
  else status.textContent=`✗ ${errors} hatalı hücre var.`;
}
