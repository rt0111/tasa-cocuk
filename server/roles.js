// TASA ÇOCUK - Rol kayıt defteri (Bölüm 5)
// Her rol: id, name(TR), team, phase, ability metadata, aura, açıklama.
// team: "village" | "wolf" | "solo_kill" | "solo_vote"
// aura: "good" | "bad" | "unknown"  (Aura Kahini için)
// action: gece aksiyonu varsa { targets: n, phase: "night"|"day", desc }

export const TEAMS = {
  village: { id: "village", name: "Köylü Takımı", color: "#2563eb" },
  wolf: { id: "wolf", name: "Kurt Adam Takımı", color: "#dc2626" },
  solo_kill: { id: "solo_kill", name: "Solo Katiller", color: "#7c3aed" },
  solo_vote: { id: "solo_vote", name: "Solo Oylama Rolleri", color: "#d97706" },
};

// Rol tanımları. limit: tüm oyundaki maksimum kullanım (null = sınırsız).
export const ROLES = {
  // ---------- 5.1 KÖYLÜ TAKIMI ----------
  villager: {
    id: "villager", name: "Köylü", team: "village", aura: "good",
    desc: "Özel gücün yok. Gündüz konuşur ve oy verirsin.",
    night: null,
  },
  seer: {
    id: "seer", name: "Kahin", team: "village", aura: "good",
    desc: "Her gece bir oyuncunun TAM rolünü öğrenirsin.",
    night: { targets: 1, label: "Rolünü öğrenmek istediğin kişiyi seç", priority: "info" },
  },
  aura_seer: {
    id: "aura_seer", name: "Aura Kahini", team: "village", aura: "good",
    desc: "Bir oyuncunun aurasını görürsün: İyi / Kötü / Bilinmeyen.",
    night: { targets: 1, label: "Aurasını görmek istediğin kişiyi seç", priority: "info" },
  },
  sheriff: {
    id: "sheriff", name: "Şerif", team: "village", aura: "good",
    desc: "Bir oyuncunun şüpheli (kurt) olup olmadığını kontrol edersin. Bazı roller seni yanıltabilir.",
    night: { targets: 1, label: "Kontrol etmek istediğin kişiyi seç", priority: "info" },
  },
  detective: {
    id: "detective", name: "Dedektif", team: "village", aura: "good",
    desc: "Her gece iki kişi seçersin; aynı takımda olup olmadıklarını öğrenirsin.",
    night: { targets: 2, label: "Karşılaştırmak için iki kişi seç", priority: "info" },
  },
  doctor: {
    id: "doctor", name: "Doktor", team: "village", aura: "good",
    desc: "Her gece bir kişiyi korursun, kurt saldırısını engellersin. Kendini en fazla 1 kez koruyabilirsin.",
    night: { targets: 1, label: "Korumak istediğin kişiyi seç", priority: "protect" },
    selfLimit: 1,
  },
  bodyguard: {
    id: "bodyguard", name: "Koruma", team: "village", aura: "good",
    desc: "Koruduğun kişiye saldırı gelirse onun yerine ölürsün ve saldırı engellenir.",
    night: { targets: 1, label: "Korumak istediğin kişiyi seç", priority: "protect" },
  },
  tough_guy: {
    id: "tough_guy", name: "Sert Adam", team: "village", aura: "good",
    desc: "Koruduğun kişiye saldıranın rolünü öğrenirsin, ancak ertesi gece sen ölürsün.",
    night: { targets: 1, label: "Korumak istediğin kişiyi seç", priority: "protect" },
  },
  witch: {
    id: "witch", name: "Cadı", team: "village", aura: "good",
    desc: "İki iksirin var (her biri 1 kez): Can İksiri (ölmek üzere olanı kurtarır), Zehir İksiri (birini öldürür).",
    night: { targets: 1, label: "İksir kullan (can/zehir)", priority: "witch", potions: true },
    limit: { heal: 1, poison: 1 },
  },
  jailer: {
    id: "jailer", name: "Hapishaneci", team: "village", aura: "good",
    desc: "Her gece bir oyuncuyu hapsedersin; o gece yeteneğini kullanamaz. İstersen infaz edebilirsin.",
    night: { targets: 1, label: "Hapsetmek istediğin kişiyi seç", priority: "block", canExecute: true },
  },
  mayor: {
    id: "mayor", name: "Belediye Başkanı", team: "village", aura: "good",
    desc: "Oylamada oyun 2 oy sayılır.",
    night: null, voteWeight: 2,
  },
  priest: {
    id: "priest", name: "Rahip", team: "village", aura: "good",
    desc: "Seçtiğin bir kötü rolü öldürebilir/etkisiz hale getirebilirsin (sınırlı: 1 kez).",
    night: { targets: 1, label: "Kutsamak istediğin kişiyi seç", priority: "kill" },
    limit: { smite: 1 },
  },
  gunner: {
    id: "gunner", name: "Silahlı Köylü", team: "village", aura: "good",
    desc: "Gece bir oyuncuyu vurabilirsin (2 mermi). Yanlış vurursan köye zarar verir.",
    night: { targets: 1, label: "Vurmak istediğin kişiyi seç", priority: "kill" }, limit: { shoot: 2 },
  },
  marksman: {
    id: "marksman", name: "Keskin Nişancı", team: "village", aura: "good",
    desc: "Bir gece hedef belirlersin, SONRAKİ gece o hedefi vurursun.",
    night: { targets: 1, label: "İşaretlemek/vurmak istediğin kişiyi seç", priority: "kill", delayed: true },
  },
  medium: {
    id: "medium", name: "Medyum", team: "village", aura: "good",
    desc: "Ölü oyuncularla iletişim kurabilirsin; ölü sohbetine erişirsin.",
    night: null, ghostChat: true,
  },
  flower_child: {
    id: "flower_child", name: "Çiçek Çocuk", team: "village", aura: "good",
    desc: "Gece seçtiğin kişi ertesi gün linç edilemez (sınırlı: 1 kez).",
    night: { targets: 1, label: "Ertesi gün linçten koruyacağın kişiyi seç", priority: "protect", lynchGuard: true }, limit: { save: 1 },
  },
  pacifist: {
    id: "pacifist", name: "Barışçıl", team: "village", aura: "good",
    desc: "Gün içindeki oylamayı durdurabilirsin (o gün kimse asılmaz) — sınırlı: 1 kez.",
    day: { targets: 0, label: "Oylamayı durdur", stopVote: true }, limit: { stop: 1 },
  },

  // ---------- 5.2 KURT ADAM TAKIMI ----------
  werewolf: {
    id: "werewolf", name: "Kurt Adam", team: "wolf", aura: "bad",
    desc: "Temel kurt. Her gece ekibinle ortak hedef seçersin.",
    night: { targets: 1, label: "Saldırı hedefini seç", priority: "kill", wolfPack: true },
  },
  wolf_seer: {
    id: "wolf_seer", name: "Kurt Kahini", team: "wolf", aura: "bad",
    desc: "Gece oyuncular hakkında bilgi toplarsın (Kahin'in kurt versiyonu).",
    night: { targets: 1, label: "Rolünü öğrenmek istediğin kişiyi seç", priority: "info", wolfPack: true },
  },
  alpha_wolf: {
    id: "alpha_wolf", name: "Alfa Kurt", team: "wolf", aura: "bad",
    desc: "Bazı korumaları aşabilen güçlü saldırı yaparsın.",
    night: { targets: 1, label: "Güçlü saldırı hedefini seç", priority: "kill", wolfPack: true, pierce: true },
  },
  nightmare_wolf: {
    id: "nightmare_wolf", name: "Kabus Kurdu", team: "wolf", aura: "bad",
    desc: "Seçtiğin hedefi susturursun; o gece yeteneğini/konuşmasını kullanamaz.",
    night: { targets: 1, label: "Susturmak istediğin kişiyi seç", priority: "block", wolfPack: true },
  },
  guardian_wolf: {
    id: "guardian_wolf", name: "Koruyucu Kurt", team: "wolf", aura: "bad",
    desc: "Kurt takımındaki bir oyuncuyu o gece korursun.",
    night: { targets: 1, label: "Koruyacağın kurt oyuncusunu seç", priority: "protect", wolfPack: true },
  },
  shadow_wolf: {
    id: "shadow_wolf", name: "Gölge Kurdu", team: "wolf", aura: "bad",
    desc: "Oylamaları etkilersin (bir oyuncunun oyunu gizlice iptal edersin).",
    night: { targets: 1, label: "Oyunu iptal edilecek kişiyi seç", priority: "info", wolfPack: true, cancelVote: true },
  },
  voodoo_wolf: {
    id: "voodoo_wolf", name: "Vudu Kurdu", team: "wolf", aura: "bad",
    desc: "Bir oyuncuyu susturursun; o kişi ERTESİ GÜN konuşamaz.",
    night: { targets: 1, label: "Ertesi gün susturulacak kişiyi seç", priority: "info", wolfPack: true, muteNextDay: true },
  },
  wolf_shaman: {
    id: "wolf_shaman", name: "Kurt Şamanı", team: "wolf", aura: "bad",
    desc: "Oyuncular hakkında ek bilgi toplarsın; kurt takımının bilgi kaynağısın.",
    night: { targets: 1, label: "Aurasını öğrenmek istediğin kişiyi seç", priority: "info", wolfPack: true },
  },
  junior_werewolf: {
    id: "junior_werewolf", name: "Genç Kurt", team: "wolf", aura: "bad",
    desc: "Öldüğünde bir hedef işaretlersin; o hedef sonraki gece otomatik ölür.",
    night: { targets: 1, label: "Saldırı hedefini seç", priority: "kill", wolfPack: true, markOnDeath: true },
  },

  // ---------- 5.3 SOLO KATİLLER ----------
  serial_killer: {
    id: "serial_killer", name: "Seri Katil", team: "solo_kill", aura: "bad",
    desc: "Her gece bir kişiyi öldürürsün. Kurtlar tarafından öldürülemezsin.",
    night: { targets: 1, label: "Öldürmek istediğin kişiyi seç", priority: "kill" }, wolfImmune: true,
  },
  arsonist: {
    id: "arsonist", name: "Kundakçı", team: "solo_kill", aura: "bad",
    desc: "Oyuncuların üzerine benzin dökersin; bir gece 'Yak' dersen benzinli herkes ölür.",
    night: { targets: 1, label: "Benzin dök veya YAK", priority: "kill", douseOrIgnite: true },
  },
  bomber: {
    id: "bomber", name: "Bombacı", team: "solo_kill", aura: "bad",
    desc: "Bir oyuncuya bomba koyarsın, sonraki gece patlatırsın (hedef + komşuları).",
    night: { targets: 1, label: "Bomba yerleştir/patlat hedefini seç", priority: "kill", delayed: true },
  },
  corruptor: {
    id: "corruptor", name: "Yozlaştırıcı", team: "solo_kill", aura: "bad",
    desc: "Seçtiğin hedef o gün konuşamaz ve oy kullanamaz; gün sonunda ölür.",
    night: { targets: 1, label: "Yozlaştırmak istediğin kişiyi seç", priority: "block", corruptKill: true },
  },
  cannibal: {
    id: "cannibal", name: "Yamyam", team: "solo_kill", aura: "bad",
    desc: "Öldürme hakkı biriktirirsin; biriktirince bir gece toplu katliam yapabilirsin.",
    night: { targets: 1, label: "Öldür veya hak biriktir", priority: "kill", charge: true },
  },
  bandit: {
    id: "bandit", name: "Haydut", team: "solo_kill", aura: "bad",
    desc: "Bir oyuncuyu yardımcın yapabilirsin (solo takımını büyütürsün).",
    night: { targets: 1, label: "Yardımcı yapmak/öldürmek istediğin kişiyi seç", priority: "kill", recruit: true },
  },
  illusionist: {
    id: "illusionist", name: "İllüzyonist", team: "solo_kill", aura: "bad",
    desc: "Bilgi rollerini yanıltırsın; yanlış sonuç görmelerini sağlarsın.",
    night: { targets: 1, label: "Yanıltmak/öldürmek istediğin kişiyi seç", priority: "block", deceive: true },
  },

  // ---------- 5.4 SOLO OYLAMA ROLLERİ ----------
  fool: {
    id: "fool", name: "Deli", team: "solo_vote", aura: "good",
    desc: "Amacın kendini astırmak. Köy seni linç ederse ANINDA kazanırsın.",
    night: null, winOnLynch: true,
  },
  headhunter: {
    id: "headhunter", name: "Kelle Avcısı", team: "solo_vote", aura: "good",
    desc: "Oyun başında bir hedef atanır. O hedef linç edilirse kazanırsın.",
    night: null, winOnTargetLynch: true,
  },
  anarchist: {
    id: "anarchist", name: "Anarşist", team: "solo_vote", aura: "good",
    desc: "Köy 3 gün üst üste kimseyi asmazsa kazanırsın.",
    night: null, winOnNoLynch: 3,
  },

  // ---------- 5.5 YENİ EKLENEN ROLLER ----------
  gambler: {
    id: "gambler", name: "Kumarbaz", team: "solo_vote", aura: "unknown",
    desc: "Her gece bir oyuncu seç. 3 gece üst üste aynı takımdan seçersen kazanırsın. Farklı takım sayacı sıfırlar.",
    night: { targets: 1, label: "Bahis oynayacağın kişiyi seç", priority: "info", gamble: true },
  },
  manipulator: {
    id: "manipulator", name: "Manipülatif", team: "village", aura: "good",
    desc: "Oyun boyunca 1 kez, oylamada seçtiğin oyuncunun oyunu +2 saydırırsın (oyu 3 değerinde olur).",
    day: { targets: 1, label: "Oyunu +2 güçlendirilecek kişiyi seç", boostVote: true }, limit: { boost: 1 },
  },
};

