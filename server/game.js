// Oyun motoru: faz döngüsü, gece çözümleme (Bölüm 6), oylama, kazanma (Bölüm 9).
import { ROLES, getRole, publicRoleInfo, TEAMS } from "./roles.js";

// ---------------- yardımcılar ----------------
const now = () => Date.now();

export function alivePlayers(room) {
  return [...room.players.values()].filter((p) => p.alive && !p.isSpectator);
}
function livingByTeam(room, team) {
  return alivePlayers(room).filter((p) => getRole(p.roleId)?.team === team);
}
function playerById(room, id) {
  return room.players.get(id);
}

function logEvent(room, text, dayNumber, phase) {
  room.log.push({ text, day: dayNumber ?? room.game?.dayNumber, phase: phase ?? room.game?.phase, ts: now() });
}

// ---------------- emit yardımcıları ----------------
// io + room üzerinden state yayını. Her oyuncuya kişiselleştirilmiş state gider.
export function broadcastState(io, room) {
  for (const p of room.players.values()) {
    if (p.connected && p.socketId) {
      io.to(p.socketId).emit("state", personalState(room, p));
    }
  }
}
function emitTo(io, room, playerId, event, payload) {
  const p = playerById(room, playerId);
  if (p?.connected && p.socketId) io.to(p.socketId).emit(event, payload);
}

// Bir oyuncunun göreceği güvenli durum (başkalarının rolü gizli).
export function personalState(room, viewer) {
  const g = room.game;
  const me = viewer;
  const players = [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    isAdmin: p.isAdmin,
    connected: p.connected,
    isSpectator: p.isSpectator,
    alive: p.alive,
    isGhost: p.isGhost,
    // rol yalnızca: kendisi, ya da oyun bittiyse, ya da ölmüş & ayar açıksa
    role:
      p.id === me?.id || room.phase === "ended" ? publicRoleInfo(p.roleId) :
      (!p.alive && room.settings.revealRoleOnDeath ? publicRoleInfo(p.roleId) : null),
    voteFor: g?.phase === "vote" ? (g.votesPublic?.[p.id] ?? null) : null,
  }));

  // Kurtlar birbirini görür (gece ortak sohbet)
  let wolfmates = null;
  if (me && getRole(me.roleId)?.team === "wolf") {
    wolfmates = [...room.players.values()]
      .filter((p) => getRole(p.roleId)?.team === "wolf")
      .map((p) => ({ id: p.id, name: p.name, role: ROLES[p.roleId].name, alive: p.alive }));
  }

  // YEREL MOD: kontrolcü cihaza tüm oyuncuların rolleri + bilgileri gönderilir
  let local = null;
  if (room.mode === "local" && room.phase !== "lobby") {
    local = {
      players: [...room.players.values()].filter((p) => !p.isSpectator).map((p) => ({
        id: p.id, name: p.name, alive: p.alive, isGhost: p.isGhost,
        role: publicRoleInfo(p.roleId),
        roleId: p.roleId,
        uses: p.uses, flags: publicFlags(p),
        info: g?.privateInfo?.[p.id] || [],
        voteFor: g?.phase === "vote" ? (g.votesPublic?.[p.id] ?? null) : null,
      })),
    };
  }

  return {
    code: room.code,
    phase: room.phase,
    mode: room.mode,
    manual: room.manual,
    settings: room.settings,
    selectedRoles: room.selectedRoles || [],
    log: room.log,
    local,
    players,
    you: me ? {
      id: me.id, name: me.name, isAdmin: me.isAdmin, alive: me.alive,
      isGhost: me.isGhost, isSpectator: me.isSpectator,
      role: publicRoleInfo(me.roleId),
      uses: me.uses, flags: publicFlags(me),
    } : null,
    game: g ? {
      dayNumber: g.dayNumber,
      phase: g.phase,
      phaseEndsAt: g.phaseEndsAt,
      announcement: g.announcement || null,
      voteCounts: g.phase === "vote" ? voteTally(room) : null,
      wolfmates,
      wolfTargetVotes: (me && getRole(me.roleId)?.team === "wolf" && g.phase === "night")
        ? g.wolfVotes : null,
      privateInfo: g.privateInfo?.[me?.id] || null,
      winner: g.winner || null,
      winnerText: g.winnerText || null,
      awaitingNext: !!g.awaitingNext,
    } : null,
    adminId: room.adminId,
  };
}
function publicFlags(p) {
  // client'a güvenli bayraklar
  const f = p.flags || {};
  return { mutedDay: !!f.mutedDay, jailed: !!f.jailed, doused: !!f.doused };
}

