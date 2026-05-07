// ============================================================
// 101 OKEY — TAM KURAL İMPLEMENTASYONU
// Oyun Salonu v2 — mevcut okey kodunun üzerine ekle/değiştir
//
// DÜZELTMELER:
//   ① Taş dağıtımı: 15/14 → 22/21, başlayan taş çekmez
//   ② Açılış 101 eşiği + puan sayacı
//   ③ Çifte açma sistemi (5 çift minimum)
//   ④ Yerden alınan taşın o turda kullanım zorunluluğu
//   ⑤ Masaya taş işleme (kendi/rakip dizilerine)
//   ⑥ Ceza puanı: açılmayan=202, okey elde=101, sahte okey=101
//   ⑦ Sahte okey görsel ayrımı
//   ⑧ 12-13-1 seri yasağı
//   ⑨ Deste bitince ayar (yeniden karıştır vs puana göre bitir)
//   ⑩ 101 birikimli puan barı
// ============================================================

// ─── AYARLAR ────────────────────────────────────────────────
const OKEY_CFG = {
  cifteMinCift: 5,          // çifte açmak için min çift sayısı
  acilmayanCeza: 202,       // açılmayan oyuncunun ceza puanı
  okeyEldeCeza: 101,        // okey elde kalırsa ceza
  sahteOkeyEldeCeza: 101,   // sahte okey elde kalırsa ceza
  desteBitince: 'bitir',    // 'bitir' veya 'karistir'
  okeyBitmeCezasiVar: false, // okeyle bitmeye özel ceza
  okeyBitmeCezasi: 0,
};

// ─── SABITLER ───────────────────────────────────────────────
const O_RENKLER = ['kirmizi','sari','mavi','siyah'];
const O_EMOJI   = { kirmizi:'🔴', sari:'🟡', mavi:'🔵', siyah:'⚫' };
const O_CSS     = { kirmizi:'#e74c3c', sari:'#c9a800', mavi:'#2471a3', siyah:'#2c3e50' };

// ─── DURUM ──────────────────────────────────────────────────
let OKState = {
  pile: [], discard: [], hands: {}, indicator: null,
  okeyRenk: null, okeySayi: null,
  currentIdx: 0, handCounts: {},
  finished: [], opened: {}, cifteActi: {},
  scores: {}, round: 1,
  drewFlags: {},
  // Yeni alanlar:
  masa: [],              // [{oyuncuIdx, gruplar:[taşlar[]]}] — masadaki tüm açık diziler
  yerdenAlinan: {},      // {oyuncuIdx: taş | null} — bu tur yerden alınan taş
  baslayanIlkAtisTamam: false, // başlayan oyuncu ilk taşını attı mı
  ilkBaslayan: null,     // 22 taş alan oyuncu idx
};

// ─── TAŞ YARDIMCILARI ───────────────────────────────────────
function okTileKey(t) {
  if (!t) return '';
  if (t.sahteOkey) return 'SAHTE';
  return `${t.col}_${t.num}`;
}

function okIsJoker(t) {
  if (!t) return false;
  if (t.sahteOkey || t.j) return true;
  if (!OKState.okeyRenk) return false;
  return t.col === OKState.okeyRenk && t.num === OKState.okeySayi;
}

function okTileLabel(t) {
  if (!t) return '?';
  if (t.sahteOkey) return 'SJ'; // Sahte Joker — görsel ayrım
  if (okIsJoker(t)) return '★';
  return (O_EMOJI[t.col] || '?') + t.num;
}

function okTileStyle(t) {
  if (!t) return { bg: '#888', col: '#fff' };
  if (t.sahteOkey) return { bg: 'linear-gradient(135deg,#8e44ad,#6c3483)', col: '#fff', border: '2px solid #f39c12' };
  if (okIsJoker(t)) return { bg: 'linear-gradient(135deg,#f39c12,#e67e22)', col: '#fff' };
  return { bg: '#f5f0e8', col: O_CSS[t.col] || '#333' };
}

// ─── ① TAŞ DAĞITIMI (22/21) ─────────────────────────────────
function okDagit(pile, oyuncular, baslayanIdx) {
  const eller = {};
  // Başlayan oyuncu 22, diğerleri 21 alır
  const sira = [
    ...oyuncular.filter(p => p.idx === baslayanIdx),
    ...oyuncular.filter(p => p.idx !== baslayanIdx),
  ];
  sira.forEach((p, i) => {
    eller[p.idx] = pile.splice(0, i === 0 ? 22 : 21);
  });
  return eller;
}

// ─── GÖSTERGEVe OKEY ─────────────────────────────────────────
function okGostergeBelirle(pile) {
  // Sahte okey olmayan bir taş çek
  let idx;
  do { idx = Math.floor(Math.random() * pile.length); }
  while (pile[idx]?.sahteOkey || pile[idx]?.j);
  const gosterge = pile.splice(idx, 1)[0];
  const okeyRenk = gosterge.col;
  const okeySayi = gosterge.num === 13 ? 1 : gosterge.num + 1;
  // Destede gerçek okeyleri işaretle
  pile.forEach(t => {
    t.gercekOkey = !t.sahteOkey && !t.j && t.col === okeyRenk && t.num === okeySayi;
  });
  return { gosterge, okeyRenk, okeySayi };
}

// ─── ② SERİ GEÇERLİLİK (12-13-1 yasağı dahil) ───────────────
function okSeriGecerliMi(grup) {
  if (!grup || grup.length < 3) return false;
  const normal = grup.filter(t => !okIsJoker(t));
  const joker  = grup.filter(t => okIsJoker(t)).length;
  if (normal.length === 0) return false;
  const renk = normal[0].col;
  if (normal.some(t => t.col !== renk)) return false;
  const sayilar = normal.map(t => t.num).sort((a, b) => a - b);
  // ⑧ 12-13-1 yasağı
  if (sayilar.includes(1) && sayilar.includes(13)) return false;
  // Tekrar var mı
  for (let i = 1; i < sayilar.length; i++) {
    if (sayilar[i] === sayilar[i - 1]) return false;
  }
  const aralik = sayilar[sayilar.length - 1] - sayilar[0] + 1;
  if (aralik > grup.length) return false;
  const bosluk = aralik - normal.length;
  return bosluk <= joker;
}

