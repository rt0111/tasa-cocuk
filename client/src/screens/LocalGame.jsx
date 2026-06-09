import { useEffect, useMemo, useState } from "react";
import { socket, SERVER_URL } from "../socket.js";
import { icon, TEAM_META } from "../roleIcons.js";

// Tek cihaz (pass-and-play) akışı: telefon elden ele dolaşır.
export default function LocalGame({ state, session, onLeave, setToast }) {
  const [meta, setMeta] = useState(null);
  const g = state.game;
  const phase = state.phase;
  const lp = state.local?.players || [];
  const code = state.code;
  const send = (action) => socket.emit("hostControl", { code, playerId: session.playerId, action });

  useEffect(() => {
    fetch(`${SERVER_URL}/api/roles`).then((r) => r.json()).then(setMeta).catch(() => {});
  }, []);

  // alt-aşama yönetimi
  const [revealIdx, setRevealIdx] = useState(0);
  const [revealedDay, setRevealedDay] = useState(0); // hangi günde reveal yapıldı
  const [handed, setHanded] = useState(false);       // pass ekranı geçildi mi
  const [actorIdx, setActorIdx] = useState(0);
  const [voteIdx, setVoteIdx] = useState(0);

  // faz değişince alt-aşamayı sıfırla
  useEffect(() => { setHanded(false); setActorIdx(0); setVoteIdx(0); }, [phase, g?.dayNumber]);

  if (!meta) return <Center>Yükleniyor…</Center>;

  // ---- OYUN SONU ----
  if (phase === "ended") return <EndScreen state={state} g={g} onLeave={onLeave}
    onNewGame={() => socket.emit("returnToLobby", { code, playerId: session.playerId })} />;

  // gece aksiyonu olan canlı oyuncular (köylüler uyur, atlanır)
  const nightActors = lp.filter((p) => p.alive && meta.roles[p.roleId]?.night);
  const aliveNames = lp.filter((p) => p.alive).map((p) => ({ id: p.id, name: p.name }));

  // ---------- REVEAL (oyun başı rol gösterimi) ----------
  const needReveal = phase === "night" && g?.dayNumber === 1 && revealedDay !== 1;
  if (needReveal) {
    const p = lp[revealIdx];
    return (
      <Shell phase={phase} g={g} onLeave={onLeave} title="🎭 Rol Dağıtımı">
        {!handed ? (
          <PassScreen name={p.name} note="Diğerleri görmesin!" onReady={() => setHanded(true)} />
        ) : (
          <RoleReveal role={p.role} onNext={() => {
            setHanded(false);
            if (revealIdx + 1 < lp.length) setRevealIdx(revealIdx + 1);
            else { setRevealedDay(1); setRevealIdx(0); }
          }} last={revealIdx + 1 >= lp.length} />
        )}
        <p className="text-center text-xs text-slate-400 mt-4">{revealIdx + 1} / {lp.length}</p>
      </Shell>
    );
  }

  // ---------- GECE ----------
  if (phase === "night") {
    if (actorIdx >= nightActors.length) {
      // tüm görevliler bitti -> otomatik sonuçlandır (süre/buton beklemeden)
      return (
        <Shell phase={phase} g={g} onLeave={onLeave} title="🌙 Gece bitti">
          <AutoResolve onFire={() => send("resolveNight")} />
        </Shell>
      );
    }
    const actor = nightActors[actorIdx];
    const fresh = lp.find((x) => x.id === actor.id); // güncel info
    const wolfmates = fresh.role.team === "wolf"
      ? lp.filter((p) => p.role.team === "wolf").map((p) => ({ name: p.name, role: p.role.name, alive: p.alive }))
      : null;
    // geçerli hedefler: kurt takım arkadaşını, kahin kendini seçemez
    let targetNames = aliveNames;
    if (fresh.role.team === "wolf") {
      const mateIds = new Set(lp.filter((p) => p.role.team === "wolf").map((p) => p.id));
      targetNames = aliveNames.filter((a) => !mateIds.has(a.id));
    } else if (fresh.roleId === "seer") {
      targetNames = aliveNames.filter((a) => a.id !== fresh.id);
    }
    return (
      <Shell phase={phase} g={g} onLeave={onLeave} title={`🌙 Gece ${g.dayNumber}`}>
        {!handed ? (
          <PassScreen name={actor.name} note="Sıra sende — gizli yeteneğini kullan" onReady={() => setHanded(true)} />
        ) : (
          <NightAct player={fresh} meta={meta} aliveNames={targetNames} wolfmates={wolfmates} code={code} session={session}
            onDone={() => { setHanded(false); setActorIdx(actorIdx + 1); }} setToast={setToast} />
        )}
        <p className="text-center text-xs text-slate-400 mt-4">Gece sırası: {actorIdx + 1} / {nightActors.length}</p>
      </Shell>
    );
  }

  // ---------- GÜNDÜZ ----------
  if (phase === "day") {
    return (
      <Shell phase={phase} g={g} onLeave={onLeave} title={`☀️ Gündüz ${g.dayNumber}`}>
        <div className="text-center space-y-4">
          <div className="px-4 py-4 rounded-2xl bg-black/20 text-lg font-medium">{g.announcement}</div>
          <AlivePanel lp={lp} />
          <p className="opacity-80 text-sm">Herkes yüksek sesle tartışsın. Hazır olunca oylamaya geçin.</p>
          <button onClick={() => send("startVote")}
            className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-lg">🗳️ Oylamaya geç</button>
        </div>
      </Shell>
    );
  }

  // ---------- OYLAMA ----------
  if (phase === "vote") {
    // oylama çözüldü mü?
    if (g.awaitingNext) {
      return (
        <Shell phase={phase} g={g} onLeave={onLeave} title="🗳️ Sonuç">
          <div className="text-center space-y-4">
            <div className="px-4 py-4 rounded-2xl bg-black/20 text-lg font-medium">{g.announcement}</div>
            <button onClick={() => send("nextNight")}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-lg">🌙 Sonraki geceye geç</button>
          </div>
        </Shell>
      );
    }
    const voters = lp.filter((p) => p.alive && !p.flags?.cantVote);
    if (voteIdx >= voters.length) {
      return <Shell phase={phase} g={g} onLeave={onLeave} title="🗳️ Oylar sayılıyor…"><Center>Sonuç hesaplanıyor…</Center></Shell>;
    }
    const voter = voters[voteIdx];
    return (
      <Shell phase={phase} g={g} onLeave={onLeave} title="🗳️ Gizli Oylama">
        {!handed ? (
          <PassScreen name={voter.name} note="Kimi asmak istiyorsun?" onReady={() => setHanded(true)} />
        ) : (
          <VoteAct voter={voter} aliveNames={aliveNames.filter((a) => a.id !== voter.id)} code={code} session={session}
            onDone={() => { setHanded(false); setVoteIdx(voteIdx + 1); }} />
        )}
        <p className="text-center text-xs text-slate-400 mt-4">Oy: {voteIdx + 1} / {voters.length}</p>
      </Shell>
    );
  }

  return <Center>…</Center>;
}

