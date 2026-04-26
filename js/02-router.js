// ============================================================
// HANDLE GAME MESSAGES (both host-from-any and guest-from-host)
// ============================================================
function handleGameMsg(d){
  if(curGame==='dama')damaMsg(d);
  else if(curGame==='chess')chessMsg(d);
  else if(curGame==='tavla')tavlaMsg(d);
  else if(curGame==='uno')unoMsg(d);
  else if(curGame==='okey')okeyMsg(d);
  else if(curGame==='amiral')amiralMsg(d);
  else if(curGame==='sos')sosMsg(d);
  else if(curGame==='asmaca')asmacaMsg(d);
}