function okPerGecerliMi(grup) {
  if (!grup || grup.length < 3 || grup.length > 4) return false;
  const normal = grup.filter(t => !okIsJoker(t));
  const joker  = grup.filter(t => okIsJoker(t)).length;
  if (normal.length === 0) return false;
  const sayi = normal[0].num;
  if (normal.some(t => t.num !== sayi)) return false;
  const renkler = normal.map(t => t.col);
  if (new Set(renkler).size !== renkler.length) return false;
  return normal.length + joker <= 4;
}

function okGrupGecerliMi(grup) {
  return okSeriGecerliMi(grup) || okPerGecerliMi(grup);
}

// ─── ② AÇILIŞ PUAN HESABI ────────────────────────────────────
function okGrupPuani(grup) {
  if (okPerGecerliMi(grup)) {
    const normal = grup.filter(t => !okIsJoker(t));
    const sayi = normal[0]?.num || 0;
    return sayi * grup.length;
  }
  if (okSeriGecerliMi(grup)) {
    const normal = grup.filter(t => !okIsJoker(t));
    const jokerSayisi = grup.filter(t => okIsJoker(t)).length;
    const sayilar = normal.map(t => t.num).sort((a, b) => a - b);
    let toplam = sayilar.reduce((s, n) => s + n, 0);
    // Joker değerlerini bul: önce soldan, sonra sağdan boşlukları doldur
    const dolu = new Set(sayilar);
    let eklenecek = jokerSayisi;
    for (let n = sayilar[0] - 1; n >= 1 && eklenecek > 0; n--) {
      if (!dolu.has(n)) { toplam += n; dolu.add(n); eklenecek--; }
    }
    for (let n = sayilar[sayilar.length - 1] + 1; n <= 13 && eklenecek > 0; n++) {
      if (!dolu.has(n)) { toplam += n; dolu.add(n); eklenecek--; }
    }
    return toplam;
  }
  return 0;
}

function okAcilisPuaniHesapla(gruplar) {
  return (gruplar || []).reduce((sum, g) => sum + okGrupPuani(g), 0);
}

function okYuzBirAcabilirMi(gruplar) {
  if (!gruplar || gruplar.length === 0) return false;
  if (gruplar.some(g => !okGrupGecerliMi(g))) return false;
  return okAcilisPuaniHesapla(gruplar) >= 101;
}

// ─── ③ ÇİFTE AÇMA ────────────────────────────────────────────
function okCiftSayisi(el) {
  const sayac = {};
  let joker = 0;
  el.forEach(t => {
    if (okIsJoker(t)) { joker++; return; }
    const k = `${t.col}_${t.num}`;
    sayac[k] = (sayac[k] || 0) + 1;
  });
  let cift = 0, tek = 0;
  Object.values(sayac).forEach(v => {
    cift += Math.floor(v / 2);
    if (v % 2 === 1) tek++;
  });
  let kalanJoker = joker;
  while (kalanJoker > 0 && tek > 0) { cift++; kalanJoker--; tek--; }
  cift += Math.floor(kalanJoker / 2);
  return cift;
}

function okCifteAcabilirMi(el) {
  return okCiftSayisi(el) >= OKEY_CFG.cifteMinCift;
}

function okCifteGrupGecerliMi(grup) {
  if (!grup || grup.length !== 2) return false;
  const [a, b] = grup;
  if (okIsJoker(a) || okIsJoker(b)) return true;
  return a.col === b.col && a.num === b.num;
}

function okCifteAcilisGecerliMi(gruplar) {
  if (!gruplar || gruplar.length < OKEY_CFG.cifteMinCift) return false;
  return gruplar.every(g => okCifteGrupGecerliMi(g));
}

// ─── ④ YERDEN ALINAN TAŞ KONTROLÜ ────────────────────────────
/**
 * Tur sonunda: yerden alınan taş bu tur kullanıldı mı?
 * acikanGruplar: bu tur açılan yeni gruplar
 * masayaEklenen: bu tur masaya eklenen taşlar
 */
function okYerdenAlinanKullanildiMi(yerdenTas, acikanGruplar, masayaEklenen) {
  if (!yerdenTas) return true;
  for (const g of (acikanGruplar || [])) {
    if (g.some(t => t.id === yerdenTas.id)) return true;
  }
  if ((masayaEklenen || []).some(t => t.id === yerdenTas.id)) return true;
  return false;
}

// ─── ⑤ MASAYA TAŞ İŞLEME ─────────────────────────────────────
/**
 * Masadaki bir diziye taş eklenebilir mi?
 * cifteAcildiMi: çifte açmış oyuncu sadece çift dizilere ekler
 */
function okMasayaEklenebilirMi(mevcutGrup, yeniTas, cifteAcildiMi) {
  if (cifteAcildiMi) {
    // Çifte açılmış diziye sadece aynı renk+sayı eklenebilir
    if (mevcutGrup.length !== 2) return false;
    return yeniTas.col === mevcutGrup[0].col && yeniTas.num === mevcutGrup[0].num && !okIsJoker(yeniTas);
  }
  const deneme = [...mevcutGrup, yeniTas];
  return okGrupGecerliMi(deneme);
}

/**
 * Masadaki tüm dizilere ekleme dene — hangi diziye eklenebilir?
 * Döner: [{masaGrupIdx, pozisyon}] veya []
 */
function okMasaEklemeFirsatlari(el, masa, cifteAcildiMi) {
  const firsatlar = [];
  (masa || []).forEach((grup, gi) => {
    el.forEach(tas => {
      if (okMasayaEklenebilirMi(grup, tas, cifteAcildiMi)) {
        firsatlar.push({ masaGrupIdx: gi, tas });
      }
    });
  });
  return firsatlar;
}

// ─── ⑥ CEZA PUANI ────────────────────────────────────────────
function okTasCezasi(t) {
  if (!t) return 0;
  if (t.sahteOkey) return OKEY_CFG.sahteOkeyEldeCeza;
  if (okIsJoker(t)) {
    return OKEY_CFG.okeyEldeCeza === 'deger' ? t.num : OKEY_CFG.okeyEldeCeza;
  }
  return t.num;
}

function okOyuncuCezasi(el, acildiMi) {
  if (!acildiMi) return OKEY_CFG.acilmayanCeza;
  return (el || []).reduce((sum, t) => sum + okTasCezasi(t), 0);
}

