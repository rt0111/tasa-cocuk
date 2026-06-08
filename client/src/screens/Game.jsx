import { useEffect, useMemo, useState } from "react";
import { socket } from "../socket.js";
import Timer from "../components/Timer.jsx";
import PlayerGrid from "../components/PlayerGrid.jsx";
import Chat from "../components/Chat.jsx";
import { icon } from "../roleIcons.js";
import { SERVER_URL } from "../socket.js";

export default function Game({ state, session, chat, onLeave, setToast }) {
  const [meta, setMeta] = useState(null);
  const [showRole, setShowRole] = useState(true);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/roles`).then((r) => r.json()).then(setMeta).catch(() => {});
  }, []);

  const g = state.game;
  const you = state.you;
  const me = state.players.find((p) => p.id === session.playerId);
  const phase = state.phase;
  const isNight = phase === "night";
  const isDead = you && !you.alive;

  // Giriş ekranıyla aynı koyu palet; gündüz hafif sıcak vurgu.
  const themeBg = isNight
    ? "bg-[radial-gradient(ellipse_at_top,_#1e1b4b,_#020617)]"
    : "bg-[radial-gradient(ellipse_at_top,_#3a2a4d,_#0b0a1f)]";

  const send = (event, payload) => socket.emit(event, { code: state.code, playerId: session.playerId, ...payload });

  return (
    <div className={`min-h-screen ${themeBg} text-white transition-colors`}>
      <div className="max-w-5xl mx-auto p-4">
        {/* üst bar */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-70">{state.code} · Gün {g?.dayNumber || 1}</div>
            <h1 className="text-xl font-black flex items-center gap-2">
              {phase === "night" && "🌙 Gece"}
              {phase === "day" && "☀️ Gündüz"}
              {phase === "vote" && "🗳️ Oylama"}
              {phase === "ended" && "🏁 Oyun Bitti"}
            </h1>
          </div>
          {g?.phaseEndsAt && phase !== "ended" && <Timer endsAt={g.phaseEndsAt} />}
          <div className="flex gap-1.5">
            <button onClick={() => setShowLog((s) => !s)} className="text-xs px-2.5 py-1.5 rounded-lg bg-black/20 hover:bg-black/30">📜</button>
            <button onClick={onLeave} className="text-xs px-2.5 py-1.5 rounded-lg bg-black/20 hover:bg-black/30">Çık</button>
          </div>
        </div>

        {/* rol kartı */}
        {you?.role && (
          <RoleCard you={you} meta={meta} show={showRole} onToggle={() => setShowRole((s) => !s)} dead={isDead} />
        )}

        {/* açıklama / duyuru */}
        {g?.announcement && phase !== "ended" && (
          <div className="my-3 px-4 py-3 rounded-xl bg-black/20 text-center font-medium animate-pop">
            {g.announcement}
          </div>
        )}

        {/* özel bilgi (kahin sonucu vb.) */}
        {g?.privateInfo?.length > 0 && (
          <div className="my-3 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-sm space-y-1">
            {g.privateInfo.map((m, i) => <div key={i}>{m}</div>)}
          </div>
        )}

        {/* FAZ İÇERİĞİ */}
        {phase === "ended" ? (
          <EndScreen state={state} session={session} meta={meta} />
        ) : (
          <div className="grid lg:grid-cols-3 gap-4 mt-2">
            <div className="lg:col-span-2 space-y-4">
              {isDead && (
                <div className="px-4 py-3 rounded-xl bg-slate-700/40 text-center text-sm">
                  👻 Öldün — artık izleyicisin. Aşağıdan ölüler sohbetine yazabilirsin.
                </div>
              )}

              {/* GECE */}
              {isNight && !isDead && (
                <NightPanel state={state} you={you} me={me} meta={meta} send={send} setToast={setToast} />
              )}

              {/* GÜNDÜZ */}
              {phase === "day" && !isDead && (
                <DayPanel state={state} you={you} meta={meta} send={send} />
              )}

              {/* OYLAMA */}
              {phase === "vote" && !isDead && (
                <VotePanel state={state} you={you} session={session} meta={meta} send={send} />
              )}

              {/* ölüler için izleme ızgarası */}
              {isDead && (
                <div className="bg-black/20 rounded-2xl p-3">
                  <h3 className="text-sm font-semibold mb-2 opacity-70">Oyuncular</h3>
                  <PlayerGrid players={state.players} meId={session.playerId} voteCounts={g?.voteCounts} votesShown={phase === "vote"} />
                </div>
              )}
            </div>

            {/* sağ kolon: sohbetler */}
            <div className="space-y-3">
              {/* kurt gece sohbeti */}
              {isNight && you?.role?.team === "wolf" && !isDead && (
                <Chat chat={chat} state={state} session={session} channel="wolf" title="🐺 Kurt Sohbeti" hint="sadece kurtlar" />
              )}
              {/* genel sohbet (gündüz/oylama) */}
              {(phase === "day" || phase === "vote") && !isDead && (
                <Chat chat={chat} state={state} session={session} channel="all" title="🏘️ Köy Meydanı"
                  disabled={!!you?.flags?.mutedDay}
                  hint={you?.flags?.mutedDay ? "susturuldun" : null} />
              )}
              {/* ölü sohbeti */}
              {(isDead || you?.role?.id === "medium") && state.settings.deadChat && (
                <Chat chat={chat} state={state} session={session} channel="dead" title="👻 Ölüler Sohbeti" />
              )}
            </div>
          </div>
        )}

        {/* log paneli */}
        {showLog && <LogPanel state={state} onClose={() => setShowLog(false)} />}
      </div>
    </div>
  );
}

/* ----------------- ROL KARTI ----------------- */
function RoleCard({ you, meta, show, onToggle, dead }) {
  const r = you.role;
  return (
    <div className="rounded-2xl p-3 border animate-pop" style={{ borderColor: r.teamColor + "66", background: r.teamColor + "14" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{show ? icon(r.id) : "🎭"}</span>
          <div>
            <div className="font-black">{show ? r.name : "•••••"} {dead && "💀"}</div>
            <div className="text-xs" style={{ color: r.teamColor }}>{show ? r.teamName : ""}</div>
          </div>
        </div>
        <button onClick={onToggle} className="text-xs px-2 py-1 rounded bg-black/20">{show ? "gizle" : "göster"}</button>
      </div>
      {show && <p className="text-sm mt-2 opacity-90">{r.desc}</p>}
    </div>
  );
}

/* ----------------- GECE PANELİ ----------------- */
function NightPanel({ state, you, me, meta, send, setToast }) {
  const [sel, setSel] = useState([]);
  const [mode, setMode] = useState(null); // özel modlar
  const [submitted, setSubmitted] = useState(false);
  const roleMeta = meta?.roles[you.role.id];
  const night = roleMeta?.night;
  const g = state.game;

  useEffect(() => { setSel([]); setSubmitted(false); setMode(null); }, [g?.dayNumber]);

  if (you.flags?.jailed) {
    return <Panel title="🌙 Gece"><p className="text-center text-sm opacity-80">🔒 Bu gece hapsedildin, yeteneğini kullanamazsın.</p></Panel>;
  }
  if (!night) {
    return <Panel title="🌙 Gece"><p className="text-center text-sm opacity-80">Gece yeteneğin yok. Köy uyuyor… 💤</p>
      <PlayerGrid players={state.players} meId={you.id} /></Panel>;
  }

  const need = night.targets;
  function pick(id) {
    setSel((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= need) return need === 1 ? [id] : cur;
      return [...cur, id];
    });
  }
  function submit(extra = {}) {
    send("nightAction", { targets: sel, extra: { ...extra, ...(mode ? { [mode]: true } : {}) } });
    setSubmitted(true);
    setToast("Gece hamlen kaydedildi.");
  }

  const targets = state.players; // canlı seçimi PlayerGrid hallediyor

  return (
    <Panel title={`🌙 Gece — ${you.role.name}`}>
      <p className="text-sm mb-2 opacity-90">{night.label}</p>
      <PlayerGrid players={targets} meId={you.id} selectable selected={sel} onSelect={pick} />

      {/* özel mod butonları */}
      <div className="flex flex-wrap gap-2 mt-3">
        {night.potions && (<>
          <ModeBtn active={mode === "heal"} onClick={() => setMode(mode === "heal" ? null : "heal")} disabled={(you.uses?.heal || 0) >= 1}>🧪 Can İksiri</ModeBtn>
          <ModeBtn active={mode === "poison"} onClick={() => setMode(mode === "poison" ? null : "poison")} disabled={(you.uses?.poison || 0) >= 1}>☠️ Zehir</ModeBtn>
        </>)}
        {night.douseOrIgnite && (
          <ModeBtn active={mode === "ignite"} onClick={() => setMode(mode === "ignite" ? null : "ignite")}>🔥 YAK (tümünü)</ModeBtn>
        )}
        {night.charge && (<>
          <ModeBtn active={mode === "charge"} onClick={() => setMode(mode === "charge" ? null : "charge")}>⚡ Hak biriktir</ModeBtn>
          <ModeBtn active={mode === "feast"} onClick={() => setMode(mode === "feast" ? null : "feast")}>🍖 Katliam</ModeBtn>
        </>)}
        {night.recruit && (
          <ModeBtn active={mode === "recruit"} onClick={() => setMode(mode === "recruit" ? null : "recruit")}>🤝 Yardımcı yap</ModeBtn>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        {!submitted && (
          <button
            onClick={() => { send("nightAction", { targets: [], extra: {} }); setSubmitted(true); setToast("Pas geçtin."); }}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-semibold">
            Pas geç
          </button>
        )}
        <button
          onClick={() => submit({ execute: night.canExecute && mode === "execute" })}
          disabled={submitted || (need > 0 && sel.length < need && mode !== "ignite")}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-40">
          {submitted ? "✓ Gönderildi — diğerleri bekleniyor" : "Onayla"}
        </button>
        {night.canExecute && (
          <ModeBtn active={mode === "execute"} onClick={() => setMode(mode === "execute" ? null : "execute")}>⚔️ İnfaz et</ModeBtn>
        )}
      </div>
      {you.role.team === "wolf" && night.wolfPack && (
        <p className="text-xs text-red-300 mt-2">Kurt ekibi ortak hedefi en çok oy alan kişidir. Sohbetten anlaşın.</p>
      )}
    </Panel>
  );
}

/* ----------------- GÜNDÜZ PANELİ ----------------- */
function DayPanel({ state, you, meta, send }) {
  const [sel, setSel] = useState([]);
  const roleMeta = meta?.roles[you.role.id];
  const day = roleMeta?.day;
  const canShoot = day && you.role.id === "gunner" && (you.uses?.shoot || 0) < 2;
  const canSave = day && you.role.id === "flower_child" && (you.uses?.save || 0) < 1;

  return (
    <Panel title="☀️ Gündüz — Tartışma">
      <p className="text-sm opacity-80 mb-2">Olayları tartışın. Süre dolunca oylama başlar.</p>
      <PlayerGrid players={state.players} meId={you.id}
        selectable={!!day && (canShoot || canSave)} selected={sel}
        onSelect={(id) => setSel([id])} />
      {canShoot && (
        <button onClick={() => sel[0] && send("dayAction", { targets: sel })}
          disabled={!sel[0]} className="mt-3 w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-bold disabled:opacity-40">
          🔫 Ateş et ({2 - (you.uses?.shoot || 0)} mermi)
        </button>
      )}
      {canSave && (
        <button onClick={() => sel[0] && send("dayAction", { targets: sel })}
          disabled={!sel[0]} className="mt-3 w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold disabled:opacity-40">
          🌸 Linçten koru
        </button>
      )}
    </Panel>
  );
}

/* ----------------- OYLAMA PANELİ ----------------- */
function VotePanel({ state, you, session, meta, send }) {
  const g = state.game;
  const myVote = state.players.find((p) => p.id === session.playerId)?.voteFor;
  const canBoost = you.role.id === "manipulator" && (you.uses?.boost || 0) < 1;
  const canStop = you.role.id === "pacifist" && (you.uses?.stop || 0) < 1;
  const [boostSel, setBoostSel] = useState(null);

  return (
    <Panel title="🗳️ Oylama">
      <p className="text-sm opacity-80 mb-2">Linç edilecek kişiyi seç. {you.flags?.cantVote && "(oy kullanamıyorsun)"}</p>
      <PlayerGrid players={state.players} meId={you.id} selectable={!you.flags?.cantVote}
        selected={myVote ? [myVote] : []} onSelect={(id) => send("vote", { targetId: id })}
        voteCounts={g?.voteCounts} votesShown />
      <div className="flex flex-wrap gap-2 mt-3">
        {canStop && (
          <button onClick={() => send("dayAction", {})} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold">
            ✋ Oylamayı durdur (Barışçıl)
          </button>
        )}
        {canBoost && (
          <div className="flex items-center gap-2">
            <select value={boostSel || ""} onChange={(e) => setBoostSel(e.target.value)}
              className="px-2 py-2 rounded-lg bg-slate-900/80 border border-white/10 text-sm">
              <option value="">+2 oy verilecek kişi…</option>
              {state.players.filter((p) => p.alive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => boostSel && send("dayAction", { targets: [boostSel] })}
              disabled={!boostSel} className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-semibold disabled:opacity-40">
              ⬆️ Güçlendir
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ----------------- OYUN SONU ----------------- */
function EndScreen({ state, session, meta }) {
  const g = state.game;
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl p-6 bg-black/30 text-center animate-pop">
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="text-2xl font-black">{g?.winnerText || "Oyun bitti"}</h2>
      </div>
      <div className="bg-black/20 rounded-2xl p-4">
        <h3 className="font-bold mb-2">Roller</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {state.players.filter((p) => !p.isSpectator).map((p) => (
            <div key={p.id} className="rounded-lg px-3 py-2 bg-white/5 text-sm">
              <div className="font-semibold">{p.name} {!p.alive && "💀"}</div>
              <div className="text-xs" style={{ color: p.role?.teamColor }}>{p.role?.name || "?"}</div>
            </div>
          ))}
        </div>
      </div>
      <LogList state={state} />
    </div>
  );
}

/* ----------------- LOG ----------------- */
function LogPanel({ state, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-2xl p-4 max-w-md w-full max-h-[70vh] overflow-y-auto border border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-white">📜 Oyun Günlüğü</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <LogList state={state} />
      </div>
    </div>
  );
}
function LogList({ state }) {
  const log = state.log || [];
  return (
    <div className="space-y-1 text-sm text-slate-300">
      {log.length === 0 && <p className="text-slate-500">Henüz olay yok.</p>}
      {log.map((e, i) => (
        <div key={i} className="border-l-2 border-indigo-500/40 pl-2">
          <span className="text-xs text-slate-500">G{e.day} · {e.phase}</span> — {e.text}
        </div>
      ))}
    </div>
  );
}

/* ----------------- küçük UI ----------------- */
function Panel({ title, children }) {
  return (
    <div className="bg-black/20 rounded-2xl p-4 border border-white/10">
      <h3 className="font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}
function ModeBtn({ active, onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-30
        ${active ? "bg-indigo-500 text-white ring-2 ring-indigo-300" : "bg-black/30 hover:bg-black/40"}`}>
      {children}
    </button>
  );
}