/* ---------------- ALT BİLEŞENLER ---------------- */
function Shell({ phase, g, onLeave, title, children }) {
  const night = phase === "night" || phase === "vote";
  return (
    <div className={`min-h-screen ${night ? "bg-[radial-gradient(ellipse_at_top,_#1e1b4b,_#020617)] text-white" : "bg-gradient-to-b from-amber-100 to-orange-200 text-slate-900"} transition-colors`}>
      <div className="max-w-lg mx-auto p-4 min-h-screen flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black">{title}</h1>
          <button onClick={onLeave} className="text-xs px-2.5 py-1.5 rounded-lg bg-black/20 hover:bg-black/30">Çık</button>
        </div>
        <div className="flex-1 flex flex-col justify-center">{children}</div>
      </div>
    </div>
  );
}
function Center({ children }) { return <div className="min-h-screen flex items-center justify-center text-white">{children}</div>; }

// Mount olunca bir kez tetikler (otomatik faz ilerletme).
function AutoResolve({ onFire }) {
  useEffect(() => { const t = setTimeout(onFire, 600); return () => clearTimeout(t); }, []);
  return (
    <div className="text-center animate-pop">
      <div className="text-6xl mb-3 animate-pulse">🌅</div>
      <p className="opacity-80">Tüm gece hamleleri yapıldı. Sabah oluyor…</p>
    </div>
  );
}