// Tur sonu puan hesabı ve 101 kontrolü
function okTurSonuPuanGuncelle(kazananIdx) {
  const yeniPuanlar = { ...OKState.scores };
  players.forEach(p => {
    if (p.idx === kazananIdx) return;
    const el = OKState.hands[p.idx] || [];
    const acildi = !!OKState.opened[p.idx] || !!OKState.cifteActi[p.idx];
    const ceza = okOyuncuCezasi(el, acildi);
    yeniPuanlar[p.idx] = (yeniPuanlar[p.idx] || 0) + ceza;
  });
  return yeniPuanlar;
}

// ─── INIT (düzeltilmiş) ──────────────────────────────────────
function initOkeyFull() {
  OSEL = null; ODRAWN = false; OSLOTS = null;
  maxPlayers = 4;
  if (!isHost) { renderOkeyFull(); updateOkeyTurnFull(); return; }

  let pile = buildOkeyPile(); // mevcut fonksiyon 106 taş üretmeli
  const { gosterge, okeyRenk, okeySayi } = okGostergeBelirle(pile);
  OKState.okeyRenk = okeyRenk;
  OKState.okeySayi = okeySayi;

  // ① Başlayan oyuncuyu belirle (ilk sıradaki)
  const baslayanIdx = players[0].idx;
  OKState.ilkBaslayan = baslayanIdx;
  OKState.baslayanIlkAtisTamam = false;

  const eller = okDagit(pile, players, baslayanIdx);

  OKState = {
    ...OKState,
    pile,
    discard: [],
    hands: eller,
    indicator: gosterge,
    currentIdx: baslayanIdx,
    handCounts: {},
    finished: [],
    opened: {},
    cifteActi: {},
    masa: [],
    yerdenAlinan: {},
    drewFlags: {},
  };
  players.forEach(p => { OKState.handCounts[p.idx] = OKState.hands[p.idx].length; });

  broadcastFullOkeyStateFull();
  addSys('okey', `Tur ${OKState.round} başladı! Başlayan: ${players[0].name} (22 taş)`);
}

// ─── BROADCAST (masa verisi dahil) ───────────────────────────
function broadcastFullOkeyStateFull() {
  players.forEach(p => {
    if (p.idx === myIdx) return;
    const conn = hostConns[p.idx - 1];
    if (!conn || !conn.open) return;
    const state = {
      t: 'okey-state-full',
      indicator: OKState.indicator,
      okeyRenk: OKState.okeyRenk,
      okeySayi: OKState.okeySayi,
      myHand: OKState.hands[p.idx],
      discard: OKState.discard,
      handCounts: {},
      currentIdx: OKState.currentIdx,
      pileSize: OKState.pile.length,
      finished: OKState.finished,
      opened: OKState.opened,
      cifteActi: OKState.cifteActi,
      scores: OKState.scores,
      round: OKState.round,
      masa: OKState.masa,
      drewFlag: OKState.drewFlags?.[p.idx] || false,
      baslayanIlkAtisTamam: OKState.baslayanIlkAtisTamam,
      ilkBaslayan: OKState.ilkBaslayan,
    };
    players.forEach(pl => { state.handCounts[pl.idx] = OKState.hands[pl.idx]?.length || 0; });
    conn.send(state);
  });
  renderOkeyFull();
  updateOkeyTurnFull();
}

// ─── MESAJ İŞLEYİCİ (full versiyon) ─────────────────────────
function okeyMsgFull(d) {
  if (d.t === 'okey-state-full') {
    OKState.indicator   = d.indicator;
    OKState.okeyRenk    = d.okeyRenk;
    OKState.okeySayi    = d.okeySayi;
    OKState.hands[myIdx] = d.myHand;
    OKState.discard     = d.discard;
    OKState.handCounts  = d.handCounts;
    OKState.currentIdx  = d.currentIdx;
    OKState.pileSize    = d.pileSize;
    OKState.finished    = d.finished || [];
    OKState.opened      = d.opened || {};
    OKState.cifteActi   = d.cifteActi || {};
    OKState.scores      = d.scores || {};
    OKState.round       = d.round || 1;
    OKState.masa        = d.masa || [];
    OKState.baslayanIlkAtisTamam = d.baslayanIlkAtisTamam;
    OKState.ilkBaslayan = d.ilkBaslayan;
    ODRAWN = (d.currentIdx === myIdx) ? (d.drewFlag || false) : false;
    if (d.currentIdx !== myIdx) { OSEL = null; }
    renderOkeyFull();
    updateOkeyTurnFull();
  }
  else if (d.t === 'okey-discard-full' && isHost) {
    const pIdx = getPlayerIdxFromConn(d._connId);
    if (pIdx) applyOkeyDiscardFull(pIdx, d.tile);
  }
  else if (d.t === 'okey-draw-pile-full' && isHost) {
    const pIdx = getPlayerIdxFromConn(d._connId);
    if (pIdx) applyOkeyDrawFull(pIdx, 'pile');
  }
  else if (d.t === 'okey-draw-discard-full' && isHost) {
    const pIdx = getPlayerIdxFromConn(d._connId);
    if (pIdx) applyOkeyDrawFull(pIdx, 'discard');
  }
  else if (d.t === 'okey-ac-full' && isHost) {
    const pIdx = getPlayerIdxFromConn(d._connId);
    if (pIdx) applyOkeyAcFull(pIdx, d.gruplar, d.mod);
  }
  else if (d.t === 'okey-masaya-isle-full' && isHost) {
    const pIdx = getPlayerIdxFromConn(d._connId);
    if (pIdx) applyMasayaIsleFull(pIdx, d.masaGrupIdx, d.tile);
  }
  else if (d.t === 'okey-bitir-full' && isHost) {
    const pIdx = getPlayerIdxFromConn(d._connId);
    if (pIdx) applyOkeyBitirFull(pIdx);
  }
  else if (d.t === 'okey-ac-result') {
    if (!d.ok) toast(d.reason || 'Açılış geçersiz');
  }
}