// ---------------- OYUN BAŞLATMA ----------------
// GİZLİ ROL HAVUZU (Hidden Role Pool):
// Admin istediği kadar rol açabilir — seçili rol sayısı oyuncu sayısından FAZLA olabilir.
// Atama: havuzdan rastgele "oyuncu sayısı" kadar rol çekilir; gerisi GİZLİ kalır
// (kimse hangi rollerin dışarıda kaldığını bilmez → meta oluşmaz, tahmin zorlaşır).
// Seçili rol oyuncudan azsa kalan slotlar Köylü ile dolar. En az bir tehdit garanti.
const isThreat = (id) => ["wolf", "solo_kill"].includes(getRole(id)?.team);

export function validateRoleCounts(room) {
  const playingCount = [...room.players.values()].filter(
    (p) => !(p.isAdmin && !room.settings.adminPlays && room.mode !== "local")
  ).length;
  const selected = room.selectedRoles || [];
  const hasThreat = selected.some(isThreat);
  const ok = selected.length > 0 && playingCount >= 3 && hasThreat;
  let reason = null;
  if (playingCount < 3) reason = "En az 3 oyuncu gerekli.";
  else if (selected.length === 0) reason = "En az bir rol seç.";
  else if (!hasThreat) reason = "En az bir tehdit rolü (Kurt veya Solo Katil) seçmelisin.";
  return { total: selected.length, playerCount: playingCount, ok, reason, hasThreat };
}

export function startGame(io, room) {
  const v = validateRoleCounts(room);
  if (!v.ok) return { error: v.reason || "Roller geçersiz." };

  // oynayacak oyuncular (yerel modda admin de oynamaz, sadece kontrolcü olabilir
  // ama yerel oyuncuların hepsi oynar)
  const playing = [...room.players.values()].filter(
    (p) => !(p.isAdmin && !room.settings.adminPlays && room.mode !== "local")
  );
  playing.forEach((p) => { p.isSpectator = false; });
  [...room.players.values()].forEach((p) => {
    if (p.isAdmin && !room.settings.adminPlays && room.mode !== "local") p.isSpectator = true;
  });

  // rol havuzu: seçilenleri karıştır, eksikse Köylü ile doldur
  let pool = [...(room.selectedRoles || [])];
  shuffle(pool);
  while (pool.length < playing.length) pool.push("villager");
  // oyuncu sayısı kadarını çek; fazlası gizli kalır
  let chosen = pool.slice(0, playing.length);
  // en az bir tehdit garanti et (seçilenlerde tehdit varsa ama çekilenlerde yoksa)
  const selectedThreats = (room.selectedRoles || []).filter(isThreat);
  if (selectedThreats.length && !chosen.some(isThreat)) {
    const slot = Math.floor(Math.random() * chosen.length);
    chosen[slot] = selectedThreats[Math.floor(Math.random() * selectedThreats.length)];
  }
  pool = chosen;
  shuffle(pool);
  shuffle(playing);
  playing.forEach((p, i) => {
    p.roleId = pool[i];
    p.alive = true;
    p.isGhost = false;
    p.flags = {};
    p.uses = {};
  });

  // Kelle Avcısı hedefi ata
  const headhunters = playing.filter((p) => p.roleId === "headhunter");
  for (const hh of headhunters) {
    const candidates = playing.filter((p) => p.id !== hh.id);
    hh.flags.targetId = candidates[Math.floor(Math.random() * candidates.length)]?.id || null;
  }

  room.game = {
    dayNumber: 0,
    phase: "night",
    phaseEndsAt: null,
    timer: null,
    nightActions: {}, // playerId -> { targets:[], extra:{} }
    wolfVotes: {},    // wolfPlayerId -> targetId
    votes: {},        // voterId -> targetId
    votesPublic: {},
    privateInfo: {},  // playerId -> mesaj listesi
    announcement: null,
    global: { noLynchStreak: 0, gambler: {} },
    winner: null,
    winnerText: null,
  };
  room.phase = "night";
  logEvent(room, "Oyun başladı, roller dağıtıldı.", 1, "setup");

  // herkese rolünü gönder
  broadcastState(io, room);
  startNight(io, room);
  return { ok: true };
}

