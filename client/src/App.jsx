import { useEffect, useState, useCallback } from "react";
import { socket, emitAck } from "./socket.js";
import Home from "./screens/Home.jsx";
import Lobby from "./screens/Lobby.jsx";
import Game from "./screens/Game.jsx";
import LocalGame from "./screens/LocalGame.jsx";

const LS_KEY = "tasa_session";

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
  });
  const [state, setState] = useState(null); // sunucudan gelen kişisel state
  const [chat, setChat] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState(null);

  const saveSession = useCallback((s) => {
    setSession(s);
    if (s) localStorage.setItem(LS_KEY, JSON.stringify(s));
    else localStorage.removeItem(LS_KEY);
  }, []);

  // socket olayları
  useEffect(() => {
    const onState = (s) => setState(s);
    const onChat = (m) => setChat((c) => [...c.slice(-200), m]);
    const onConnect = () => {
      setConnected(true);
      // reconnect dene
      const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (s?.code && s?.playerId) {
        emitAck("reconnectPlayer", { code: s.code, playerId: s.playerId }).then((res) => {
          if (res.error) { localStorage.removeItem(LS_KEY); setSession(null); }
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onKicked = () => { saveSession(null); setState(null); setToast("Odadan atıldın."); };

    socket.on("state", onState);
    socket.on("chat", onChat);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("kicked", onKicked);
    return () => {
      socket.off("state", onState); socket.off("chat", onChat);
      socket.off("connect", onConnect); socket.off("disconnect", onDisconnect);
      socket.off("kicked", onKicked);
    };
  }, [saveSession]);

  const leave = useCallback(() => { saveSession(null); setState(null); setChat([]); }, [saveSession]);

  // ekran yönlendirme
  let screen;
  if (!session || !state) {
    screen = <Home onJoined={(s) => { saveSession(s); setChat([]); }} setToast={setToast} />;
  } else if (state.phase === "lobby") {
    screen = <Lobby state={state} session={session} chat={chat} onLeave={leave} setToast={setToast} />;
  } else if (state.mode === "local") {
    screen = <LocalGame state={state} session={session} onLeave={leave} setToast={setToast} />;
  } else {
    screen = <Game state={state} session={session} chat={chat} onLeave={leave} setToast={setToast} />;
  }

  return (
    <div className="min-h-full">
      {!connected && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white text-center text-sm py-1">
          Bağlantı koptu, yeniden bağlanılıyor…
        </div>
      )}
      {toast && (
        <div className="fixed top-3 inset-x-0 z-50 flex justify-center" onClick={() => setToast(null)}>
          <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-sm animate-pop">{toast}</div>
        </div>
      )}
      {screen}
    </div>
  );
}
