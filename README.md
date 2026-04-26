# Oyun Salonu - Modüler Sürüm

Bu paket, tek dosyalık HTML projesinin GitHub Pages'e uygun modüler halidir.

## Klasör Yapısı

```txt
index.html
css/
  style.css
js/
  00-core.js
  01-utils.js
  02-router.js
  03-helpers.js
  04-firebase-auth.js
  05-theme-panel.js
  98-enhancements.js
  99-card-assets.js
  games/
    dama.js
    chess.js
    tavla.js
    uno.js
    okey.js
    sudoku.js
    asmaca.js
    amiral.js
    sos.js
assets/
  uno/
  okey/
```

## Yayınlama

1. GitHub'da yeni repository oluştur.
2. Bu klasördeki `index.html`, `css`, `js`, `assets` ve `README.md` dosyalarını repo köküne yükle.
3. Repository içinde `Settings > Pages` bölümüne gir.
4. `Build and deployment` altında `Deploy from a branch` seç.
5. Branch: `main`, Folder: `/root` seç.
6. `Save` butonuna bas.
7. GitHub Pages linki birkaç dakika içinde oluşur.

## Notlar

- `index.html` repo kökünde kalmalı.
- Firebase kullanıyorsan Firebase Console > Authentication > Settings > Authorized domains kısmına GitHub Pages domainini ekle.
- Realtime Database kurallarını kontrol et.
