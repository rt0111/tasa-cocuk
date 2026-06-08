import { useEffect, useState } from "react";

export default function Timer({ endsAt }) {
  const [left, setLeft] = useState(calc(endsAt));
  useEffect(() => {
    setLeft(calc(endsAt));
    const t = setInterval(() => setLeft(calc(endsAt)), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (endsAt == null) return null;
  const m = Math.floor(left / 60), s = left % 60;
  const danger = left <= 10;
  return (
    <div className={`font-mono text-lg font-bold tabular-nums ${danger ? "text-red-400 animate-pulse" : ""}`}>
      ⏱ {m}:{String(s).padStart(2, "0")}
    </div>
  );
}
function calc(endsAt) {
  if (endsAt == null) return 0;
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
}
