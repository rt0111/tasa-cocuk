// Oyuncu kartları ızgarası. Hedef seçimi için selectable + selected destekler.
export default function PlayerGrid({ players, meId, selectable, selected = [], onSelect, voteCounts, votesShown }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {players.map((p) => {
        const isSel = selected.includes(p.id);
        const clickable = selectable && p.alive;
        return (
          <button
            key={p.id}
            disabled={!clickable}
            onClick={() => clickable && onSelect?.(p.id)}
            className={`relative text-left rounded-xl px-3 py-2.5 border transition
              ${p.alive ? "bg-white/5 border-white/10" : "bg-black/30 border-white/5 opacity-50"}
              ${isSel ? "ring-2 ring-indigo-400 bg-indigo-500/20 border-indigo-400" : ""}
              ${clickable ? "hover:bg-white/10 cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold truncate">
                {!p.alive && "💀 "}{p.name}
                {p.id === meId && <span className="text-indigo-400 text-xs"> (sen)</span>}
              </span>
              {voteCounts && voteCounts[p.id] ? (
                <span className="text-xs bg-amber-500/30 text-amber-200 rounded-full px-2 py-0.5 ml-1">{voteCounts[p.id]}</span>
              ) : null}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {p.role ? <span style={{ color: p.role.teamColor }}>{p.role.name}</span> : (p.alive ? "—" : "öldü")}
              {!p.connected && <span className="text-red-400"> · kopuk</span>}
            </div>
            {votesShown && p.voteFor && (
              <div className="text-[10px] text-amber-300 mt-0.5">→ oy verdi</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
