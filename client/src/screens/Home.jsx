import { useState } from "react";
import { emitAck } from "../socket.js";

export default function Home({ onJoined, setToast }) {
  const [screen, setScreen] = useState("mode"); // mode | online | local
  const [mode, setMode] = useState(null);       // create | join
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [names, setNames] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return setToast("Takma ad gir.");
    setBusy(true);
    const res = await emitAck("createRoom", { name: name.trim() });
    setBusy(false);
    if (res.error) return setToast(res.error);
    onJoined({ code: res.code, playerId: res.playerId, name: name.trim() });
  }
  async function join() {
    if (!name.trim()) return setToast("Takma ad gir.");
    if (!code.trim()) return setToast("Davet kodu gir.");
    setBusy(true);
    const res = await emitAck("joinRoom", { code: code.trim().toUpperCase(), name: name.trim() });
    setBusy(false);
    if (res.error) return setToast(res.error);
    onJoined({ code: res.code, playerId: res.playerId, name: name.trim() });
  }
  async function createLocal() {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (clean.length < 3) return setToast("En az 3 oyuncu adı gir.");
    setBusy(true);
    const res = await emitAck("createLocalRoom", { names: clean });
    setBusy(false);
    if (res.error) return setToast(res.error);
    onJoined({ code: res.code, playerId: res.playerId, name: clean[0], mode: "local" });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1e1b4b,_#020617)] text-white flex flex-col items-center justify-center p-5">
      <div className="text-center mb-7 animate-pop">
        <div className="text-7xl mb-1 drop-shadow-[0_0_25px_rgba(99,102,241,0.6)]">🐺</div>
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">TASA ÇOCUK</h1>
        <p className="text-indigo-300/80 mt-2 text-sm">Köylü · Kurt Adam · Solo Katiller</p>
      </div>

      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl rounded-3xl p-5 shadow-2xl border border-white/10">
        {/* MOD SEÇİMİ */}
        {screen === "mode" && (
          <div className="space-y-3 animate-pop">
            <h2 className="text-center text-sm text-indigo-300 mb-1">Nasıl oynamak istersin?</h2>
            <button onClick={() => setScreen("online")}
              className="w-full p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:scale-[1.02] transition text-left shadow-lg">
              <div className="text-2xl mb-1">📱📱 Çok Cihaz</div>
              <div className="text-xs text-indigo-200">Herkes kendi telefonundan · davet kodu ile online</div>
            </button>
            <button onClick={() => setScreen("local")}
              className="w-full p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 hover:scale-[1.02] transition text-left shadow-lg">
              <div className="text-2xl mb-1">📱 Tek Cihaz</div>
              <div className="text-xs text-emerald-100">Tek telefon elden ele · oyuncu adlarını gir, sırayla oyna</div>
            </button>
          </div>
        )}

        {/* ONLINE */}
        {screen === "online" && (
          <div className="animate-pop">
            <BackBtn onClick={() => { setScreen("mode"); setMode(null); }} />
            <label className="block text-xs text-indigo-300 mb-1">Takma ad</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Adın..." maxLength={16}
              className="w-full mb-4 px-4 py-3 rounded-xl bg-slate-900/80 border border-white/10 outline-none focus:border-indigo-400" />
            {mode !== "join" ? (
              <>
                <button onClick={create} disabled={busy} className="w-full mb-3 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-50 transition">🏠 Oda Kur</button>
                <button onClick={() => setMode("join")} className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-semibold transition">🔑 Odaya Katıl</button>
              </>
            ) : (
              <>
                <label className="block text-xs text-indigo-300 mb-1">Davet kodu</label>
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6 haneli kod" maxLength={6}
                  className="w-full mb-4 px-4 py-3 rounded-xl bg-slate-900/80 border border-white/10 outline-none focus:border-indigo-400 tracking-[0.3em] text-center font-mono text-lg" />
                <button onClick={join} disabled={busy} className="w-full mb-3 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-50 transition">Katıl</button>
                <button onClick={() => setMode(null)} className="w-full py-2 text-sm text-indigo-300 hover:text-white">← Geri</button>
              </>
            )}
          </div>
        )}

        {/* LOCAL */}
        {screen === "local" && (
          <div className="animate-pop">
            <BackBtn onClick={() => setScreen("mode")} />
            <label className="block text-xs text-emerald-300 mb-2">Oyuncu adları (en az 3)</label>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {names.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input value={n} onChange={(e) => { const c = [...names]; c[i] = e.target.value; setNames(c); }}
                    placeholder={`Oyuncu ${i + 1}`} maxLength={16}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 outline-none focus:border-emerald-400" />
                  {names.length > 3 && (
                    <button onClick={() => setNames(names.filter((_, j) => j !== i))} className="px-3 rounded-xl bg-red-600/30 text-red-300">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setNames([...names, ""])} disabled={names.length >= 20}
              className="w-full mt-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 disabled:opacity-40">+ Oyuncu ekle</button>
            <button onClick={createLocal} disabled={busy}
              className="w-full mt-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold disabled:opacity-50 transition">▶️ Devam</button>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-xs mt-6">Türkçe · Mobil uyumlu</p>
    </div>
  );
}

function BackBtn({ onClick }) {
  return <button onClick={onClick} className="mb-3 text-sm text-slate-400 hover:text-white">← Geri</button>;
}
