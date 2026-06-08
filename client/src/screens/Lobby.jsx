import { useEffect, useState } from "react";
import { socket, emitAck, SERVER_URL } from "../socket.js";
import Chat from "../components/Chat.jsx";
import { icon, TEAM_META } from "../roleIcons.js";

const TEAM_RING = {
  village: "ring-blue-400/60 bg-blue-500/10",
  wolf: "ring-red-400/60 bg-red-500/10",
  solo_kill: "ring-purple-400/60 bg-purple-500/10",
  solo_vote: "ring-amber-400/60 bg-amber-500/10",
};

export default function Lobby({ state, session, chat, onLeave, setToast }) {
  const [meta, setMeta] = useState(null);
  const isLocal = state.mode === "local";
  const isAdmin = state.adminId === session.playerId;
  const selected = state.selectedRoles || [];
  const playingCount = state.players.filter(
    (p) => isLocal || !(p.isAdmin && !state.settings.adminPlays)
  ).length;
  const threatCount = selected.filter((r) => ["wolf", "solo_kill"].includes(meta?.roles[r]?.team)).length;
  const wolfCount = selected.filter((r) => meta?.roles[r]?.team === "wolf").length;
  const fillVillagers = Math.max(0, playingCount - selected.length);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/roles`).then((r) => r.json()).then(setMeta).catch(() => {});
  }, []);

  function toggle(rid) {
    const next = selected.includes(rid) ? selected.filter((x) => x !== rid) : [...selected, rid];
    socket.emit("setRoles", { code: state.code, playerId: session.playerId, selectedRoles: next });
  }
  function suggest() {
    const wolves = Math.max(1, Math.round(playingCount * 0.28));
    const next = ["seer", "doctor"];
    if (playingCount >= 6) next.push("sheriff");
    if (playingCount >= 7) next.push("witch");
    // birden fazla kurt için kurt + alfa
    const wolfRoles = ["werewolf", "alpha_wolf", "nightmare_wolf", "wolf_seer"];
    for (let i = 0; i < wolves && i < wolfRoles.length; i++) next.push(wolfRoles[i]);
    // oyuncu sayısını aşma
    socket.emit("setRoles", { code: state.code, playerId: session.playerId, selectedRoles: next.slice(0, playingCount) });
  }
  function setSetting(patch) {
    socket.emit("setSettings", { code: state.code, playerId: session.playerId, settings: patch });
  }
  async function start() {
    const res = await emitAck("startGame", { code: state.code, playerId: session.playerId });
    if (res.error) setToast(res.error);
  }
  function kick(id) {
    socket.emit("kickPlayer", { code: state.code, playerId: session.playerId, targetId: id });
  }
  function copyCode() {
    navigator.clipboard?.writeText(state.code).then(() => setToast("Kod kopyalandı!"));
  }

  const valid = selected.length > 0 && playingCount >= 3 && threatCount > 0;
  const reason = playingCount < 3 ? "En az 3 oyuncu gerekli."
    : selected.length === 0 ? "En az bir rol seç."
    : threatCount === 0 ? "En az bir Kurt veya Solo Katil seç." : null;
  const extraHidden = Math.max(0, selected.length - playingCount); // gizli kalacak rol sayısı

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1e1b4b,_#020617)] text-white p-4 pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">{isLocal ? "📱 Tek Cihaz Lobi" : "📱📱 Lobi"}</h1>
            {!isLocal ? (
              <button onClick={copyCode} className="text-indigo-300 text-sm hover:text-white">
                Davet kodu: <span className="font-mono text-xl tracking-widest text-white bg-white/10 px-2 py-0.5 rounded">{state.code}</span> 📋
              </button>
            ) : (
              <p className="text-emerald-300/80 text-sm">Telefonu elden ele dolaştırarak oynanır.</p>
            )}
          </div>
          <button onClick={onLeave} className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">Çık</button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* oyuncular */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <h2 className="font-bold mb-2 flex items-center justify-between">
              <span>👥 Oyuncular</span><span className="text-xs bg-white/10 rounded-full px-2 py-0.5">{state.players.length}</span>
            </h2>
            <ul className="space-y-1.5">
              {state.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 text-sm">
                  <span className={p.connected ? "" : "opacity-40"}>
                    {p.isAdmin ? "👑 " : "🙂 "}{p.name}
                    {p.id === session.playerId && !isLocal && <span className="text-indigo-400"> (sen)</span>}
                  </span>
                  {isAdmin && !isLocal && p.id !== session.playerId && (
                    <button onClick={() => kick(p.id)} className="text-red-400 hover:text-red-300 text-xs">at</button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* roller (toggle) */}
          <div className="md:col-span-2 bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h2 className="font-bold">🎭 Roller (aç/kapa)</h2>
              <div className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${valid ? "bg-green-600/30 text-green-300" : "bg-red-600/30 text-red-300"}`}>
                {selected.length} rol · {playingCount} oyuncu{extraHidden > 0 ? ` · ${extraHidden} gizli 🕵️` : ""}
              </div>
            </div>

            <div className="text-xs text-amber-200/90 bg-amber-500/10 rounded-lg px-3 py-2 mb-3 leading-relaxed">
              💡 <b>Gizli Rol Havuzu:</b> İstediğin kadar rol aç. Oyunda oyuncu sayısı kadar rol <b>rastgele</b> dağıtılır.
              {extraHidden > 0
                ? <> Şu an <b>{extraHidden} rol gizli kalacak</b> — kimse hangi rollerin dışarıda kaldığını bilmez (meta oluşmaz, tahmin zorlaşır). 🕵️</>
                : fillVillagers > 0
                  ? <> Seçili rol az; kalan <b>{fillVillagers} kişi Köylü</b> olur. Daha fazla rol açarsan havuz gizlenir.</>
                  : <> Tam denge: seçtiğin roller birebir dağıtılır.</>}
              {" "}Önerilen kurt ~%28 ≈ <b>{Math.max(1, Math.round(playingCount * 0.28))}</b> (seçili {wolfCount}).
            </div>

            {!isAdmin && <p className="text-sm text-slate-400 mb-2">Rolleri admin seçiyor…</p>}
            {isAdmin && (
              <button onClick={suggest} className="mb-3 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold">✨ Önerilen seti seç</button>
            )}

            <div className="max-h-[46vh] overflow-y-auto pr-1 space-y-3">
              {meta?.groups.map((grp) => (
                <div key={grp.team}>
                  <div className="text-xs uppercase tracking-wide mb-1 flex items-center gap-1" style={{ color: TEAM_META[grp.team].color }}>
                    {TEAM_META[grp.team].emoji} {grp.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {grp.roles.map((rid) => {
                      const r = meta.roles[rid];
                      const on = selected.includes(rid);
                      return (
                        <button key={rid} disabled={!isAdmin} onClick={() => toggle(rid)}
                          className={`flex items-start gap-2 rounded-xl px-2.5 py-2 ring-1 transition text-left
                            ${on ? `ring-2 ${TEAM_RING[r.team]}` : "ring-white/10 bg-black/20 hover:bg-black/30"} ${!isAdmin && "opacity-90"}`}>
                          <span className="text-2xl shrink-0 leading-none mt-0.5">{icon(rid)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="text-sm font-semibold block">{r.name}</span>
                            <span className="text-[11px] leading-snug block opacity-70 mt-0.5">{r.desc}</span>
                          </span>
                          <Switch on={on} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ayarlar + başlat */}
        {isAdmin && (
          <div className="mt-4 bg-white/5 rounded-2xl p-4 border border-white/10">
            <h2 className="font-bold mb-3">⚙️ Ayarlar</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {!isLocal && <>
                <Num label="Gece (sn)" value={state.settings.nightDuration} onChange={(v) => setSetting({ nightDuration: v })} />
                <Num label="Tartışma (sn)" value={state.settings.discussionDuration} onChange={(v) => setSetting({ discussionDuration: v })} />
                <Num label="Oylama (sn)" value={state.settings.voteDuration} onChange={(v) => setSetting({ voteDuration: v })} />
              </>}
              <Toggle label="Ölünce rol açıklansın" value={state.settings.revealRoleOnDeath} onChange={(v) => setSetting({ revealRoleOnDeath: v })} />
              {!isLocal && <Toggle label="Ölü sohbeti" value={state.settings.deadChat} onChange={(v) => setSetting({ deadChat: v })} />}
            </div>
            <button onClick={start} disabled={!valid}
              className="mt-4 w-full py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg">
              🎬 Oyunu Başlat
            </button>
            {!valid && <p className="text-center text-red-300 text-xs mt-2">{reason}</p>}
          </div>
        )}

        {!isLocal && (
          <div className="mt-4">
            <Chat chat={chat} state={state} session={session} channel="all" title="💬 Lobi Sohbeti" />
          </div>
        )}
      </div>
    </div>
  );
}

function Switch({ on }) {
  return (
    <span className={`w-10 h-6 rounded-full p-0.5 shrink-0 transition ${on ? "bg-indigo-500" : "bg-slate-600"}`}>
      <span className={`block w-5 h-5 rounded-full bg-white transition ${on ? "translate-x-4" : ""}`} />
    </span>
  );
}
function Num({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-slate-400 text-xs">{label}</span>
      <input type="number" min={5} max={600} value={value} onChange={(e) => onChange(Math.max(5, +e.target.value || 0))}
        className="px-2 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 outline-none" />
    </label>
  );
}
function Toggle({ label, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${value ? "bg-indigo-600/30 border-indigo-400" : "bg-black/30 border-white/10"}`}>
      <span className="text-xs">{label}</span><Switch on={value} />
    </button>
  );
}