// ─── DRAW ────────────────────────────────────────────────────
function applyOkeyDrawFull(fromIdx, source) {
  if (!isHost) return;

  // ① Başlayan oyuncu ilk turda taş çekemez (direkt atar)
  if (fromIdx === OKState.ilkBaslayan && !OKState.baslayanIlkAtisTamam) {
    toast('Başlayan oyuncu önce bir taş atmalı!');
    return;
  }

  if (source === 'pile') {
    if (OKState.pile.length === 0) {
      // ⑨ Deste bitti
      if (OKEY_CFG.desteBitince === 'karistir') {
        // Atılan taşları yeniden karıştır
        const yeniPile = okeyKaristir([...OKState.discard]);
        OKState.discard = [];
        OKState.pile = yeniPile;
        addSys('okey', 'Deste bitti, çöplük karıştırıldı!');
      } else {
        // Puana göre bitir
        _okeyDesteBittiYapistir();
        return;
      }
    }
    const tile = OKState.pile.pop();
    OKState.hands[fromIdx].push(tile);
  } else {
    // ④ Yerden taş alma
    if (!OKState.discard || OKState.discard.length === 0) return;
    const tile = OKState.discard.pop();
    OKState.hands[fromIdx].push(tile);
    OKState.yerdenAlinan[fromIdx] = tile; // ④ bu tur kullanım zorunlu
  }

  OKState.handCounts[fromIdx] = OKState.hands[fromIdx].length;
  if (!OKState.drewFlags) OKState.drewFlags = {};
  OKState.drewFlags[fromIdx] = true;

  if (fromIdx !== myIdx) {
    const conn = hostConns[fromIdx - 1];
    if (conn && conn.open) {
      conn.send({
        t: 'okey-drew',
        tile: source === 'pile' ? OKState.hands[fromIdx][OKState.hands[fromIdx].length - 1] : null,
        source,
        discard: OKState.discard,
        pileSize: OKState.pile.length
      });
    }
  } else {
    ODRAWN = true;
  }
  broadcastFullOkeyStateFull();
}

// ─── DISCARD ─────────────────────────────────────────────────
function applyOkeyDiscardFull(fromIdx, tileObj) {
  if (!isHost) return;
  const hand = OKState.hands[fromIdx];
  if (!hand) return;

  // ① Başlayan ilk atış
  if (fromIdx === OKState.ilkBaslayan && !OKState.baslayanIlkAtisTamam) {
    OKState.baslayanIlkAtisTamam = true;
  }

  // ④ Yerden alınan taş bu tur kullanıldı mı?
  const yerden = OKState.yerdenAlinan[fromIdx];
  if (yerden) {
    // Yerden alınan taşı atıyorsa yasak
    if (tileObj.id === yerden.id) {
      if (fromIdx === myIdx) toast('Yerden aldığın taşı direkt atamazsın!');
      else {
        const conn = hostConns[fromIdx - 1];
        if (conn && conn.open) conn.send({ t: 'okey-ac-result', ok: false, reason: 'Yerden aldığın taşı direkt atamazsın!' });
      }
      return;
    }
    // Kullanmadan atıyorsa (yerden alınan taş hâlâ elde)
    const acikanGruplar = []; // bu tur açılış yapılmadıysa boş
    if (!okYerdenAlinanKullanildiMi(yerden, acikanGruplar, [])) {
      // Yerden alınan taş bu turda kullanılmadı — geçersiz
      if (fromIdx === myIdx) toast('Yerden aldığın taşı bu turda kullanmalısın!');
      return;
    }
  }

  // Tile bul ve at
  const tileIdx = hand.findIndex(t => t.id === tileObj.id);
  if (tileIdx < 0) return;
  const tile = hand.splice(tileIdx, 1)[0];
  OKState.discard.push(tile);
  OKState.handCounts[fromIdx] = hand.length;
  OKState.drewFlags[fromIdx] = false;
  delete OKState.yerdenAlinan[fromIdx]; // ④ sıfırla

  // Sıra geç
  const aktifler = players.filter(p => !OKState.finished.includes(p.idx));
  const cur = aktifler.findIndex(p => p.idx === fromIdx);
  OKState.currentIdx = aktifler[(cur + 1) % aktifler.length].idx;

  broadcastFullOkeyStateFull();
}

// ─── AÇILIŞ ──────────────────────────────────────────────────
/**
 * mod: 'normal' (101 açma) veya 'cifte' (çifte açma)
 */
function applyOkeyAcFull(fromIdx, gruplar, mod) {
  if (!isHost) return;
  if (OKState.opened[fromIdx] || OKState.cifteActi[fromIdx]) {
    _okeyAcResult(fromIdx, false, 'Zaten açıldın!');
    return;
  }

  // Grupları validate et
  if (mod === 'cifte') {
    if (!okCifteAcilisGecerliMi(gruplar)) {
      _okeyAcResult(fromIdx, false, `Çifte açmak için en az ${OKEY_CFG.cifteMinCift} çift gerekli!`);
      return;
    }
    OKState.cifteActi[fromIdx] = true;
  } else {
    if (!okYuzBirAcabilirMi(gruplar)) {
      const puan = okAcilisPuaniHesapla(gruplar);
      _okeyAcResult(fromIdx, false, `Açılış puanı yetersiz: ${puan} (gereken: 101)`);
      return;
    }
    OKState.opened[fromIdx] = true;
  }

  // Açılan taşları elden çıkar
  const acikTasIds = new Set(gruplar.flat().map(t => t.id));
  OKState.hands[fromIdx] = OKState.hands[fromIdx].filter(t => !acikTasIds.has(t.id));
  OKState.handCounts[fromIdx] = OKState.hands[fromIdx].length;

  // Masaya ekle
  OKState.masa.push({ oyuncuIdx: fromIdx, gruplar });

  const p = players.find(x => x.idx === fromIdx);
  const etiket = mod === 'cifte' ? 'Çifte açtı!' : `Açıldı! (${okAcilisPuaniHesapla(gruplar)} puan)`;
  addSys('okey', `${p?.name || '?'}: ${etiket}`);
  _okeyAcResult(fromIdx, true, '');
  broadcastFullOkeyStateFull();
}

function _okeyAcResult(fromIdx, ok, reason) {
  if (fromIdx === myIdx) {
    if (!ok) toast(reason);
  } else {
    const conn = hostConns[fromIdx - 1];
    if (conn && conn.open) conn.send({ t: 'okey-ac-result', ok, reason });
  }
}

