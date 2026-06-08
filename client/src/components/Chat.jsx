import { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";

// channel: "all" | "wolf" | "dead" — sunucu mesajı doğru kanalda yayınlar.
export default function Chat({ chat, state, session, channel = "all", title = "Sohbet", disabled, hint }) {
  const [text, setText] = useState("");
  const boxRef = useRef(null);
  const filtered = chat.filter((m) => (channel === "all" ? m.channel === "all" : m.channel === channel));

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [filtered.length]);

  function send(e) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    socket.emit("chat", { code: state.code, playerId: session.playerId, text: text.trim(), channel });
    setText("");
  }

  const tone = channel === "wolf" ? "border-red-500/40" : channel === "dead" ? "border-slate-400/30" : "border-white/10";

  return (
    <div className={`bg-black/30 rounded-2xl border ${tone} flex flex-col`}>
      <div className="px-3 py-2 text-xs font-semibold text-slate-300 border-b border-white/10 flex justify-between">
        <span>{title}</span>
        {hint && <span className="text-slate-500">{hint}</span>}
      </div>
      <div ref={boxRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-sm min-h-[120px] max-h-[34vh]">
        {filtered.length === 0 && <p className="text-slate-500 text-xs">Henüz mesaj yok.</p>}
        {filtered.map((m, i) => (
          <div key={i} className="leading-snug">
            <span className={`font-semibold ${channel === "wolf" ? "text-red-300" : channel === "dead" ? "text-slate-300" : "text-indigo-300"}`}>{m.name}: </span>
            <span className="text-slate-100 break-words">{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-2 flex gap-2 border-t border-white/10">
        <input value={text} onChange={(e) => setText(e.target.value)} disabled={disabled}
          placeholder={disabled ? "Şu an yazamazsın" : "Mesaj yaz..."} maxLength={400}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-900/80 border border-white/10 outline-none disabled:opacity-50" />
        <button disabled={disabled} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40">Gönder</button>
      </form>
    </div>
  );
}
