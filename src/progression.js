// Wordforge — character progression.
//  In-run: XP from kills → level up → pick 1 of 3 upgrades (health, damage, projectiles…).
//  Permanent: spend points on Character ranks that carry into every run.
//  Account level: lifetime XP; each account level pays out points.
window.WF = window.WF || {};

WF.baseStats = () => ({ hp: 100, dmg: 1, haste: 1, multi: 0, area: 1, move: 1, magnet: 1, regen: 0, armor: 0, crit: 0.05, luck: 1 });

// in-run upgrade cards
WF.UPGRADES = [
  { id: 'hp',     name: 'Vitality',      icon: 'hp',     desc: '+20 max health, heal 20',         max: 8, apply: (s, r) => { s.hp += 20; r.p.maxHp += 20; r.p.hp = Math.min(r.p.maxHp, r.p.hp + 20); } },
  { id: 'dmg',    name: 'Might',         icon: 'dmg',    desc: '+12% spell damage',               max: 10, apply: s => { s.dmg += 0.12; } },
  { id: 'haste',  name: 'Haste',         icon: 'haste',  desc: 'Spells cast 10% faster',          max: 8, apply: s => { s.haste += 0.10; } },
  { id: 'multi',  name: 'Multicast',     icon: 'multi',  desc: '+1 projectile, blade, jump or ally', max: 3, apply: s => { s.multi += 1; } },
  { id: 'area',   name: 'Reach',         icon: 'area',   desc: '+15% spell area',                 max: 6, apply: s => { s.area += 0.15; } },
  { id: 'move',   name: 'Swiftness',     icon: 'move',   desc: '+8% move speed',                  max: 5, apply: s => { s.move += 0.08; } },
  { id: 'magnet', name: 'Lodestone',     icon: 'magnet', desc: '+40% rune pickup range',          max: 4, apply: s => { s.magnet += 0.4; } },
  { id: 'regen',  name: 'Regeneration',  icon: 'regen',  desc: 'Heal 0.6 health per second',     max: 5, apply: s => { s.regen += 0.6; } },
  { id: 'armor',  name: 'Iron Skin',     icon: 'armor',  desc: 'Take 6% less damage',             max: 6, apply: s => { s.armor = Math.min(0.45, s.armor + 0.06); } },
  { id: 'crit',   name: 'Keen Edge',     icon: 'crit',   desc: '+6% critical chance (×2 damage)', max: 6, apply: s => { s.crit += 0.06; } },
  { id: 'luck',   name: 'Rune Luck',     icon: 'luck',   desc: 'Enemies drop 20% more runes',     max: 4, apply: s => { s.luck += 0.2; } },
];
WF.xpForLevel = lvl => Math.round(8 + lvl * 7 + lvl * lvl * 0.9);

WF.rollUpgrades = function (taken, n = 3) {
  const pool = WF.UPGRADES.filter(u => (taken[u.id] || 0) < u.max);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  return out;
};

// permanent Character ranks (bought with points)
WF.PERKS = [
  { id: 'hp',    name: 'Vitality',  icon: 'hp',    per: '+10 starting health', ranks: 5, apply: (s, n) => { s.hp += 10 * n; } },
  { id: 'dmg',   name: 'Might',     icon: 'dmg',   per: '+5% damage',          ranks: 5, apply: (s, n) => { s.dmg += 0.05 * n; } },
  { id: 'haste', name: 'Haste',     icon: 'haste', per: '+4% cast speed',      ranks: 5, apply: (s, n) => { s.haste += 0.04 * n; } },
  { id: 'move',  name: 'Swiftness', icon: 'move',  per: '+3% move speed',      ranks: 5, apply: (s, n) => { s.move += 0.03 * n; } },
  { id: 'magnet',name: 'Lodestone', icon: 'magnet',per: '+15% pickup range',   ranks: 5, apply: (s, n) => { s.magnet += 0.15 * n; } },
  { id: 'armor', name: 'Iron Skin', icon: 'armor', per: '+3% damage reduction',ranks: 5, apply: (s, n) => { s.armor += 0.03 * n; } },
];
WF.perkCost = rank => 120 + rank * 120; // cost of buying the next rank when you have `rank`

WF.statsForRun = function () {
  const s = WF.baseStats(), owned = WF.Save.data.perks || {};
  for (const pk of WF.PERKS) if (owned[pk.id]) pk.apply(s, owned[pk.id]);
  return s;
};

// account level from lifetime XP
WF.accountLevel = xp => Math.floor(Math.sqrt((xp || 0) / 60)) + 1;
WF.accountProgress = xp => {
  const L = WF.accountLevel(xp), a = (L - 1) ** 2 * 60, b = L ** 2 * 60;
  return { level: L, frac: (xp - a) / (b - a), next: b - xp };
};
