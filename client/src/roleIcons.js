// Rol görselleri (emoji) ve takım renkleri — görsellik için.
export const ROLE_ICONS = {
  villager: "🧑‍🌾", seer: "🔮", aura_seer: "✨", sheriff: "🔎", detective: "🕵️",
  doctor: "⚕️", bodyguard: "🛡️", tough_guy: "🥊", witch: "🧙‍♀️", jailer: "🔒",
  mayor: "🎖️", priest: "⛪", gunner: "🔫", marksman: "🎯", medium: "🔯",
  flower_child: "🌸", pacifist: "🕊️", manipulator: "🎭",
  werewolf: "🐺", wolf_seer: "🐺🔮", alpha_wolf: "🐺👑", nightmare_wolf: "🌑",
  guardian_wolf: "🐺🛡️", shadow_wolf: "👤", voodoo_wolf: "🪆", wolf_shaman: "🐺📿",
  junior_werewolf: "🐶",
  serial_killer: "🔪", arsonist: "🔥", bomber: "💣", corruptor: "☣️",
  cannibal: "🍖", bandit: "🤠", illusionist: "🪄",
  fool: "🤡", headhunter: "🏹", anarchist: "🏴", gambler: "🎲",
};

export const TEAM_META = {
  village: { name: "Köylü", color: "#3b82f6", emoji: "🏡", grad: "from-blue-600 to-blue-800" },
  wolf: { name: "Kurt Adam", color: "#ef4444", emoji: "🐺", grad: "from-red-600 to-red-900" },
  solo_kill: { name: "Solo Katil", color: "#a855f7", emoji: "🔪", grad: "from-purple-600 to-purple-900" },
  solo_vote: { name: "Solo Oylama", color: "#f59e0b", emoji: "🎲", grad: "from-amber-500 to-amber-700" },
};

export const icon = (id) => ROLE_ICONS[id] || "❓";
