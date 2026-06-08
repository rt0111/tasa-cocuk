# 🐺 TASA ÇOCUK

Gerçek zamanlı, çok oyunculu, web tabanlı **sosyal çıkarım oyunu** (Werewolf/Mafya türü).
Köylü vs Kurt Adam vs Solo Katiller. Tek doğru kaynak sunucudur — roller ve gece
sonuçları yalnızca ilgili oyuncuya gönderilir (hile koruması).

## Mimari

```
client/   React + Vite + Tailwind  (mobil uyumlu arayüz)
server/   Node + Express + Socket.io (oyun motoru, tek doğru kaynak)
```

- **Gerçek zamanlı:** Socket.io (WebSocket). HTTP polling yok.
- **Durum:** Oyun durumu sunucu hafızasında (in-memory). Reconnect destekli.
- **Güvenlik:** Her oyuncuya yalnızca kendi rolü/bilgisi gider.

## Kurulum

```powershell
npm run install:all
```

## Çalıştırma

İki ayrı terminalde:

```powershell
# 1) Sunucu (port 3001)
npm run server

# 2) İstemci (port 5173)
npm run client
```

Tarayıcıda `http://localhost:5173` aç. Aynı ağdaki telefonlardan da
`http://<bilgisayar-ip>:5173` ile katılınabilir (Vite host açık).

> İstemci, sunucuya `http://<aynı-host>:3001` üzerinden bağlanır.
> Farklı bir sunucu adresi için `client` ortamında `VITE_SERVER_URL` ayarla.

## Test

Uçtan uca akış simülasyonu (sunucu açıkken):

```powershell
npm test
```

## Oynanış

1. **Oda Kur** → 6 haneli davet kodu üretilir, kuran kişi **admin** olur.
2. Diğerleri **Odaya Katıl** ile kod + takma ad girer (lobi canlı güncellenir).
3. Admin lobide **rolleri seçer** (adet ayarlar), **ayarları** (faz süreleri vb.)
   yapar — rol sayısı = oyuncu sayısı olmalı (denge yardımcısı uyarır).
4. **Oyunu Başlat** → herkese gizlice rolü gösterilir.
5. **Gece → Gündüz → Oylama** döngüsü; bir takım kazanana kadar.

## Roller

Promptaki tüm roller `server/roles.js` içinde tanımlı: Köylü takımı (Kahin, Doktor,
Cadı, Hapishaneci, Belediye Başkanı…), Kurt takımı (Alfa, Kabus, Vudu…), Solo
Katiller (Seri Katil, Kundakçı, Bombacı…), Solo Oylama (Deli, Kelle Avcısı,
Anarşist, Kumarbaz) ve Manipülatif.

## Gece çözümleme sırası (önemli)

`server/game.js → resolveNight()` Bölüm 6'daki öncelik sırasını uygular:
1. Engelleme/susturma → 2. Korumalar → 3. Bilgi rolleri → 4. Öldürme →
5. Kurtarma → 6. Ölüm tetikleyicileri → 7. Kazanma kontrolü.

## Yeni site/rol eklemek

Yeni rol = `server/roles.js` içine bir kayıt + (gerekirse) `resolveNight` içinde
bir `case`. Arayüz, rol meta verisinden panelleri otomatik üretir.