// ---------------- FAZ DÖNGÜSÜ ----------------
function clearTimer(room) {
  if (room.game?.timer) { clearTimeout(room.game.timer); room.game.timer = null; }
}
function setPhaseTimer(io, room, seconds, cb) {
  clearTimer(room);
  room.game.phaseEndsAt = now() + seconds * 1000;
  room.game.timer = setTimeout(() => cb(), seconds * 1000);
}

export function startNight(io, room) {
  const g = room.game;
  g.dayNumber += 1;
  g.phase = "night";
  room.phase = "night";
  g.nightActions = {};
  g.wolfVotes = {};
  g.announcement = null;
  g.awaitingNext = false;
  // gece başında geçici gündüz bayraklarını temizle
  for (const p of room.players.values()) {
    p.flags.jailed = false;
    p.flags.blockedThisNight = false;
  }
  g.privateInfo = {}; // her gece taze gizli bilgi (anında doldurulur)
  logEvent(room, `Gece ${g.dayNumber} başladı.`);
  broadcastState(io, room);
  if (!room.manual) setPhaseTimer(io, room, room.settings.nightDuration, () => resolveNight(io, room));
  else { g.phaseEndsAt = null; }
}

// ---------------- GECE ÇÖZÜMLEME (Bölüm 6) ----------------
export function resolveNight(io, room) {
  const g = room.game;
  if (g.phase !== "night") return;
  clearTimer(room);

  const actions = g.nightActions;     // playerId -> {targets, extra}
  const blocked = new Set();          // bu gece engellenen oyuncu id'leri
  const protectedBy = {};             // targetId -> [protectorId..]
  const deaths = new Map();           // victimId -> {by, type}
  const priv = (id, msg) => { (g.privateInfo[id] ||= []).push(msg); };
  // not: bilgi rolleri (Kahin, Şerif, Dedektif, Aura, Kumarbaz...) artık hamle
  // yapıldığı anda anında sonuç verir (computeInstantInfo). Burada tekrar hesaplanmaz.

  const act = (pid) => (alivePlayers(room).find(p => p.id === pid) ? actions[pid] : null);
  const roleOf = (pid) => getRole(playerById(room, pid)?.roleId);

  // ---- 1) ENGELLEME / SUSTURMA ----
  for (const p of alivePlayers(room)) {
    const r = getRole(p.roleId);
    const a = actions[p.id];
    if (!a || !a.targets?.length) continue;
    if (r.night?.priority === "block" || (r.id === "jailer")) {
      const t = a.targets[0];
      if (r.id === "jailer") {
        const tgt = playerById(room, t);
        if (tgt) { tgt.flags.jailed = true; blocked.add(t); priv(t, "Bu gece hapsedildin, yeteneğini kullanamadın."); }
        if (a.extra?.execute && tgt) deaths.set(t, { by: p.id, type: "jail_execute" });
      } else if (r.id === "nightmare_wolf" || r.id === "voodoo_wolf" || r.id === "illusionist") {
        blocked.add(t);
        if (r.id === "voodoo_wolf") { const tg = playerById(room, t); if (tg) tg.flags.mutedNextDay = true; }
      } else if (r.id === "corruptor") {
        const tg = playerById(room, t);
        if (tg) { tg.flags.mutedDay = true; tg.flags.cantVote = true; }
        deaths.set(t, { by: p.id, type: "corrupt" }); // gün sonunda ölür (basitlik: gece çözümünde işaretliyoruz)
        blocked.add(t);
      }
    }
  }

  // ---- 2) KORUMALAR ----
  for (const p of alivePlayers(room)) {
    if (blocked.has(p.id)) continue;
    const r = getRole(p.roleId);
    const a = actions[p.id];
    if (!a?.targets?.length) continue;
    if (r.night?.priority === "protect") {
      const t = a.targets[0];
      (protectedBy[t] ||= []).push({ id: p.id, role: r.id });
      if (r.id === "doctor" && t === p.id) p.uses.selfHeal = (p.uses.selfHeal || 0) + 1;
    }
  }

  // ---- 3) BİLGİ ROLLERİ: anında hesaplandı (computeInstantInfo) ----

  // ---- 4) ÖLDÜRME AKSİYONLARI ----
  // Kurt ortak hedefi (consensus): en çok oy alan
  const wolfTarget = resolveWolfTarget(room);
  if (wolfTarget) {
    const anyAlpha = livingByTeam(room, "wolf").some((w) => w.roleId === "alpha_wolf" && !blocked.has(w.id));
    deaths.set(wolfTarget, { by: "wolves", type: "wolf", pierce: anyAlpha });
  }
  for (const p of alivePlayers(room)) {
    if (blocked.has(p.id)) continue;
    const r = getRole(p.roleId);
    const a = actions[p.id];
    if (!a?.targets?.length) continue;
    const t = a.targets[0];
    switch (r.id) {
      case "serial_killer":
        deaths.set(t, { by: p.id, type: "serial" }); break;
      case "marksman": {
        // gecikmeli: ilk gece işaretle, sonraki gece vur
        if (p.flags.marksmanMark) { deaths.set(p.flags.marksmanMark, { by: p.id, type: "marksman" }); p.flags.marksmanMark = null; }
        else { p.flags.marksmanMark = t; priv(p.id, "🎯 Hedef işaretlendi, sonraki gece vurulacak."); }
        break;
      }
      case "bomber": {
        if (p.flags.bombTarget) {
          // patlat: hedef + komşular (oyuncu listesinde komşu)
          const victims = bombVictims(room, p.flags.bombTarget);
          victims.forEach((vid) => deaths.set(vid, { by: p.id, type: "bomb" }));
          p.flags.bombTarget = null;
        } else { p.flags.bombTarget = t; priv(p.id, "💣 Bomba yerleştirildi, sonraki gece patlayacak."); }
        break;
      }
      case "arsonist": {
        if (a.extra?.ignite) {
          for (const q of room.players.values()) if (q.flags.doused && q.alive) deaths.set(q.id, { by: p.id, type: "burn" });
        } else { const tg = playerById(room, t); if (tg) { tg.flags.doused = true; priv(p.id, `⛽ ${tg.name} benzinlendi.`); } }
        break;
      }
      case "cannibal": {
        p.uses.charge = (p.uses.charge || 0) + 1;
        if (a.extra?.feast && p.uses.charge >= 2) {
          // toplu: hedef + bir komşu
          bombVictims(room, t).forEach((vid) => deaths.set(vid, { by: p.id, type: "cannibal" }));
          p.uses.charge = 0;
        } else if (!a.extra?.charge) deaths.set(t, { by: p.id, type: "cannibal" });
        break;
      }
      case "bandit": {
        if (a.extra?.recruit) { const tg = playerById(room, t); if (tg && ROLES[tg.roleId].team === "village") { /* basit: yardımcı işareti */ tg.flags.recruitedBy = p.id; priv(p.id, `🤝 ${tg.name} yardımcın olarak işaretlendi.`); } }
        else deaths.set(t, { by: p.id, type: "bandit" });
        break;
      }
      case "priest": {
        if ((p.uses.smite || 0) < 1) {
          const tg = playerById(room, t);
          if (tg && ROLES[tg.roleId].aura === "bad") { deaths.set(t, { by: p.id, type: "smite" }); p.uses.smite = 1; priv(p.id, `⛪ ${tg.name} etkisiz hale getirildi.`); }
          else { p.uses.smite = 1; priv(p.id, "⛪ Hedefin kötü değildi, gücün boşa gitti."); }
        }
        break;
      }
      case "witch": {
        if (a.extra?.poison && (p.uses.poison || 0) < 1) { deaths.set(t, { by: p.id, type: "poison" }); p.uses.poison = 1; }
        break;
      }
    }
  }

  // ---- 5) KURTARMA (korumalar öldürmeyi iptal eder) ----
  for (const [victimId, info] of [...deaths.entries()]) {
    // Seri Katil kurt saldırısından etkilenmez
    const victim = playerById(room, victimId);
    if (!victim) { deaths.delete(victimId); continue; }
    if (info.type === "wolf" && getRole(victim.roleId)?.wolfImmune) { deaths.delete(victimId); continue; }

    const prot = protectedBy[victimId] || [];
    // Cadı can iksiri
    const healer = aliveWitchHealing(room, victimId);
    let saved = false;
    if (info.type !== "jail_execute" && info.type !== "corrupt" && info.type !== "poison" && info.type !== "smite") {
      if (prot.length && !(info.pierce)) saved = true; // alfa pierce korumayı aşar
      if (info.pierce && prot.some((x) => x.role === "bodyguard")) saved = false; // alfa korumayı aşar ama bodyguard yine de canıyla öder (aşağıda)
    }
    if (healer) saved = true;
    if (saved) {
      deaths.delete(victimId);
      priv(victimId, "🛡️ Bu gece bir saldırıdan korundun!");
      // bodyguard yerine ölür
      const bg = prot.find((x) => x.role === "bodyguard");
      if (bg && (info.type === "wolf" || info.type === "serial" || info.type === "alpha")) {
        deaths.set(bg.id, { by: info.by, type: "bodyguard_sacrifice" });
      }
      // tough guy: saldıranın rolünü öğrenir, ertesi gece ölür
      const tg = prot.find((x) => x.role === "tough_guy");
      if (tg) {
        const attacker = playerById(room, info.by);
        if (attacker) priv(tg.id, `🥊 Saldıranın rolü: ${ROLES[attacker.roleId]?.name || "bilinmiyor"}`);
        const tgp = playerById(room, tg.id); if (tgp) tgp.flags.diesNextNight = true;
      }
    }
  }

  // ---- 6) ÖLÜM TETİKLEYİCİLERİ ----
  // Sert Adam gecikmeli ölüm
  for (const p of alivePlayers(room)) {
    if (p.flags.diesNextNight && !deaths.has(p.id)) {
      // bu gece değil, sonraki gece — basitlik: bir sonraki resolve'de
      if (p.flags.toughCountdown) { deaths.set(p.id, { by: "self", type: "tough_guy" }); p.flags.diesNextNight = false; p.flags.toughCountdown = false; }
      else p.flags.toughCountdown = true;
    }
  }
  // Genç Kurt ölüm işareti (önceki ölümden)
  if (g.global.juniorMark) { deaths.set(g.global.juniorMark, { by: "junior", type: "junior" }); g.global.juniorMark = null; }

  // ---- ÖLÜMLERİ UYGULA ----
  const died = [];
  for (const [victimId] of deaths) {
    const v = playerById(room, victimId);
    if (v && v.alive) {
      killPlayer(room, v);
      died.push(v);
      // Genç Kurt öldüyse takımına avantaj: bir hedef işaretle (rastgele köylü) — basit
      if (v.roleId === "junior_werewolf") {
        const vil = livingByTeam(room, "village").filter((x) => x.id !== v.id);
        if (vil.length) g.global.juniorMark = vil[Math.floor(Math.random() * vil.length)].id;
      }
    }
  }

  // gündüz açıklaması (anonim)
  if (died.length) {
    g.announcement = died.map((d) => `💀 ${d.name} bu gece öldürüldü.`).join(" ");
  } else {
    g.announcement = "🌅 Bu gece kimse ölmedi.";
  }
  died.forEach((d) => logEvent(room, `${d.name} gece öldü.`));

  // kazanma kontrolü
  if (checkWin(io, room)) return;

  startDay(io, room);
}