function PassScreen({ name, note, onReady }) {
  return (
    <div className="text-center animate-pop">
      <div className="text-5xl mb-3">📱➡️</div>
      <p className="text-sm opacity-70 mb-1">Telefonu şu kişiye ver:</p>
      <h2 className="text-3xl font-black mb-2">{name}</h2>
      <p className="text-sm opacity-70 mb-6">{note}</p>
      <button onClick={onReady} className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-lg">
        Ben {name}, hazırım ✋
      </button>
    </div>
  );
}

function RoleReveal({ role, onNext, last }) {
  const [shown, setShown] = useState(false);
  const tm = TEAM_META[role.team];
  return (
    <div className="text-center animate-pop">
      {!shown ? (
        <button onClick={() => setShown(true)} className="px-8 py-6 rounded-3xl bg-white/10 border border-white/20 text-xl font-bold">
          👁️ Rolünü görmek için dokun
        </button>
      ) : (
        <>
          <div className={`mx-auto max-w-xs rounded-3xl p-6 bg-gradient-to-br ${tm.grad} shadow-2xl`}>
            <div className="text-6xl mb-2">{icon(role.id)}</div>
            <h2 className="text-3xl font-black">{role.name}</h2>
            <div className="text-sm opacity-90 mt-1">{tm.emoji} {role.teamName}</div>
            <p className="text-sm mt-3 opacity-95">{role.desc}</p>
          </div>
          <button onClick={onNext} className="mt-6 px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
            {last ? "🌙 Geceyi başlat" : "Gördüm, sıradakine geç →"}
          </button>
        </>
      )}
    </div>
  );
}

function NamesGrid({ names, selected, onPick, max = 1 }) {
  return (
    <div className="grid grid-cols-2 gap-2 my-3">
      {names.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button key={p.id} onClick={() => onPick(p.id)}
            className={`px-3 py-3 rounded-xl border font-semibold transition ${on ? "bg-indigo-500 border-indigo-300 text-white ring-2 ring-indigo-300" : "bg-white/10 border-white/15 hover:bg-white/20"}`}>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function NightAct({ player, meta, aliveNames, wolfmates, code, session, onDone, setToast }) {
  const night = meta.roles[player.roleId].night;
  const [sel, setSel] = useState([]);
  const [mode, setMode] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const targets = aliveNames; // isimler (rol gizli)
  const need = night.targets;

  // hapis kontrolü
  if (player.flags?.jailed) {
    return <Done text="🔒 Bu gece hapsedildin, hamle yapamazsın." onDone={onDone} />;
  }

  function pick(id) {
    setSel((c) => c.includes(id) ? c.filter((x) => x !== id) : (need === 1 ? [id] : (c.length >= need ? c : [...c, id])));
  }
  function submit() {
    socket.emit("nightAction", { code, playerId: player.id, targets: sel, extra: mode ? { [mode]: true } : {} });
    setSubmitted(true);
  }

  // gönderildiyse: anında sonuç göster (varsa) — güncel state'ten okunur
  if (submitted) {
    return <InfoResult info={player.info} onDone={onDone} />;
  }

  return (
    <div className="animate-pop">
      <div className="text-center mb-2">
        <div className="text-4xl">{icon(player.roleId)}</div>
        <h3 className="font-black text-lg">{player.role.name}</h3>
        <p className="text-sm opacity-80">{night.label}</p>
      </div>
      {wolfmates && wolfmates.length > 0 && (
        <div className="mb-2 px-3 py-2 rounded-xl bg-red-500/15 border border-red-400/40 text-sm text-center">
          🐺 <b>Kurt ekibin:</b> {wolfmates.map((w) => `${w.name}${w.alive ? "" : " 💀"} (${w.role})`).join(", ")}
        </div>
      )}
      {need > 0 && <NamesGrid names={targets} selected={sel} onPick={pick} max={need} />}

      <div className="flex flex-wrap gap-2 justify-center">
        {night.potions && <>
          <Mode active={mode === "heal"} dis={(player.uses?.heal || 0) >= 1} onClick={() => setMode(mode === "heal" ? null : "heal")}>🧪 Can</Mode>
          <Mode active={mode === "poison"} dis={(player.uses?.poison || 0) >= 1} onClick={() => setMode(mode === "poison" ? null : "poison")}>☠️ Zehir</Mode>
        </>}
        {night.douseOrIgnite && <Mode active={mode === "ignite"} onClick={() => setMode(mode === "ignite" ? null : "ignite")}>🔥 YAK</Mode>}
        {night.canExecute && <Mode active={mode === "execute"} onClick={() => setMode(mode === "execute" ? null : "execute")}>⚔️ İnfaz</Mode>}
        {night.recruit && <Mode active={mode === "recruit"} onClick={() => setMode(mode === "recruit" ? null : "recruit")}>🤝 Yardımcı</Mode>}
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => { socket.emit("nightAction", { code, playerId: player.id, targets: [], extra: {} }); onDone(); }}
          className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold">Pas geç</button>
        <button onClick={submit} disabled={need > 0 && sel.length < need && mode !== "ignite"}
          className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-40">Onayla</button>
      </div>
    </div>
  );
}

// gönderim sonrası: güncel state'teki anında bilgiyi gösterir
function InfoResult({ info, onDone }) {
  const has = info && info.length;
  return (
    <div className="text-center animate-pop">
      <div className="text-5xl mb-3">{has ? "🧠" : "✅"}</div>
      <p className="opacity-90 mb-4">{has ? "İşte öğrendiklerin:" : "Hamlen kaydedildi."}</p>
      {has ? (
        <div className="mx-auto max-w-xs rounded-xl bg-indigo-500/20 border border-indigo-400/40 px-4 py-3 text-sm space-y-1">
          {info.map((m, i) => <div key={i}>{m}</div>)}
        </div>
      ) : null}
      <button onClick={onDone} className="mt-5 px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold">Tamam, sıradaki →</button>
    </div>
  );
}

function VoteAct({ voter, aliveNames, code, session, onDone }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="animate-pop">
      <NamesGrid names={aliveNames} selected={sel ? [sel] : []} onPick={(id) => setSel(id)} />
      <div className="flex gap-2 mt-2">
        <button onClick={() => { socket.emit("vote", { code, playerId: voter.id, targetId: "__skip__" }); onDone(); }}
          className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold">Çekimser</button>
        <button onClick={() => { if (sel) { socket.emit("vote", { code, playerId: voter.id, targetId: sel }); onDone(); } }}
          disabled={!sel} className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold disabled:opacity-40">Oyu ver</button>
      </div>
    </div>
  );
}

function AlivePanel({ lp }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {lp.map((p) => (
        <div key={p.id} className={`rounded-xl px-2 py-2 text-sm font-semibold ${p.alive ? "bg-white/40" : "bg-black/20 opacity-50 line-through"}`}>
          {p.alive ? "🙂" : "💀"} {p.name}
        </div>
      ))}
    </div>
  );
}