// ─── ⑤ MASAYA İŞLEME ─────────────────────────────────────────
function applyMasayaIsleFull(fromIdx, masaGrupIdx, tileObj) {
  if (!isHost) return;
  const acildi = OKState.opened[fromIdx] || OKState.cifteActi[fromIdx];
  if (!acildi) {
    _okeyAcResult(fromIdx, false, 'Önce açılman gerekiyor!');
    return;
  }

  const masaGrup = OKState.masa[masaGrupIdx];
  if (!masaGrup) return;

  const hand = OKState.hands[fromIdx];
  const tileIdx = hand.findIndex(t => t.id === tileObj.id);
  if (tileIdx < 0) return;

  const tile = hand[tileIdx];
  const cifteAcildi = !!OKState.cifteActi[fromIdx];

  if (!okMasayaEklenebilirMi(masaGrup.gruplar[0], tile, cifteAcildi)) {
    _okeyAcResult(fromIdx, false, 'Bu taş o diziye eklenemiyor!');
    return;
  }

  // Taşı elden çıkar, masaya ekle
  hand.splice(tileIdx, 1);
  masaGrup.gruplar[0].push(tile); // basit tek gruba ekleme
  OKState.handCounts[fromIdx] = hand.length;

  // ④ Yerden alınan taşın kullanım izni ver
  if (OKState.yerdenAlinan[fromIdx]?.id === tile.id) {
    delete OKState.yerdenAlinan[fromIdx];
  }

  broadcastFullOkeyStateFull();
}

// ─── BİTİRME ─────────────────────────────────────────────────
function applyOkeyBitirFull(fromIdx) {
  if (!isHost) return;
  const hand = OKState.hands[fromIdx];
  if (!hand || hand.length !== 1) {
    _okeyAcResult(fromIdx, false, 'Bitirmek için elde 1 taş kalmalı!');
    return;
  }

  const sonTas = hand[0];
  // Son taş ile bitme
  OKState.discard.push(sonTas);
  OKState.hands[fromIdx] = [];
  OKState.handCounts[fromIdx] = 0;
  OKState.finished.push(fromIdx);

  // Okeyle bitme kontrolü
  if (OKEY_CFG.okeyBitmeCezasiVar && okIsJoker(sonTas)) {
    OKState.scores[fromIdx] = (OKState.scores[fromIdx] || 0) + OKEY_CFG.okeyBitmeCeza;
    addSys('okey', 'Okeyle bitti! Özel ceza uygulandı.');
  }

  // ⑥ Puan hesapla ve sonraki tur/oyun sonu
  const yeniPuanlar = okTurSonuPuanGuncelle(fromIdx);
  OKState.scores = yeniPuanlar;

  const p = players.find(x => x.idx === fromIdx);
  addSys('okey', `${p?.name || '?'} bitirdi!`);

  // 101'e ulaşan var mı?
  const elenmiş = players.filter(pl => (OKState.scores[pl.idx] || 0) >= 101);
  if (elenmiş.length > 0) {
    // Oyun bitti — en az puanı olan kazanır
    const sıralı = [...players].sort((a, b) => (OKState.scores[a.idx] || 0) - (OKState.scores[b.idx] || 0));
    const finalKazanan = sıralı[0];
    const rankings = sıralı.map(pl => ({
      name: pl.name,
      info: `${OKState.scores[pl.idx] || 0} puan`
    }));
    broadcastAll({ t: 'okey-gameover', rankings, winnerIdx: finalKazanan.idx, finalScores: OKState.scores });
    gameOver(finalKazanan.idx === myIdx, '', rankings);
    return;
  }

  // Yeni tur başlat
  setTimeout(() => _okeyYeniTur(), 2000);
}

function _okeyYeniTur() {
  if (!isHost) return;
  const savedScores = { ...OKState.scores };
  const savedRound = (OKState.round || 1) + 1;

  let pile = buildOkeyPile();
  const { gosterge, okeyRenk, okeySayi } = okGostergeBelirle(pile);

  // Başlayan bir sonraki oyuncu
  const aktifler = players;
  const prevStartIdx = aktifler.findIndex(p => p.idx === OKState.ilkBaslayan);
  const yeniBaslayan = aktifler[(prevStartIdx + 1) % aktifler.length].idx;

  const eller = okDagit(pile, players, yeniBaslayan);

  OKState = {
    pile, discard: [], hands: eller,
    indicator: gosterge, okeyRenk, okeySayi,
    currentIdx: yeniBaslayan, handCounts: {},
    finished: [], opened: {}, cifteActi: {},
    scores: savedScores, round: savedRound,
    masa: [], yerdenAlinan: {}, drewFlags: {},
    baslayanIlkAtisTamam: false, ilkBaslayan: yeniBaslayan,
  };
  players.forEach(p => { OKState.handCounts[p.idx] = OKState.hands[p.idx].length; });
  addSys('okey', `Tur ${savedRound} başladı!`);
  broadcastFullOkeyStateFull();
}

function _okeyDesteBittiYapistir() {
  // Deste bitti, puana göre bitir
  const enAzPuan = players.reduce((en, p) => {
    const el = OKState.hands[p.idx] || [];
    const acildi = OKState.opened[p.idx] || OKState.cifteActi[p.idx];
    const ceza = okOyuncuCezasi(el, acildi);
    return ceza < en.ceza ? { idx: p.idx, ceza } : en;
  }, { idx: players[0].idx, ceza: Infinity });

  addSys('okey', 'Deste bitti! En az puanlı kazandı.');
  applyOkeyBitirFull(enAzPuan.idx);
}

// ─── CLIENT-SIDE ACTION FONKSİYONLARI ────────────────────────
function okeyDrawFull(source) {
  if (OKState.currentIdx !== myIdx || ODRAWN) return;
  if (isHost) applyOkeyDrawFull(myIdx, source);
  else sendToHost({ t: source === 'pile' ? 'okey-draw-pile-full' : 'okey-draw-discard-full' });
}

function okeyDiscardFull() {
  if (OSEL === null) { toast('Atmak için taş seç!'); return; }
  okeyEnsureSlots();
  const tile = OSLOTS[OSEL];
  if (!tile) { toast('Dolu bir taş seç!'); return; }
  if (!ODRAWN && !(OKState.ilkBaslayan === myIdx && !OKState.baslayanIlkAtisTamam)) {
    toast('Önce taş çek!'); return;
  }
  if (isHost) {
    applyOkeyDiscardFull(myIdx, tile);
    OSLOTS[OSEL] = null; okeySyncHandFromSlots(); OSEL = null; ODRAWN = false; renderOkeyFull();
  } else {
    sendToHost({ t: 'okey-discard-full', tile });
    OSEL = null;
  }
}

/**
 * Açılış: önce oyuncunun gruplarını hesapla, sonra gönder.
 * mod: 'normal' veya 'cifte'
 */
