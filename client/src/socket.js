import { io } from "socket.io-client";

// Sunucu adresi: canlıda VITE_SERVER_URL ile verilir, yoksa yerelde 3001.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${location.hostname}:3001`;

export const socket = io(SERVER_URL, { autoConnect: true, transports: ["websocket", "polling"] });

// Promise tabanlı emit (callback ack ile)
export function emitAck(event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res) => resolve(res || {}));
  });
}
