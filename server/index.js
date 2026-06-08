// TASA ÇOCUK - Sunucu giriş noktası (Express + Socket.io)
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import {
  rooms, createRoom, getRoom, makePlayer, maybeCleanupRoom,
} from "./store.js";
import { ROLES, ROLE_GROUPS, TEAMS, publicRoleInfo } from "./roles.js";
import {
  startGame, validateRoleCounts, submitNightAction, submitDayAction,
  castVote, broadcastState, personalState, hostControl,
} from "./game.js";
import { getRole } from "./roles.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get("/api/roles", (_req, res) => res.json({ roles: ROLES, groups: ROLE_GROUPS, teams: TEAMS }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// playerId -> { code } eşlemesi (reconnect için)
function findPlayerBySocket(socketId) {
  for (const room of rooms.values()) {
    for (const p of room.players.values()) {
      if (p.socketId === socketId) return { room, player: p };
    }
  }
  return null;
}

function isAdmin(room, playerId) {
  return room.adminId === playerId;
}

// Bir soketin, verdiği playerId adına hareket etme yetkisi var mı?
// Online: sadece kendi oyuncusu. Yerel: kontrolcü tüm oyuncular adına oynar.
function authAction(room, playerId, socketId) {
  if (room.mode === "local") return room.controllerSocket === socketId;
  const p = room.players.get(playerId);
  return p && p.socketId === socketId;
}

function pushChat(io, room, channel, name, text) {
  const msg = { name, text, ts: Date.now(), channel };
  if (channel === "dead") {
    room.deadChat.push(msg);
    // ölü + medyum + ghost'lara gönder
    for (const p of room.players.values()) {
      if (!p.connected) continue;
      const r = getRole(p.roleId);
      if (!p.alive || r?.ghostChat) io.to(p.socketId).emit("chat", { ...msg, channel: "dead" });
    }
  } else if (channel === "wolf") {
    for (const p of room.players.values()) {
      if (p.connected && getRole(p.roleId)?.team === "wolf" && p.alive)
        io.to(p.socketId).emit("chat", { ...msg, channel: "wolf" });
    }
  } else {
    room.chat.push(msg);
    io.to(`room:${room.code}`).emit("chat", { ...msg, channel: "all" });
  }
}

