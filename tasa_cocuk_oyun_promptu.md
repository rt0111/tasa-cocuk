# TASA ÇOCUK — Çok Oyunculu Sosyal Çıkarım Oyunu (Build Promptu)

Sen kıdemli bir full-stack oyun geliştiricisisin. Aşağıda tarif edilen **gerçek zamanlı, çok oyunculu, web tabanlı sosyal çıkarım oyununu** (Werewolf/Mafya türü) sıfırdan, çalışır ve dağıtılabilir şekilde geliştir. Adım adım ilerle; her adımı tamamlamadan sonrakine geçme ve her adımın sonunda ne yaptığını kısaca özetle.

---

## 1. GENEL KONSEPT

- Oyunun adı: **TASA ÇOCUK**
- Tür: Köylü vs Kurt Adam vs Solo katiller (gizli rol, sosyal çıkarım)
- Oyun döngüsü: **Gece → Gündüz → Oylama → (tekrar)**, bir takım kazanana kadar.
- Gece: roller gizli yeteneklerini kullanır.
- Gündüz: oyuncular konuşur ve oylama ile birini linç eder.
- Bir kişi **oda kurar (admin/moderatör olur)**, diğerleri **davet koduyla** odaya katılır.
- Admin, oyun başlamadan önce hangi rollerin oyunda olacağını seçer ve oyunu başlatır.

---

## 2. TEKNİK GEREKSİNİMLER