function aliveWitchHealing(room, victimId) {
  // bu basit modelde: cadı 'heal' extra ile can iksiri kullandıysa ve hedefi victim ise
  const g = room.game;
  for (const p of alivePlayers(room)) {
    if (p.roleId !== "witch") continue;
    const a = g.nightActions[p.id];
    if (a?.extra?.heal && (p.uses.heal || 0) < 1 && a.targets?.[0] === victimId) {
      p.uses.heal = 1;
      return true;
    }
  }
  return false;
}

function resolveWolfTarget(room) {
  const g = room.game;
  const counts = {};
  for (const [wid, tid] of Object.entries(g.wolfVotes || {})) {
    const w = playerById(room, wid);
    if (w?.alive && tid) counts[tid] = (counts[tid] || 0) + 1;
  }
  let best = null, bestN = 0;
  for (const [tid, n] of Object.entries(counts)) if (n > bestN) { best = tid; bestN = n; }
  return best;
}

function bombVictims(room, centerId) {
  const list = alivePlayers(room);
  const idx = list.findIndex((p) => p.id === centerId);
  const out = [centerId];
  if (idx >= 0) {
    if (list[idx - 1]) out.push(list[idx - 1].id);
    if (list[idx + 1]) out.push(list[idx + 1].id);
  }
  return [...new Set(out)];
}