io.on("connection", (socket) => {
  // ---- ODA KUR ----
  socket.on("createRoom", ({ name }, cb) => {
    if (!name?.trim()) return cb?.({ error: "Takma ad gerekli." });
    const room = createRoom(name.trim());
    const playerId = nanoid(10);
    const player = makePlayer({ id: playerId, name: name.trim(), socketId: socket.id, isAdmin: true });
    room.players.set(playerId, player);
    room.adminId = playerId;
    socket.join(`room:${room.code}`);
    cb?.({ ok: true, code: room.code, playerId });
    broadcastState(io, room);
  });

  // ---- YEREL ODA KUR (Tek Cihaz / Pass-and-Play) ----
  socket.on("createLocalRoom", ({ names }, cb) => {
    const clean = (names || []).map((n) => (n || "").trim()).filter(Boolean).slice(0, 20);
    if (clean.length < 3) return cb?.({ error: "En az 3 oyuncu adı gir." });
    const room = createRoom("Host", "local");
    let firstId = null;
    clean.forEach((nm, i) => {
      const pid = nanoid(10);
      if (i === 0) firstId = pid;
      const player = makePlayer({ id: pid, name: nm, socketId: socket.id, isAdmin: i === 0, local: true });
      room.players.set(pid, player);
    });
    room.adminId = firstId;       // kontrolcü = bu cihazın soketi
    room.controllerSocket = socket.id;
    socket.join(`room:${room.code}`);
    cb?.({ ok: true, code: room.code, playerId: firstId, mode: "local" });
    broadcastState(io, room);
  });

  // ---- ODAYA KATIL ----
  socket.on("joinRoom", ({ code, name }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Oda bulunamadı." });
    if (room.phase !== "lobby") return cb?.({ error: "Oyun başlamış, katılamazsın." });
    if (!name?.trim()) return cb?.({ error: "Takma ad gerekli." });
    const taken = [...room.players.values()].some((p) => p.name.toLowerCase() === name.trim().toLowerCase() && p.connected);
    if (taken) return cb?.({ error: "Bu takma ad kullanılıyor." });
    const playerId = nanoid(10);
    const player = makePlayer({ id: playerId, name: name.trim(), socketId: socket.id });
    room.players.set(playerId, player);
    socket.join(`room:${room.code}`);
    cb?.({ ok: true, code: room.code, playerId });
    broadcastState(io, room);
  });

  // ---- RECONNECT ----
  socket.on("reconnectPlayer", ({ code, playerId }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Oda artık yok." });
    const player = room.players.get(playerId);
    if (!player) return cb?.({ error: "Oyuncu bulunamadı." });
    player.socketId = socket.id;
    player.connected = true;
    // yerel modda kontrolcü tüm oyuncuların soketidir
    if (room.mode === "local") {
      room.controllerSocket = socket.id;
      for (const p of room.players.values()) { p.socketId = socket.id; p.connected = true; }
    }
    socket.join(`room:${room.code}`);
    cb?.({ ok: true, code: room.code, playerId, mode: room.mode });
    broadcastState(io, room);
  });

  // ---- LOBİ: ROL SEÇİMİ (aç/kapa) ----
  socket.on("setRoles", ({ code, playerId, selectedRoles }) => {
    const room = getRoom(code);
    if (!room || !isAdmin(room, playerId) || room.phase !== "lobby") return;
    const clean = [...new Set((selectedRoles || []).filter((rid) => ROLES[rid]))];
    room.selectedRoles = clean;
    broadcastState(io, room);
  });

  // ---- HOST KONTROL (yerel mod faz ilerletme) ----
  socket.on("hostControl", ({ code, playerId, action }) => {
    const room = getRoom(code);
    if (!room || !isAdmin(room, playerId)) return;
    hostControl(io, room, action);
  });

  // ---- LOBİ: AYARLAR ----
  socket.on("setSettings", ({ code, playerId, settings }) => {
    const room = getRoom(code);
    if (!room || !isAdmin(room, playerId) || room.phase !== "lobby") return;
    room.settings = { ...room.settings, ...settings };
    broadcastState(io, room);
  });

  // ---- LOBİ: OYUNCU AT ----
  socket.on("kickPlayer", ({ code, playerId, targetId }) => {
    const room = getRoom(code);
    if (!room || !isAdmin(room, playerId)) return;
    const t = room.players.get(targetId);
    if (t && targetId !== room.adminId) {
      io.to(t.socketId).emit("kicked");
      room.players.delete(targetId);
      broadcastState(io, room);
    }
  });

  // ---- OYUNU BAŞLAT ----
  socket.on("startGame", ({ code, playerId }, cb) => {
    const room = getRoom(code);
    if (!room || !isAdmin(room, playerId)) return cb?.({ error: "Yetkin yok." });
    const res = startGame(io, room);
    cb?.(res);
  });

  // ---- DENGE / DOĞRULAMA ----
  socket.on("validate", ({ code }, cb) => {
    const room = getRoom(code);
    if (!room) return cb?.({ error: "Oda yok." });
    cb?.(validateRoleCounts(room));
  });

  // ---- GECE AKSİYONU ----
  socket.on("nightAction", ({ code, playerId, targets, extra }) => {
    const room = getRoom(code);
    if (!room || !authAction(room, playerId, socket.id)) return;
    submitNightAction(io, room, playerId, { targets, extra });
  });

  // ---- GÜNDÜZ AKSİYONU ----
  socket.on("dayAction", ({ code, playerId, targets, extra }) => {
    const room = getRoom(code);
    if (!room || !authAction(room, playerId, socket.id)) return;
    submitDayAction(io, room, playerId, { targets, extra });
  });

  // ---- OY ----
  socket.on("vote", ({ code, playerId, targetId }) => {
    const room = getRoom(code);
    if (!room || !authAction(room, playerId, socket.id)) return;
    castVote(io, room, playerId, targetId);
  });

  // ---- SOHBET ----
  socket.on("chat", ({ code, playerId, text, channel }) => {
    const room = getRoom(code);
    if (!room) return;
    const p = room.players.get(playerId);
    if (!p) return;
    const t = (text || "").slice(0, 400).trim();
    if (!t) return;

    // ölü/ghost -> ölü kanalı
    if (!p.alive) { if (room.settings.deadChat) pushChat(io, room, "dead", p.name, t); return; }
    // gece kurt kanalı
    if (room.phase === "night" && getRole(p.roleId)?.team === "wolf") {
      return pushChat(io, room, "wolf", p.name, t);
    }
    // gündüz susturulmuşsa
    if (p.flags?.mutedDay) return;
    // genel sohbet sadece gündüz/oylama (gece köylüler konuşamaz)
    if (room.phase === "day" || room.phase === "vote" || room.phase === "lobby") {
      pushChat(io, room, "all", p.name, t);
    }
  });

  // ---- BAĞLANTI KOPTU ----
  socket.on("disconnect", () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    // yerel modda tek soket tüm oyuncuları temsil eder; silme, reconnect bekle
    if (room.mode === "local") {
      for (const p of room.players.values()) p.connected = false;
      maybeCleanupRoom(room);
      return;
    }
    player.connected = false;
    // lobide ise odadan çıkar; oyunda ise rolünü koru (reconnect)
    if (room.phase === "lobby") {
      room.players.delete(player.id);
      // admin çıktıysa devret
      if (room.adminId === player.id) {
        const next = [...room.players.values()].find((p) => p.connected);
        room.adminId = next?.id || null;
        if (next) next.isAdmin = true;
      }
    }
    broadcastState(io, room);
    maybeCleanupRoom(room);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`TASA ÇOCUK sunucusu çalışıyor: http://localhost:${PORT}`);
});