- **Gerçek zamanlı iletişim** zorunlu (WebSocket / Socket.io tercih et). HTTP polling kullanma.
- Önerilen stack: Frontend **React + Tailwind**, Backend **Node.js + Express + Socket.io**, durum yönetimi sunucu tarafında (oyunun "tek doğru kaynağı" sunucu olmalı — client'a güvenme).
- Tüm gizli bilgiler (roller, gece sonuçları) **yalnızca ilgili oyuncuya** gönderilmeli. Asla tüm rolleri tüm client'lara yollama (kopya/hile engellenmeli).
- Mobil uyumlu (responsive) tasarım. Çoğu oyuncu telefondan girecek.
- Oyun durumu sunucuda hafızada (in-memory) tutulabilir; istersen kalıcılık için basit bir store ekle.
- Türkçe arayüz.

---

## 3. KULLANICI AKIŞI (UI/UX)

1. **Giriş ekranı:** Kullanıcı bir takma ad (nickname) girer. "Oda Kur" veya "Odaya Katıl" seçenekleri.
2. **Oda kurma:** Oda kuran kişi otomatik **admin** olur. 6 haneli benzersiz **davet kodu** üretilir.
3. **Odaya katılma:** Davet kodu + takma ad ile girilir.
4. **Lobi (bekleme odası):** Katılan oyuncular listelenir (canlı güncellenir). Admin burada:
   - Oyundaki rolleri seçer (aşağıdaki rol listesinden, sayı belirleyerek),
   - Toplam rol sayısının oyuncu sayısına eşit olduğunu kontrol eder (uyuşmazlıkta uyarı verir),
   - Ayarları yapar (faz süreleri, ölü sohbeti açık/kapalı vb.),
   - "Oyunu Başlat" butonuna basar.
5. **Rol dağıtımı:** Her oyuncuya **yalnızca kendi rolü** özel olarak gösterilir (rol kartı + açıklama + takım).
6. **Gece fazı:** Yeteneği olan roller, kendilerine özel arayüzden hedef seçer. Zamanlayıcı (timer) çalışır.
7. **Gündüz fazı:** Gece sonuçları açıklanır (kim öldü/kurtuldu, açık bilgi varsa). Sohbet açılır, oyuncular tartışır.
8. **Oylama fazı:** Oyuncular bir kişiye oy verir. Süre dolunca veya herkes oy verince linç çözülür.
9. **Kazanma kontrolü:** Her faz sonunda kazanma şartları kontrol edilir. Şart sağlanırsa oyun biter, kazanan takım/oyuncu açıklanır.

---

## 4. ADMIN / MODERATÖR ÖZELLİKLERİ

- Lobide rolleri seç/kaldır ve adetlerini ayarla.
- Faz sürelerini ayarla (örn. gece 45 sn, tartışma 120 sn, oylama 30 sn).
- Oyunu başlat / durdur / yeniden başlat.
- Bir oyuncuyu odadan atabilme.
- (Opsiyonel) Admin oyuna oyuncu olarak da katılabilsin mi, yoksa sadece yönetsin mi — seçilebilir olsun.
- Bir oyuncu bağlantısı koparsa AI'ın botla doldurmaması; "bağlantı koptu" göstermesi ve geri dönünce eski rolüne devam ettirmesi (reconnect ile session yeniden eşleşmeli).

---

## 5. ROLLER

Her rol için: **takımı, ne zaman aktif olduğu (gece/gündüz), yeteneği ve hedef sayısı** açık tanımlanmalı. Admin lobideki listeden istediği rolleri seçebilmeli.

### 5.1 KÖYLÜ TAKIMI
> Kazanma şartı: Tüm kurtların ve tüm solo katillerin ölmesi.

- **Köylü (Villager):** Özel gücü yok. Sadece gündüz konuşur ve oy verir.
- **Kahin (Seer):** Her gece bir oyuncunun **tam rolünü** öğrenir.
- **Aura Kahini (Aura Seer):** Bir oyuncunun aurasını görür: İyi / Kötü / Bilinmeyen. (Kurtlar ve bazı solo roller "Kötü" çıkar.)
- **Şerif (Sheriff):** Bir oyuncunun şüpheli (kurt) olup olmadığını kontrol eder. Bazı roller şerifi yanıltabilir.
- **Dedektif (Detective):** Her gece iki kişi seçer; aynı takımda olup olmadıklarını öğrenir.
- **Doktor (Doctor):** Her gece bir kişiyi korur, kurt saldırısını engeller. (Kendini koruma hakkı sınırlı olsun: örn. tüm oyunda en fazla 1 kez.)
- **Koruma (Bodyguard):** Koruduğu kişiye saldırı gelirse onun yerine ölür ve saldırı engellenir.
- **Sert Adam (Tough Guy):** Koruduğu kişiye saldıran kişinin rolünü öğrenir, ancak ertesi gece kendisi ölür.
- **Cadı (Witch):** İki iksiri vardır (her biri 1 kez): **Can İksiri** (ölmek üzere olan birini kurtarır), **Zehir İksiri** (bir kişiyi öldürür).
- **Hapishaneci (Jailer):** Her gece bir oyuncuyu hapseder; hapsedilen kişi o gece yeteneğini kullanamaz. İsterse hapsedilen kişiyi öldürebilir.
- **Belediye Başkanı (Mayor):** Oylamada oyu **2 oy** sayılır.
- **Rahip (Priest):** Kötü rollere karşı etkilidir; seçtiği bir kötü rolü öldürebilir veya etkisiz hale getirebilir (kullanımı sınırlı olsun).
- **Silahlı Köylü (Gunner):** Gündüz bir kez ateş edip bir oyuncuyu vurabilir. Yanlış kişiyi vurursa köye zarar verir (mermisi sınırlı, örn. 2 mermi).
- **Keskin Nişancı (Marksman):** Bir gece hedef belirler, **sonraki gece** o hedefi vurur.
- **Medyum (Medium):** Ölü oyuncularla iletişim kurabilir; ölülerden bilgi alır.
- **Çiçek Çocuk (Flower Child):** Bir kişinin **asılmasını (linç edilmesini) engelleyebilir** (sınırlı kullanım).
- **Barışçıl (Pacifist):** Gün içindeki oylamayı durdurabilir (o gün kimse asılmaz) — sınırlı kullanım.

### 5.2 KURT ADAM TAKIMI
> Kazanma şartı: Kurt sayısı köylü sayısına eşit/üstün olunca ve tüm solo katiller öldüğünde.
> Kurtlar gece **ortak bir sohbette** birbirini görür ve ortak hedef seçer.

- **Kurt Adam (Werewolf):** Temel kurt. Her gece ekibiyle ortak bir hedef seçer.
- **Kurt Kahini (Wolf Seer):** Gece oyuncular hakkında bilgi toplar (Kahin'in kurt versiyonu).
- **Alfa Kurt (Alpha Werewolf):** Bazı korumaları (örn. Doktor/Koruma) aşabilen güçlü saldırı yapar.
- **Kabus Kurdu (Nightmare Wolf):** Seçtiği hedefi susturur; o kişi yeteneğini/konuşmasını kullanamaz.
- **Koruyucu Kurt (Guardian Wolf):** Kurt takımındaki bir oyuncuyu o gece korur.
- **Gölge Kurdu (Shadow Wolf):** Oylamaları etkiler (örn. bir oyuncunun oyunu gizlice değiştirir/iptal eder) — kurtlara gündüz avantajı sağlar.
- **Vudu Kurdu (Voodoo Wolf):** Bir oyuncuyu susturur; o kişi **ertesi gün** konuşamaz.
- **Kurt Şamanı (Wolf Shaman):** Oyuncular hakkında ek bilgi toplar; kurt takımının bilgi kaynağıdır.
- **Genç Kurt (Junior Werewolf):** Öldüğünde takımına avantaj sağlar (örn. ölürken bir hedef işaretler; o hedef sonraki gece otomatik ölür).

### 5.3 SOLO KATİLLER
> Her biri **tek başına** kazanır. Kazanma şartı: hayatta kalan tek "tehdit" olmak (genelde 1'e 1 kalana kadar herkesi elemek).

- **Seri Katil (Serial Killer):** Her gece bir kişiyi öldürür. **Kurtlar tarafından öldürülemez** (kurt saldırısına bağışık).
- **Kundakçı (Arsonist):** Geceleri oyuncuların üzerine benzin döker (işaretler); istediği bir gece "Yak" derse benzinli tüm oyuncular aynı anda ölür.
- **Bombacı (Bomber):** Bir oyuncuya bomba yerleştirir, sonraki gece patlatır; aynı anda birden fazla kişiyi öldürebilir (örn. hedef + komşuları).
- **Yozlaştırıcı (Corruptor):** Seçtiği hedef o gün konuşamaz ve oy kullanamaz; gün sonunda ölür.
- **Yamyam (Cannibal):** Öldürme hakkı biriktirir; biriktirdikten sonra bir gece toplu katliam yapabilir.
- **Haydut (Bandit):** Bir oyuncuyu yardımcısı yapabilir (kendi solo takımını büyütür).
- **İllüzyonist (Illusionist):** Bilgi rollerini (Kahin, Şerif vb.) yanıltır; yanlış sonuç görmelerini sağlar.

### 5.4 SOLO OYLAMA ROLLERİ
> Bunlar gündüz/oylama üzerinden kazanır.

- **Deli (Fool):** Amacı kendini astırmak. Köy onu linç ederse **anında oyunu kazanır**.
- **Kelle Avcısı (Headhunter):** Oyun başında bir hedef atanır. O hedef **linç edilirse** kazanır.
- **Anarşist (Anarchist):** Köyün belirli sayıda gün üst üste kimseyi asmamasını (örn. 3 gün) sağlarsa kazanır.

### 5.5 YENİ EKLENEN ROLLER
- **Kumarbaz (Gambler):** Her gece bir oyuncu seçer. Ölmeden **3 gece üst üste aynı takımdan** oyuncu seçmeyi başarırsa **anında oyunu kazanır** (solo kazanır). Araya farklı takımdan biri girerse sayaç sıfırlanır.
- **Manipülatif (Manipulator):** Oyun boyunca **yalnızca 1 kez**, oylamada seçtiği bir oyuncunun oyunu **+2** saydırır (yani o oyuncunun oyu 3 oy değerinde olur). Tercihen köylü tarafında bir destek rolü olarak konumlandır; admin isterse takım atamasını ayarlayabilsin.

---

## 6. GECE EYLEM ÇÖZÜMLEME SIRASI (ÇOK ÖNEMLİ)

Aynı gece birden çok rol aksiyon yaptığında çakışmaları önlemek için eylemleri **şu öncelik sırasıyla** çöz. Tüm hedefler önce toplanır, sonra bu sırayla uygulanır:

1. **Engelleme / susturma:** Hapishaneci (hapsetme), Kabus Kurdu, Vudu Kurdu, Yozlaştırıcı. (Engellenen kişinin o geceki aksiyonu iptal olur.)
2. **Korumalar:** Doktor, Koruma, Sert Adam, Koruyucu Kurt, Çiçek Çocuk işaretlemesi.
3. **Bilgi rolleri:** Kahin, Aura Kahini, Şerif, Dedektif, Kurt Kahini, Kurt Şamanı (sonuçları bu anda hesapla; İllüzyonist bunları çarpıtabilir).
4. **Öldürme aksiyonları:** Kurt saldırısı, Alfa Kurt (korumayı aşar), Seri Katil, Cadı zehri, Bombacı patlatma, Kundakçı yakma, Keskin Nişancı, Hapishaneci infazı, Genç Kurt ölüm tetiklemesi.
5. **Kurtarma:** Cadı can iksiri ve diğer korumalar öldürme sonuçlarını iptal edebilir.
6. **Ölüm tetikleyicileri:** Sert Adam (saldıranın rolünü öğrenir, sonra ölür), Koruma (yerine ölür), Genç Kurt ölüm avantajı.
7. **Kazanma kontrolü.**

Kurallar:
- Bir oyuncu hem korunup hem öldürülürse, koruma kazanır (Alfa Kurt istisnası hariç).
- Seri Katil kurt saldırısından etkilenmez.
- Engellenen rol bilgi alamaz / öldüremez.

---

## 7. GÜNDÜZ & OYLAMA MEKANİĞİ

- Gündüz başında gece olayları **anonim olarak** açıklanır (örn. "X bu gece öldürüldü" — saldıran rol gösterilmez, açık bilgi rolleri hariç).
- Tartışma süresi (sohbet) → sonra oylama fazı.
- Her canlı oyuncu **1 oy** verir. Belediye Başkanı 2 oy, Manipülatif'in güçlendirdiği kişi +2 (yani 3) sayılır.
- **Beraberlik:** Eşit oy alırsa o gün **kimse asılmaz** (veya admin ayarına göre rastgele/yeniden oylama seçeneği sun).
- Çiçek Çocuk / Barışçıl / Pacifist linç engelleme yetenekleri oylama sonucundan **önce** uygulanır.
- Linç edilen oyuncunun rolü açıklanır (admin ayarıyla gizli de tutulabilir).
- Linç sonrası anında kazanma kontrolü yapılır (örn. Deli asıldıysa Deli kazanır).

---

## 8. ÖLÜ OYUNCULAR & SOHBET

- Ölen oyuncular oyundan çıkmaz, **izleyici (ghost) moduna** geçer; oynanışı izleyebilir.
- Ölü sohbeti ayrı bir kanal olsun (canlı oyuncular göremez). Admin açıp kapatabilsin.
- Medyum, ölülerle iletişim kurabildiği için bu kanala erişebilir.
- Ölü oyuncular oy veremez ve gece aksiyonu yapamaz.

---

## 9. KAZANMA ŞARTLARI (ÖZET TABLO MANTIĞI)

Her faz sonunda şu sırayla kontrol et:
1. Solo oylama rolleri (Deli asıldı mı, Kelle Avcısı hedefi asıldı mı, Anarşist şartı doldu mu, Kumarbaz 3 seriyi tamamladı mı).
2. Solo katil tek başına hayatta kalan tehdit mi (genelde 1v1).
3. Kurt sayısı ≥ köylü sayısı **ve** solo katil kalmadı mı → Kurtlar kazanır.
4. Tüm kurtlar ve solo katiller öldü mü → Köylüler kazanır.

Birden fazla şart aynı anda sağlanırsa öncelik sırası: **Solo oylama rolleri > Solo katiller > Kurtlar > Köylüler.**

---

## 10. EK İSTENENLER (KALİTE)

- **Oyun günlüğü (log):** Her gece/gündüz olayını sunucu tarafında kaydet; oyun sonunda "olay özeti" göster.
- **Zamanlayıcılar:** Her faz için görsel geri sayım.
- **Bağlantı kopması:** Reconnect desteği (aynı oyuncu geri gelince rolüne devam eder).
- **Hile koruması:** Roller ve gece sonuçları yalnızca ilgili oyuncuya gönderilir.
- **Denge yardımcısı:** Lobide admin'e öneri göster (örn. oyuncu sayısına göre tavsiye edilen kurt sayısı: ~%25-30). Rol sayısı ≠ oyuncu sayısı ise başlatmayı engelle.
- **Temiz, modern, mobil uyumlu arayüz**; gece/gündüz için farklı tema renkleri.
- Türkçe metinler, anlaşılır rol kartları.

---

## 11. GELİŞTİRME SIRASI (BU ADIMLARLA İLERLE)

1. Proje iskeleti + sunucu/istemci bağlantısı (Socket.io çalışıyor mu test et).
2. Oda kurma + davet kodu + lobi (oyuncular canlı listeleniyor).
3. Admin rol seçimi + ayarlar + başlatma + rol dağıtımı (gizli).
4. Faz döngüsü iskeleti (gece→gündüz→oylama→tekrar) + zamanlayıcılar.
5. Gece aksiyon arayüzleri (her rol için) + **Bölüm 6'daki çözümleme sırası**.
6. Gündüz açıklamaları + sohbet + oylama mekaniği.
7. Kazanma şartı kontrolleri + oyun sonu ekranı.
8. Ölü modu, ölü sohbeti, log, reconnect, denge yardımcısı.
9. Mobil uyumlu UI cilası + test.

Her adımı tamamlayınca çalışır halde göster, sonra bir sonrakine geç.