function killPlayer(room, p) {
  p.alive = false;
  p.isGhost = true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ---------------- GÜNDÜZ ----------------
export function startDay(io, room) {
  const g = room.game;
  g.phase = "day";
  room.phase = "day";
  // gün başında: mutedNextDay -> mutedDay
  for (const p of room.players.values()) {
    p.flags.mutedDay = !!p.flags.mutedNextDay || !!p.flags.mutedDay;
    p.flags.mutedNextDay = false;
  }
  logEvent(room, `Gündüz ${g.dayNumber}: ${g.announcement}`);
  broadcastState(io, room);
  if (!room.manual) setPhaseTimer(io, room, room.settings.discussionDuration, () => startVote(io, room));
  else g.phaseEndsAt = null;
}

// ---------------- OYLAMA ----------------
export function startVote(io, room) {
  const g = room.game;
  g.phase = "vote";
  room.phase = "vote";
  g.votes = {};
  g.votesPublic = {};
  g.voteStopped = false;
  broadcastState(io, room);
  if (!room.manual) setPhaseTimer(io, room, room.settings.voteDuration, () => resolveVote(io, room));
  else g.phaseEndsAt = null;
}

export function voteTally(room) {
  const g = room.game;
  const tally = {};
  for (const [voterId, targetId] of Object.entries(g.votes)) {
    if (!targetId || targetId === "__skip__") continue; // çekimser
    const voter = playerById(room, voterId);
    if (!voter?.alive || voter.flags.cantVote) continue;
    let weight = 1;
    if (voter.roleId === "mayor") weight = 2;
    if (g.boostedVoter === voterId) weight += 2;
    if (g.cancelledVoter === voterId) weight = 0;
    tally[targetId] = (tally[targetId] || 0) + weight;
  }
  return tally;
}

export function resolveVote(io, room) {
  const g = room.game;
  if (g.phase !== "vote") return;
  clearTimer(room);

  if (g.voteStopped) {
    g.announcement = "✋ Oylama durduruldu, bu gün kimse asılmadı.";
    afterLynch(io, room, null);
    return;
  }

  const tally = voteTally(room);
  let top = null, topN = 0, tie = false;
  for (const [tid, n] of Object.entries(tally)) {
    if (n > topN) { top = tid; topN = n; tie = false; }
    else if (n === topN && n > 0) tie = true;
  }

  // Çiçek Çocuk koruması
  if (top && g.lynchProtected === top) { g.announcement = "🌸 Çiçek Çocuk linçi engelledi!"; afterLynch(io, room, null); return; }

  if (!top || topN === 0 || (tie && room.settings.tieRule === "no_lynch")) {
    g.announcement = "🤝 Oylama berabere/sonuçsuz, kimse asılmadı.";
    afterLynch(io, room, null);
    return;
  }

  const victim = playerById(room, top);
  killPlayer(room, victim);
  g.announcement = room.settings.revealRoleOnDeath
    ? `⚖️ ${victim.name} linç edildi. Rolü: ${ROLES[victim.roleId].name}.`
    : `⚖️ ${victim.name} linç edildi.`;
  logEvent(room, `${victim.name} linç edildi (${ROLES[victim.roleId].name}).`);
  afterLynch(io, room, victim);
}

function afterLynch(io, room, victim) {
  const g = room.game;
  // sayaçlar
  if (!victim) g.global.noLynchStreak = (g.global.noLynchStreak || 0) + 1;
  else g.global.noLynchStreak = 0;

  // Deli kendini astırdı mı?
  if (victim && victim.roleId === "fool") {
    return endGame(io, room, victim.id, `🤡 ${victim.name} (Deli) kendini astırdı ve kazandı!`);
  }
  // Kelle Avcısı hedefi asıldı mı?
  if (victim) {
    const hh = [...room.players.values()].find((p) => p.roleId === "headhunter" && p.flags.targetId === victim.id);
    if (hh) return endGame(io, room, hh.id, `🎯 ${hh.name} (Kelle Avcısı) hedefini astırdı ve kazandı!`);
  }
  // Anarşist
  const anarchist = alivePlayers(room).find((p) => p.roleId === "anarchist");
  if (anarchist && g.global.noLynchStreak >= 3) {
    return endGame(io, room, anarchist.id, `🏴 ${anarchist.name} (Anarşist) 3 gün linç engelledi ve kazandı!`);
  }

  // temizle gün-içi bayraklar
  for (const p of room.players.values()) {
    p.flags.mutedDay = false; p.flags.cantVote = false;
  }
  g.lynchProtected = null; g.boostedVoter = null; g.cancelledVoter = null;

  if (checkWin(io, room)) return;
  // sonraki geceye geç (yerel modda host elle ilerletir)
  if (!room.manual) setTimeout(() => startNight(io, room), 4000);
  else g.awaitingNext = true; // host "sonraki gece" diyene kadar bekle
  broadcastState(io, room);
}

// ---------------- KAZANMA (Bölüm 9) ----------------
export function checkWin(io, room) {
  const g = room.game;
  // Kumarbaz 3 seri
  for (const [pid, gs] of Object.entries(g.global.gambler || {})) {
    const p = playerById(room, pid);
    if (p?.alive && gs.streak >= 3) return endGame(io, room, pid, `🎲 ${p.name} (Kumarbaz) 3 seriyi tamamladı ve kazandı!`);
  }

  const living = alivePlayers(room);
  const wolves = living.filter((p) => getRole(p.roleId)?.team === "wolf");
  const soloKill = living.filter((p) => getRole(p.roleId)?.team === "solo_kill");
  const villagers = living.filter((p) => getRole(p.roleId)?.team === "village");

  // Solo katil tek başına kalan tehdit (1v1 veya tek)
  if (soloKill.length === 1 && living.length <= 2 && wolves.length === 0) {
    const sk = soloKill[0];
    return endGame(io, room, sk.id, `🔪 ${sk.name} (${ROLES[sk.roleId].name}) son tehdit olarak kazandı!`);
  }
  if (soloKill.length >= 1 && living.length === soloKill.length) {
    const sk = soloKill[0];
    return endGame(io, room, sk.id, `🔪 ${ROLES[sk.roleId].name} kazandı!`);
  }

  // Kurtlar: kurt >= köylü ve solo katil yok
  if (wolves.length > 0 && soloKill.length === 0 && wolves.length >= (villagers.length)) {
    return endGame(io, room, "wolf", `🐺 Kurt Adam takımı kazandı!`);
  }
  // Köylüler: kurt yok ve solo katil yok
  if (wolves.length === 0 && soloKill.length === 0) {
    return endGame(io, room, "village", `🏡 Köylü takımı kazandı!`);
  }
  return false;
}

export function endGame(io, room, winner, text) {
  const g = room.game;
  clearTimer(room);
  g.phase = "ended";
  room.phase = "ended";
  g.winner = winner;
  g.winnerText = text;
  logEvent(room, `OYUN BİTTİ: ${text}`);
  broadcastState(io, room);
  return true;
}

// ---------------- AKSİYON GİRİŞLERİ ----------------
export function submitNightAction(io, room, playerId, { targets, extra }) {
  const g = room.game;
  if (!g || g.phase !== "night") return;
  const p = playerById(room, playerId);
  if (!p?.alive) return;
  const r = getRole(p.roleId);
  if (!r?.night) return;
  if (p.flags.jailed) return; // hapisteyse aksiyon yok

  g.nightActions[playerId] = { targets: targets || [], extra: extra || {} };
  // kurt ortak hedefi
  if (r.night.wolfPack && r.night.priority === "kill") {
    g.wolfVotes[playerId] = targets?.[0] || null;
  }
  // ANINDA bilgi: bilgi rolleri sonucu beklemeden alır
  computeInstantInfo(room, p, targets, extra);
  broadcastState(io, room);
  // Tüm gece görevliler hamlesini yaptıysa süreyi bekleme, hemen çöz.
  maybeAutoResolveNight(io, room);
}

// Gece aksiyonu olan tüm canlı (ve hapiste olmayan) oyuncular hamle yaptıysa
// zamanlayıcıyı beklemeden geceyi çöz.
export function nightActors(room) {
  return alivePlayers(room).filter((p) => getRole(p.roleId)?.night && !p.flags.jailed);
}
function maybeAutoResolveNight(io, room) {
  const g = room.game;
  if (!g || g.phase !== "night" || room.manual) return;
  const required = nightActors(room);
  if (required.length > 0 && required.every((p) => g.nightActions[p.id])) {
    resolveNight(io, room);
  }
}

// Bilgi rolleri için hamle anında sonuç üretir (Bölüm 10: anında geri bildirim).
function computeInstantInfo(room, p, targets, extra) {
  const g = room.game;
  const r = getRole(p.roleId);
  const auraMap = { good: "İyi", bad: "Kötü", unknown: "Bilinmeyen" };
  const t = playerById(room, targets?.[0]);
  const push = (msg) => { g.privateInfo[p.id] = [msg]; }; // her gece tek sonuç
  switch (r.id) {
    case "seer":
    case "wolf_seer":
      if (t) push(`🔮 ${t.name} kişisinin rolü: ${ROLES[t.roleId].name}`);
      break;
    case "aura_seer":
    case "wolf_shaman":
      if (t) push(`✨ ${t.name} kişisinin aurası: ${auraMap[ROLES[t.roleId].aura]}`);
      break;
    case "sheriff":
      if (t) push(`🔎 ${t.name}: ${ROLES[t.roleId].team === "wolf" ? "ŞÜPHELİ (kurt olabilir!)" : "temiz görünüyor"}`);
      break;
    case "detective": {
      const t2 = playerById(room, targets?.[1]);
      if (t && t2) push(`🕵️ ${t.name} & ${t2.name}: ${ROLES[t.roleId].team === ROLES[t2.roleId].team ? "AYNI takımda" : "FARKLI takımlarda"}`);
      break;
    }
    case "gambler": {
      const gs = (g.global.gambler[p.id] ||= { lastTeam: null, streak: 0 });
      if (t) {
        const team = ROLES[t.roleId].team;
        if (gs.lastTeam === team) gs.streak += 1; else gs.streak = 1;
        gs.lastTeam = team;
        push(`🎲 Seri: ${gs.streak}/3 (takım: ${TEAMS[team].name})`);
        // 3 seri tamamlandıysa kazanma anında kontrol edilir (gündüz/gece sonu)
      }
      break;
    }
  }
}

// ---- HOST KONTROL (yerel/manuel mod faz ilerletme) ----
export function hostControl(io, room, action) {
  if (!room.manual || !room.game) return;
  const ph = room.game.phase;
  switch (action) {
    case "resolveNight": if (ph === "night") resolveNight(io, room); break;
    case "startVote":    if (ph === "day") startVote(io, room); break;
    case "resolveVote":  if (ph === "vote") resolveVote(io, room); break;
    case "nextNight":    if (ph === "day" || ph === "vote") startNight(io, room); break;
  }
}

export function submitDayAction(io, room, playerId, { targets, extra }) {
  const g = room.game;
  if (!g) return;
  const p = playerById(room, playerId);
  if (!p?.alive) return;
  const r = getRole(p.roleId);

  // gündüz/oylama özel yetenekleri
  if (r.id === "gunner" && g.phase === "day") {
    if ((p.uses.shoot || 0) >= 2) return;
    const t = playerById(room, targets?.[0]);
    if (t?.alive) { p.uses.shoot = (p.uses.shoot || 0) + 1; killPlayer(room, t);
      g.announcement = `🔫 ${p.name} ateş etti, ${t.name} vuruldu.`;
      logEvent(room, `${p.name} (Silahlı Köylü) ${t.name} kişisini vurdu.`);
      broadcastState(io, room); checkWin(io, room); }
  }
  if (r.id === "flower_child" && (p.uses.save || 0) < 1) { p.uses.save = 1; g.lynchProtected = targets?.[0]; }
  if (r.id === "pacifist" && g.phase === "vote" && (p.uses.stop || 0) < 1) { p.uses.stop = 1; g.voteStopped = true; }
  if (r.id === "manipulator" && (p.uses.boost || 0) < 1) { p.uses.boost = 1; g.boostedVoter = targets?.[0]; }
  broadcastState(io, room);
}

export function castVote(io, room, voterId, targetId) {
  const g = room.game;
  if (!g || g.phase !== "vote") return;
  const v = playerById(room, voterId);
  if (!v?.alive || v.flags.cantVote) return;
  g.votes[voterId] = targetId;
  g.votesPublic[voterId] = targetId;
  broadcastState(io, room);
  // herkes oy verdiyse erken çöz
  const livingVoters = alivePlayers(room).filter((p) => !p.flags.cantVote);
  if (livingVoters.every((p) => g.votes[p.id])) {
    resolveVote(io, room);
  }
}

export { logEvent };
