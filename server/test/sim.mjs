// Uçtan uca akış testi: ONLINE mod + YEREL (tek cihaz) mod.
import { io } from "socket.io-client";

const URL = "http://localhost:3001";
const mk = () => io(URL, { transports: ["websocket"] });
const ack = (s, ev, p) => new Promise((r) => s.emit(ev, p, (res) => r(res || {})));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function onlineTest() {
  console.log("\n===== ONLINE MOD =====");
  const states = {};
  const admin = mk(), b = mk(), c = mk(), d = mk();
  const socks = { admin, b, c, d };
  for (const [n, s] of Object.entries(socks)) s.on("state", (st) => (states[n] = st));
  await wait(300);

  const r1 = await ack(admin, "createRoom", { name: "Admin" });
  const code = r1.code, adminId = r1.playerId;
  await ack(b, "joinRoom", { code, name: "Bora" });
  await ack(c, "joinRoom", { code, name: "Cem" });
  await ack(d, "joinRoom", { code, name: "Deniz" });

  admin.emit("setSettings", { code, playerId: adminId, settings: { nightDuration: 2, discussionDuration: 1, voteDuration: 2 } });
  // GİZLİ HAVUZ: 4 oyuncu, 7 rol seçili -> 3 rol gizli kalır, en az 1 tehdit garanti
  admin.emit("setRoles", { code, playerId: adminId, selectedRoles: ["werewolf", "alpha_wolf", "seer", "doctor", "sheriff", "witch", "serial_killer"] });
  await wait(300);
  const start = await ack(admin, "startGame", { code, playerId: adminId });
  console.log("start:", start.ok ? "OK" : start.error);
  await wait(300);

  const roleCount = {};
  for (const [n, s] of Object.entries(states)) roleCount[s.you?.role?.id] = (roleCount[s.you?.role?.id] || 0) + 1;
  const dealt = Object.keys(roleCount).length;
  const threatDealt = Object.entries(states).some(([, s]) => ["wolf", "solo_kill"].includes(s.you?.role?.team));
  console.log("dağılan roller:", roleCount, `→ ${Object.values(roleCount).reduce((a,b)=>a+b,0)} rol (4 beklenir), tehdit var mı: ${threatDealt}`);

  // kahin ANINDA bilgi testi
  const seer = Object.entries(states).find(([, s]) => s.you?.role?.id === "seer");
  const wolf = Object.entries(states).find(([, s]) => s.you?.role?.id === "werewolf");
  if (seer) {
    const [sn, ss] = seer;
    const target = ss.players.find((p) => p.id !== ss.you.id && p.alive).id;
    socks[sn].emit("nightAction", { code, playerId: ss.you.id, targets: [target] });
    await wait(150);
    console.log("kahin ANINDA bilgi:", states[sn].game?.privateInfo, "(beklenir: hamleden hemen sonra)");
  }
  const acted = new Set();
  if (seer) acted.add(seer[1].you.id);
  if (wolf) {
    const [wn, ws] = wolf;
    acted.add(ws.you.id);
    const target = ws.players.find((p) => p.id !== ws.you.id && p.alive).id;
    socks[wn].emit("nightAction", { code, playerId: ws.you.id, targets: [target] });
  }
  // geri kalan gece görevliler PAS geçsin -> otomatik çözülmeli (süre beklemeden)
  for (const [n, s] of Object.entries(states)) {
    if (s.you?.alive && !acted.has(s.you.id)) socks[n].emit("nightAction", { code, playerId: s.you.id, targets: [] });
  }
  await wait(500); // 2sn'lik süreyi BEKLEMEDEN day'e geçmeli
  console.log("OTOMATIK gece sonucu (≤0.5sn): faz =", states.admin.phase, "| duyuru:", states.admin.game?.announcement);

  // herkes oy
  await wait(800);
  for (const [n, s] of Object.entries(states)) {
    if (s.you?.alive && s.phase === "vote") {
      const t = s.players.find((p) => p.alive && p.id !== s.you.id)?.id;
      if (t) socks[n].emit("vote", { code, playerId: s.you.id, targetId: t });
    }
  }
  await wait(3000);
  console.log("son faz:", states.admin.phase, "| sonuç:", states.admin.game?.winnerText || states.admin.game?.announcement);
  Object.values(socks).forEach((s) => s.close());
}

async function localTest() {
  console.log("\n===== YEREL (TEK CİHAZ) MOD =====");
  let st = null;
  const host = mk();
  host.on("state", (s) => (st = s));
  await wait(300);

  const r = await ack(host, "createLocalRoom", { names: ["Ali", "Veli", "Ayşe", "Fatma"] });
  console.log("createLocalRoom:", r.ok ? "OK code=" + r.code + " mode=" + r.mode : r.error);
  const code = r.code, hostId = r.playerId;
  await wait(200);

  host.emit("setRoles", { code, playerId: hostId, selectedRoles: ["werewolf", "seer", "doctor"] });
  await wait(200);
  const start = await ack(host, "startGame", { code, playerId: hostId });
  console.log("start:", start.ok ? "OK" : start.error, "| manual:", st.manual);
  await wait(200);

  // tanrı görünümü: tüm roller görünür mü?
  console.log("god view roller:", st.local.players.map((p) => `${p.name}:${p.role.name}`).join(", "));
  console.log("faz:", st.phase, "(night, zamanlayıcısız beklenir, phaseEndsAt:", st.game?.phaseEndsAt, ")");

  const find = (rid) => st.local.players.find((p) => p.roleId === rid);
  const seer = find("seer"), wolf = find("werewolf"), doctor = find("doctor");
  const someoneElse = (me) => st.local.players.find((p) => p.id !== me.id && p.alive).id;

  // kahin hamlesi -> anında bilgi
  host.emit("nightAction", { code, playerId: seer.id, targets: [someoneElse(seer)] });
  await wait(150);
  console.log("kahin anında bilgi:", st.local.players.find((p) => p.id === seer.id).info);
  // kurt + doktor
  host.emit("nightAction", { code, playerId: wolf.id, targets: [someoneElse(wolf)] });
  host.emit("nightAction", { code, playerId: doctor.id, targets: [doctor.id] });
  await wait(150);

  // host geceyi bitirir
  host.emit("hostControl", { code, playerId: hostId, action: "resolveNight" });
  await wait(300);
  console.log("faz:", st.phase, "| duyuru:", st.game?.announcement);

  // oylamaya geç
  host.emit("hostControl", { code, playerId: hostId, action: "startVote" });
  await wait(200);
  console.log("faz:", st.phase);
  // canlı herkes ilk başkasına oy versin
  for (const p of st.local.players.filter((x) => x.alive)) {
    const t = st.local.players.find((x) => x.alive && x.id !== p.id)?.id;
    host.emit("vote", { code, playerId: p.id, targetId: t });
  }
  await wait(400);
  console.log("oy sonrası faz:", st.phase, "| awaitingNext:", st.game?.awaitingNext, "| duyuru:", st.game?.announcement);

  if (st.phase === "ended") console.log("SONUÇ:", st.game?.winnerText);
  else {
    host.emit("hostControl", { code, playerId: hostId, action: "nextNight" });
    await wait(300);
    console.log("sonraki gece faz:", st.phase, "gün:", st.game?.dayNumber);
  }
  host.close();
}

await onlineTest();
await localTest();
console.log("\n✅ Tüm simülasyonlar tamamlandı.");
process.exit(0);
