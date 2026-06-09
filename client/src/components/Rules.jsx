// Tüm oyun kuralları — tek ekranda. Home ve oyun içinden açılır.
const SECTIONS = [
  {
    title: "🎯 Genel Oyun Kuralları",
    rules: [
      "Oyun gece ve gündüz fazlarından oluşur.",
      "Gece oyuncular rol yeteneklerini kullanır.",
      "Gündüz oyuncular tartışır ve oylama yapar.",
      "Ölü oyuncular oyuna müdahale edemez (oy ve yetenek kullanamaz).",
      "Her oyuncunun yalnızca bir rolü vardır ve sadece kendi rolünü bilir.",
      "Başlangıçta seçili rol sayısı oyuncu sayısından fazla olabilir (Gizli Rol Havuzu).",
      "Oyun başlayınca sistem seçili roller arasından rastgele dağıtır; kullanılmayan roller gizli kalır.",
      "Oyunda mutlaka en az bir Kurt Adam bulunur.",
      "Köylüler takım arkadaşlarını bilmez; Kurtlar oyun başında birbirini görür.",
      "Aynı gece bir oyuncu birden fazla kez öldürülemez.",
      "Bir oyuncu aynı gece hem korunup hem hedef alınabilir; etkiler öncelik sırasına göre çözülür.",
    ],
  },
  {
    title: "🌙 Gece Çözümleme Sırası",
    rules: [
      "1) Engelleme / susturma (Hapishaneci, Kabus Kurdu, Vudu Kurdu, Yozlaştırıcı).",
      "2) Korumalar (Doktor, Koruma, Sert Adam, Koruyucu Kurt, Çiçek Çocuk işareti).",
      "3) Bilgi rolleri (Kahin, Aura Kahini, Şerif, Dedektif… — sonuç anında verilir).",
      "4) Öldürmeler (Kurt saldırısı, Seri Katil, Cadı zehri, Silahlı Köylü, Bombacı…).",
      "5) Kurtarmalar (Cadı can iksiri ve korumalar öldürmeyi iptal edebilir).",
      "6) Ölüm tetikleyicileri (Koruma yerine ölür, Sert Adam, Genç Kurt).",
      "7) Kazanma kontrolü.",
      "Tüm gece görevliler hamlesini yapınca süre beklenmeden otomatik sonuçlanır.",
    ],
  },
  {
    title: "🏡 Köylü Takımı",
    rules: [
      "Amaç: tüm Kurtları ve düşman solo rolleri ortadan kaldırmak.",
      "Köylüler gündüz oylamaya katılır, birbirini otomatik tanımaz.",
      "Bilgi rolleri gece araştırma yapar; koruma rolleri gece oyuncuları korur.",
    ],
  },
  {
    title: "⚕️ Doktor",
    rules: [
      "Her gece bir oyuncu seçer; seçilen kişi o gece KURT saldırısından korunur.",
      "Doktor yalnızca kurt saldırısını engeller; başka hiçbir saldırıdan korumaz.",
      "Aynı oyuncuyu üst üste iki gece koruyamaz.",
      "Kendini en fazla 1 kez (yalnız kurda karşı) koruyabilir.",
      "Koruma yeteneğini gündüz kullanamaz.",
    ],
  },
  {
    title: "🛡️ Koruma (Bodyguard)",
    rules: [
      "Korunan oyuncuya saldırı gelirse saldırıyı üzerine alır ve o ölür.",
      "Aynı oyuncuyu üst üste iki gece koruyamaz.",
    ],
  },
  {
    title: "🔮 Kahin",
    rules: [
      "Her gece bir oyuncunun rolünü öğrenir.",
      "Kendisine bakamaz.",
      "Sonuçları bazı özel roller (İllüzyonist vb.) yanıltabilir.",
    ],
  },
  {
    title: "🐺 Kurt Takımı",
    rules: [
      "Amaç: kurt sayısını diğer yaşayan oyunculara eşitlemek (veya geçmek).",
      "Kurtlar oyun başında birbirini bilir ve gece sohbet edebilir.",
      "Kurtlar gece ortak bir hedef belirler.",
      "Kurtlar kendi takım arkadaşını öldüremez ve araştırma hedefi seçemez.",
      "Kurtlar gündüz köylü gibi davranabilir, yalan söyleyebilir.",
    ],
  },
  {
    title: "🔪 Solo Roller",
    rules: [
      "Solo roller tek başına kazanır; ne köylü ne kurt takımındadır.",
      "Her birinin kendine ait kazanma koşulu vardır; genelde herkesin ölmesini ister.",
      "Seri Katil: her gece bir kişi öldürür, kurt takımına dahil değildir, kurtlar onu öldüremez.",
      "Kundakçı: gece oyunculara benzin döker, istediği gece hepsini birden yakar.",
      "Deli: linç edilirse anında kazanır. Kelle Avcısı: hedefi linç edilirse kazanır.",
      "Anarşist: köy 3 gün üst üste kimseyi asmazsa kazanır. Kumarbaz: 3 gece üst üste aynı takımı seçerse kazanır.",
    ],
  },
  {
    title: "🗳️ Oylama",
    rules: [
      "Her yaşayan oyuncunun bir oyu vardır.",
      "En fazla oy alan oyuncu idam edilir.",
      "Beraberlikte kimse ölmez.",
      "Bazı roller oylamayı durdurabilir (Barışçıl).",
      "Bazı roller ekstra oy hakkına sahiptir (Belediye Başkanı 2 oy, Manipülatif +2).",
      "Gündüz yalnızca tartışma + oylama yapılır; rol seçimleri yalnızca gece kullanılır.",
    ],
  },
  {
    title: "🏆 Kazanma Şartları",
    rules: [
      "Köylüler: tüm kurtlar ve düşman solo roller öldüğünde kazanır.",
      "Kurtlar: kurt sayısı diğer yaşayan oyunculara eşit/fazla olduğunda (ve solo katil kalmadığında) kazanır.",
      "Solo roller: kendi özel şartları gerçekleştiğinde kazanır.",
      "Öncelik: Solo oylama rolleri > Solo katiller > Kurtlar > Köylüler.",
    ],
  },
];

export default function Rules({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-3 overflow-y-auto" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full my-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 sticky top-0 bg-slate-900">
          <h2 className="text-xl font-black text-white">📜 Oyun Kuralları</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="px-5 py-4 max-h-[78vh] overflow-y-auto space-y-5">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="font-bold text-indigo-300 mb-2">{s.title}</h3>
              <ul className="space-y-1.5">
                {s.rules.map((r, i) => (
                  <li key={i} className="text-sm text-slate-200 flex gap-2 leading-snug">
                    <span className="text-indigo-400 mt-0.5">•</span><span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