function EndScreen({ state, g, onLeave, onNewGame }) {
  const lp = state.local?.players || state.players;
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1e1b4b,_#020617)] text-white p-5">
      <div className="max-w-lg mx-auto">
        <div className="rounded-3xl p-6 bg-white/5 text-center animate-pop mb-4">
          <div className="text-6xl mb-2">🏆</div>
          <h2 className="text-2xl font-black">{g?.winnerText || "Oyun bitti"}</h2>
        </div>
        <h3 className="font-bold mb-2">Tüm Roller</h3>
        <div className="grid grid-cols-2 gap-2">
          {lp.map((p) => (
            <div key={p.id} className="rounded-xl px-3 py-2 bg-white/5 flex items-center gap-2">
              <span className="text-2xl">{icon(p.roleId || p.role?.id)}</span>
              <div>
                <div className="font-semibold text-sm">{p.name} {!p.alive && "💀"}</div>
                <div className="text-xs" style={{ color: p.role?.teamColor }}>{p.role?.name}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onNewGame} className="mt-6 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">🔄 Yeni Oyun (Aynı oyuncularla)</button>
        <button onClick={onLeave} className="mt-2 w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold">🏠 Ana menü</button>
      </div>
    </div>
  );
}

function Mode({ active, dis, onClick, children }) {
  return <button onClick={onClick} disabled={dis}
    className={`px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-30 ${active ? "bg-indigo-500 ring-2 ring-indigo-300 text-white" : "bg-black/30 hover:bg-black/40"}`}>{children}</button>;
}
function Done({ text, onDone }) {
  return <div className="text-center animate-pop"><p className="opacity-90 mb-4">{text}</p>
    <button onClick={onDone} className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold">Sıradaki →</button></div>;
}