// Lobi rol seçim listesi (gruplanmış) — admin arayüzü için.
export const ROLE_GROUPS = [
  { team: "village", title: "Köylü Takımı", roles: ["villager","seer","aura_seer","sheriff","detective","doctor","bodyguard","tough_guy","witch","jailer","mayor","priest","gunner","marksman","medium","flower_child","pacifist","manipulator"] },
  { team: "wolf", title: "Kurt Adam Takımı", roles: ["werewolf","wolf_seer","alpha_wolf","nightmare_wolf","guardian_wolf","shadow_wolf","voodoo_wolf","wolf_shaman","junior_werewolf"] },
  { team: "solo_kill", title: "Solo Katiller", roles: ["serial_killer","arsonist","bomber","corruptor","cannibal","bandit","illusionist"] },
  { team: "solo_vote", title: "Solo Oylama Rolleri", roles: ["fool","headhunter","anarchist","gambler"] },
];

export function getRole(id) {
  return ROLES[id] || null;
}

// Bir oyuncu kartı için client'a gönderilecek güvenli rol bilgisi.
export function publicRoleInfo(id) {
  const r = ROLES[id];
  if (!r) return null;
  return { id: r.id, name: r.name, team: r.team, desc: r.desc,
    teamName: TEAMS[r.team].name, teamColor: TEAMS[r.team].color };
}