function okeyAcFull(mod) {
  if (!ODRAWN) { toast('Önce taş çek!'); return; }
  // Öneri ile otomatik grup oluştur
  const el = OKState.hands[myIdx] || [];
  let gruplar = null;

  if (mod === 'cifte') {
    if (!okCifteAcabilirMi(el)) {
      toast(`Çifte açmak için en az ${OKEY_CFG.cifteMinCift} çift gerekli! (Elde: ${okCiftSayisi(el)} çift)`);
      return;
    }
    gruplar = _buildCifteGruplar(el);
  } else {
    gruplar = _buildNormalGruplar(el);
    if (!gruplar) { toast('Geçerli grup oluşturulamadı!'); return; }
    const puan = okAcilisPuaniHesapla(gruplar);
    if (puan < 101) { toast(`Açılış puanı yetersiz: ${puan} / 101`); return; }
  }

  if (isHost) applyOkeyAcFull(myIdx, gruplar, mod);
  else sendToHost({ t: 'okey-ac-full', gruplar, mod });
}

function okeyMasayaIsleFull(masaGrupIdx, tile) {
  if (!ODRAWN) { toast('Önce taş çek!'); return; }
  if (isHost) applyMasayaIsleFull(myIdx, masaGrupIdx, tile);
  else sendToHost({ t: 'okey-masaya-isle-full', masaGrupIdx, tile });
}

function okeyBitirFull() {
  if (!ODRAWN) { toast('Önce taş çek!'); return; }
  const hand = OKState.hands[myIdx] || [];
  if (hand.length !== 1) { toast(`Bitirmek için elde 1 taş olmalı! (Şu an: ${hand.length})`); return; }
  if (isHost) applyOkeyBitirFull(myIdx);
  else sendToHost({ t: 'okey-bitir-full' });
}

// ─── GRUP BUILDER YARDIMCILARI ───────────────────────────────
function _buildNormalGruplar(el) {
  const kullanilan = new Set();
  const gruplar = [];

  // Per bul
  const sayiMap = {};
  el.forEach(t => {
    if (okIsJoker(t)) return;
    const k = t.num;
    if (!sayiMap[k]) sayiMap[k] = [];
    sayiMap[k].push(t);
  });
  Object.entries(sayiMap).forEach(([, arr]) => {
    if (arr.length >= 3) {
      const g = arr.slice(0, 4);
      if (okPerGecerliMi(g)) { gruplar.push(g); g.forEach(t => kullanilan.add(t.id)); }
      else if (arr.length >= 3 && okPerGecerliMi(arr.slice(0,3))) {
        gruplar.push(arr.slice(0,3)); arr.slice(0,3).forEach(t => kullanilan.add(t.id));
      }
    }
  });

  // Seri bul
  const renkMap = {};
  el.forEach(t => { if (!okIsJoker(t) && !kullanilan.has(t.id)) { (renkMap[t.col] = renkMap[t.col] || []).push(t); } });
  const jokerler = el.filter(t => okIsJoker(t));
  let kalanJoker = [...jokerler];

  Object.values(renkMap).forEach(arr => {
    arr.sort((a, b) => a.num - b.num);
    let i = 0;
    while (i < arr.length) {
      const seri = [arr[i]];
      while (i + 1 < arr.length && arr[i+1].num === seri[seri.length-1].num + 1) { seri.push(arr[++i]); }
      if (seri.length >= 3) { gruplar.push(seri); seri.forEach(t => kullanilan.add(t.id)); }
      i++;
    }
  });

  return gruplar.length > 0 ? gruplar : null;
}

function _buildCifteGruplar(el) {
  const sayac = {};
  const jokerler = [];
  el.forEach(t => {
    if (okIsJoker(t)) { jokerler.push(t); return; }
    const k = `${t.col}_${t.num}`;
    if (!sayac[k]) sayac[k] = [];
    sayac[k].push(t);
  });
  const gruplar = [];
  let kalanJoker = [...jokerler];
  Object.values(sayac).forEach(arr => {
    if (arr.length >= 2) gruplar.push([arr[0], arr[1]]);
    else if (kalanJoker.length > 0) gruplar.push([arr[0], kalanJoker.shift()]);
  });
  while (kalanJoker.length >= 2) gruplar.push([kalanJoker.shift(), kalanJoker.shift()]);
  return gruplar;
}

// ─── ⑩ RENDER — 101 PUAN BARI + MASA ────────────────────────
function renderOkey101BarFull() {
  const bar = document.getElementById('okey-101-bar');
  if (!bar) return;
  bar.innerHTML = '';
  const target = 101;
  players.forEach(p => {
    const cum = OKState.scores?.[p.idx] || 0;
    const pct = Math.min(100, (cum / target) * 100);
    const danger = pct >= 80 ? '#e74c3c' : pct >= 60 ? '#e67e22' : '#27ae60';
    const isActive = OKState.currentIdx === p.idx;
    const acildi = OKState.opened?.[p.idx] ? 'Açıldı' : OKState.cifteActi?.[p.idx] ? 'Çifte' : '';
    const row = document.createElement('div');
    row.className = 'okey-score-row' + (p.idx === myIdx ? ' me' : '') + (isActive ? ' active' : '');
    row.innerHTML = `
      <div class="okey-score-name">${esc(p.name)}${isActive ? ' ▶' : ''}</div>
      <div class="okey-score-track">
        <div class="okey-score-fill" style="width:${pct.toFixed(1)}%;background:${danger}"></div>
        <div class="okey-score-label">${cum}<span class="okey-score-sub"> / ${target}</span></div>
      </div>
      <div class="okey-score-badge">${acildi}</div>
    `;
    bar.appendChild(row);
  });
}

