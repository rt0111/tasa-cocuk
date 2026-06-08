// Oda deposu - tüm odalar sunucu hafızasında (in-memory).
import { customAlphabet } from "nanoid";

// Karışık olmayan, okunaklı 6 haneli kod (0/O, 1/I yok).
const codeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export const rooms = new Map(); // code -> room

export function genRoomCode() {
  let code;
  do {
    code = codeGen();
  } while (rooms.has(code));
  return code;
}

export function createRoom(adminName, mode = "online") {
  const code = genRoomCode();
  const room = {
    code,
    adminId: null,
    mode,                       // "online" | "local"
    manual: mode === "local",   // yerel modda fazlar elle ilerler (zamanlayıcı yok)
    phase: "lobby", // lobby | night | day | vote | ended
    players: new Map(), // playerId -> player
    settings: {
      nightDuration: 45,
      discussionDuration: 120,
      voteDuration: 30,
      deadChat: true,
      adminPlays: true,        // admin oyuncu olarak da oynar mı
      revealRoleOnDeath: true, // ölünce rol açıklansın mı
      tieRule: "no_lynch",     // no_lynch | revote | random
    },
    selectedRoles: [], // oyuna dahil edilecek rol id'leri (aç/kapa)
    game: null,       // oyun durumu (başlayınca dolar)
    chat: [],         // genel sohbet [{name, text, ts, channel}]
    deadChat: [],     // ölü sohbeti
    log: [],          // oyun günlüğü
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code) {
  return rooms.get((code || "").toUpperCase());
}

export function makePlayer({ id, name, socketId, isAdmin, local }) {
  return {
    id, name, socketId,
    isAdmin: !!isAdmin,
    local: !!local,     // yerel (pass-and-play) oyuncusu — kendi soketi yok
    connected: true,
    isSpectator: false, // admin yönetici-only modunda oynamaz
    // oyun-içi alanlar (başlayınca set edilir)
    roleId: null,
    alive: true,
    isGhost: false,
    flags: {}, // çeşitli durum bayrakları (doused, bombed, mutedDay, vb.)
    uses: {},  // sınırlı yetenek sayaçları
  };
}

// Oda boşaldıysa temizle.
export function maybeCleanupRoom(room) {
  const anyConnected = [...room.players.values()].some((p) => p.connected);
  if (!anyConnected) {
    // 5 dk içinde kimse dönmezse sil
    setTimeout(() => {
      const still = [...room.players.values()].every((p) => !p.connected);
      if (still) rooms.delete(room.code);
    }, 5 * 60 * 1000);
  }
}