function renderMasaFull() {
  const el = document.getElementById('okey-masa-area');
  if (!el) return;
  el.innerHTML = '';
  if (!OKState.masa || OKState.masa.length === 0) {
    el.innerHTML = '<div class="okey-masa-empty">Masada henüz açık dizi yok</div>';
    return;
  }
  OKState.masa.forEach((masaGrup, gi) => {
    const p = players.find(x => x.idx === masaGrup.oyuncuIdx);
    const blok = document.createElement('div');
    blok.className = 'okey-masa-blok';
    const baslik = document.createElement('div');
    baslik.className = 'okey-masa-baslik';
    baslik.textContent = p?.name || '?';
    blok.appendChild(baslik);

    masaGrup.gruplar.forEach((grup, ggi) => {
      const grupDiv = document.createElement('div');
      grupDiv.className = 'okey-masa-grup' + (okGrupGecerliMi(grup) ? ' gecerli' : ' gecersiz');
      grup.forEach(t => {
        const td = document.createElement('div');
        td.className = 'otile mini';
        const s = okTileStyle(t);
        td.style.background = s.bg;
        if (s.border) td.style.border = s.border;
        td.innerHTML = `<span style="color:${s.col}">${okTileLabel(t)}</span>`;
        // İşleme: tıkla → bu diziye seçili taşı ekle
        if (OSEL !== null && OSLOTS?.[OSEL]) {
          td.classList.add('isle-hedef');
          td.title = 'Bu diziye taş işle';
          td.addEventListener('click', () => okeyMasayaIsleFull(gi, OSLOTS[OSEL]));
        }
        grupDiv.appendChild(td);
      });
      blok.appendChild(grupDiv);
    });
    el.appendChild(blok);
  });
}

function renderOkeyFull() {
  // Indicator
  const ind = document.getElementById('okey-ind');
  if (ind && OKState.indicator) {
    const s = okTileStyle(OKState.indicator);
    ind.style.background = s.bg;
    ind.style.color = s.col;
    ind.textContent = okTileLabel(OKState.indicator);
    ind.title = `Okey: ${OKState.okeyRenk} ${OKState.okeySayi}`;
  }

  // Pile & discard
  const pc = OKState.pileSize !== undefined ? OKState.pileSize : OKState.pile?.length || 0;
  const pileCnt = document.getElementById('okey-pilecnt');
  if (pileCnt) pileCnt.textContent = pc + ' taş';

  const discCnt = document.getElementById('okey-disccnt');
  const discTop = document.getElementById('okey-disctp');
  if (discCnt) discCnt.textContent = (OKState.discard?.length || 0) + ' taş';
  if (discTop && OKState.discard?.length > 0) {
    const top = OKState.discard[OKState.discard.length - 1];
    const s = okTileStyle(top);
    discTop.style.background = s.bg;
    discTop.style.color = s.col;
    if (s.border) discTop.style.border = s.border;
    discTop.textContent = okTileLabel(top);
  }

  // Rakipler
  const oppArea = document.getElementById('okey-opponents');
  if (oppArea) {
    oppArea.innerHTML = '';
    const relPos = ['pos-left', 'pos-top', 'pos-right'];
    players.filter(p => p.idx !== myIdx).forEach((p, i) => {
      const cnt = isHost ? OKState.hands[p.idx]?.length : OKState.handCounts?.[p.idx] || 0;
      const isActive = OKState.currentIdx === p.idx;
      const pScore = OKState.scores?.[p.idx] || 0;
      const acildi = OKState.opened?.[p.idx] ? '✓' : OKState.cifteActi?.[p.idx] ? '2x' : '';
      const div = document.createElement('div');
      div.className = 'okey-opp-area ' + (relPos[i] || '') + (isActive ? ' active-player' : '');
      div.innerHTML = `<div class="okey-opp-name">${esc(p.name)} <span class="okey-opp-score">${pScore}p</span>${acildi ? `<span class="okey-opp-badge">${acildi}</span>` : ''}</div><div class="okey-opp-tiles"></div>`;
      const tilesDiv = div.querySelector('.okey-opp-tiles');
      for (let j = 0; j < Math.min(cnt || 0, 22); j++) {
        const tb = document.createElement('div'); tb.className = 'otb'; tilesDiv.appendChild(tb);
      }
      oppArea.appendChild(div);
    });
  }

  // Raf render (mevcut OSLOTS sistemi korunur)
  const myHand = OKState.hands?.[myIdx] || [];
  okeyEnsureSlots();
  const mr = document.getElementById('okey-myr');
  if (mr) {
    mr.innerHTML = '';
    const topRow = document.createElement('div'); topRow.className = 'orack-row'; topRow.dataset.rowIndex = '0';
    const bottomRow = document.createElement('div'); bottomRow.className = 'orack-row'; bottomRow.dataset.rowIndex = '1';
    topRow.addEventListener('dragover', okeyDragOver); bottomRow.addEventListener('dragover', okeyDragOver);
    topRow.addEventListener('dragleave', okeyDragLeave); bottomRow.addEventListener('dragleave', okeyDragLeave);
    topRow.addEventListener('drop', ev => okeyDropOnRow(ev, 0));
    bottomRow.addEventListener('drop', ev => okeyDropOnRow(ev, 1));

    const slotCount = Math.max(30, OSLOTS.length);
    for (let i = 0; i < slotCount; i++) {
      const t = OSLOTS[i] || null;
      const el2 = document.createElement('div');
      el2.dataset.slot = String(i);
      if (!t) {
        el2.className = 'otile empty';
        el2.addEventListener('dragover', okeyDragOver);
        el2.addEventListener('dragleave', okeyDragLeave);
        el2.addEventListener('drop', ev => { ev.stopPropagation(); okeyDropTile(ev, i); });
        el2.addEventListener('click', () => { OSEL = null; renderOkeyFull(); });
      } else {
        const s = okTileStyle(t);
        el2.className = 'otile' + (i === OSEL ? ' osel' : '') + (t.sahteOkey ? ' sahte-okey' : '') + (okIsJoker(t) ? ' ojok' : '');
        el2.style.background = s.bg;
        if (s.border) el2.style.border = s.border;
        el2.draggable = true;
        const label = okTileLabel(t);
        const subLabel = t.sahteOkey ? 'SJ' : (okIsJoker(t) ? 'OK' : O_EMOJI[t.col] || '');
        el2.innerHTML = `<div class="tnum" style="color:${s.col}">${label}</div><div class="tcol" style="color:${s.col}">${subLabel}</div>`;
        el2.addEventListener('dragstart', ev => okeyDragStart(ev, i));
        el2.addEventListener('dragend', okeyDragEnd);
        el2.addEventListener('dragover', okeyDragOver);
        el2.addEventListener('dragleave', okeyDragLeave);
        el2.addEventListener('drop', ev => { ev.stopPropagation(); okeyDropTile(ev, i); });
        el2.addEventListener('pointerdown', ev => okeyPointerDown(ev, i), { passive: false });
      }
      (i < 15 ? topRow : bottomRow).appendChild(el2);
    }
    mr.appendChild(topRow);
    mr.appendChild(bottomRow);
  }

  // ② Açılış puan sayacı
  const puanEl = document.getElementById('okey-acilis-puan');
  if (puanEl) {
    const acilisGruplar = _buildNormalGruplar(myHand);
    const puan = acilisGruplar ? okAcilisPuaniHesapla(acilisGruplar) : 0;
    puanEl.textContent = puan + ' / 101';
    puanEl.style.color = puan >= 101 ? '#27ae60' : '#e74c3c';
  }

  // Çift sayacı
  const ciftEl = document.getElementById('okey-cift-sayac');
  if (ciftEl) {
    const cift = okCiftSayisi(myHand);
    ciftEl.textContent = cift + ' çift';
    ciftEl.style.color = cift >= OKEY_CFG.cifteMinCift ? '#27ae60' : '#e67e22';
  }

  // Buton durumları
  const isMyTurn = OKState.currentIdx === myIdx;
  const zatenAcildi = OKState.opened?.[myIdx] || OKState.cifteActi?.[myIdx];
  const baslayanIlkTur = OKState.ilkBaslayan === myIdx && !OKState.baslayanIlkAtisTamam;

  const discBtn = document.getElementById('okey-discbtn');
  const bitirBtn = document.getElementById('okey-declbtn');
  const acBtn = document.getElementById('okey-openbtn');
  const cifteBtn = document.getElementById('okey-cifte-btn');

  if (discBtn) discBtn.disabled = !isMyTurn || (!ODRAWN && !baslayanIlkTur);
  if (bitirBtn) bitirBtn.disabled = !isMyTurn || !ODRAWN || (myHand.length !== 1);
  if (acBtn) {
    const acilisPuan = (() => { const g = _buildNormalGruplar(myHand); return g ? okAcilisPuaniHesapla(g) : 0; })();
    acBtn.disabled = !isMyTurn || !ODRAWN || zatenAcildi || acilisPuan < 101;
    acBtn.title = `Açılış puanı: ${acilisPuan} / 101`;
  }
  if (cifteBtn) {
    const cift = okCiftSayisi(myHand);
    cifteBtn.disabled = !isMyTurn || !ODRAWN || zatenAcildi || cift < OKEY_CFG.cifteMinCift;
    cifteBtn.title = `Çift: ${cift} / ${OKEY_CFG.cifteMinCift}`;
  }

  // Durum metni
  const stateEl = document.getElementById('okey-open-state');
  if (stateEl) {
    if (OKState.cifteActi?.[myIdx]) stateEl.innerHTML = 'Çifte açıldı <span class="okey-open-badge">2x</span>';
    else if (OKState.opened?.[myIdx]) stateEl.innerHTML = 'El açık <span class="okey-open-badge">101</span>';
    else stateEl.textContent = 'Henüz el açılmadı';
  }

  // ⑩ 101 puan barı
  renderOkey101BarFull();
  // ⑤ Masa
  renderMasaFull();
}

function updateOkeyTurnFull() {
  const el = document.getElementById('okey-turn');
  if (!el) return;
  const isMyTurn = OKState.currentIdx === myIdx;
  const round = OKState.round || 1;
  const baslayanIlkTur = OKState.ilkBaslayan === myIdx && !OKState.baslayanIlkAtisTamam;

  if (baslayanIlkTur) {
    el.textContent = `▶ Senin sıran — Bir taş at! (Başlayan, Tur ${round})`;
    el.className = 'turnbar my';
  } else if (isMyTurn) {
    el.textContent = `▶ Senin sıran — Taş çek! (Tur ${round})`;
    el.className = 'turnbar my';
  } else {
    const p = players.find(p => p.idx === OKState.currentIdx);
    el.textContent = `${p?.name || '?'} oynuyor... (Tur ${round})`;
    el.className = 'turnbar opp';
  }
}

// ─── CSS EKİ ─────────────────────────────────────────────────
// Aşağıdaki CSS bloğunu okey <style> bölümüne ekle:
const OKEY_FULL_CSS = `
/* 101 Puan barı */
.okey-score-panel{margin:6px 0;background:rgba(0,0,0,0.12);border-radius:8px;padding:6px 8px;}
.okey-score-panel-title{font-size:0.6rem;font-weight:700;letter-spacing:.06em;opacity:.6;margin-bottom:4px;}
.okey-score-row{display:flex;align-items:center;gap:6px;margin:3px 0;padding:3px 4px;border-radius:5px;}
.okey-score-row.me{background:rgba(255,255,255,0.1);}
.okey-score-row.active{outline:1px solid rgba(255,255,255,0.3);}
.okey-score-name{width:64px;font-size:0.6rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.okey-score-track{flex:1;position:relative;height:13px;background:rgba(0,0,0,0.25);border-radius:7px;overflow:hidden;}
.okey-score-fill{height:100%;border-radius:7px;transition:width .4s ease;}
.okey-score-label{position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:0.58rem;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.6);}
.okey-score-sub{opacity:.7;}
.okey-score-badge{width:24px;font-size:0.55rem;text-align:right;opacity:.75;}
/* Masa */
.okey-masa-area{display:flex;flex-wrap:wrap;gap:6px;min-height:40px;padding:6px;background:rgba(0,0,0,0.1);border-radius:8px;margin:6px 0;}
.okey-masa-empty{font-size:0.6rem;opacity:.5;align-self:center;}
.okey-masa-blok{background:rgba(255,255,255,0.07);border-radius:6px;padding:4px 6px;}
.okey-masa-baslik{font-size:0.55rem;opacity:.6;margin-bottom:3px;}
.okey-masa-grup{display:flex;gap:2px;padding:2px;}
.okey-masa-grup.gecerli{border:1px solid rgba(46,204,113,0.4);border-radius:4px;}
.okey-masa-grup.gecersiz{border:1px solid rgba(231,76,60,0.4);border-radius:4px;}
.okey-masa-grup .otile.mini{width:22px;height:28px;font-size:0.5rem;border-radius:3px;}
/* Sahte okey görsel ayrımı */
.otile.sahte-okey{outline:2px solid #f39c12;outline-offset:-2px;}
/* Açılış puan sayacı */
.okey-acilis-puan{font-size:0.65rem;font-weight:700;transition:color .3s;}
/* Rakip badge */
.okey-opp-badge{margin-left:3px;font-size:0.5rem;background:rgba(46,204,113,0.3);border-radius:3px;padding:1px 3px;}
`;
