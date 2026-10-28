// Wordforge — daily challenges. Three per day, seeded by date (same for every player),
// progress accumulates across runs that day, rewards are points.
window.WF = window.WF || {};

WF.CHALLENGES = [
  { id: 'kills',    text: 'Slay 250 enemies',                  stat: 'kills',     target: 250, reward: 100 },
  { id: 'kills2',   text: 'Slay 600 enemies',                  stat: 'kills',     target: 600, reward: 220 },
  { id: 'elites',   text: 'Defeat 2 elites',                   stat: 'elites',    target: 2,   reward: 140 },
  { id: 'wave7',    text: 'Reach the Storm Spire (wave 7)',    stat: 'wave',      target: 7,   reward: 160, max: true },
  { id: 'wave4',    text: 'Reach the Frozen Archive (wave 4)', stat: 'wave',      target: 4,   reward: 80,  max: true },
  { id: 'forge',    text: 'Forge 6 spells',                    stat: 'forge',     target: 6,   reward: 80 },
  { id: 'discover', text: 'Discover 3 new spells',             stat: 'discover',  target: 3,   reward: 100 },
  { id: 'runes',    text: 'Collect 40 runes',                  stat: 'runes',     target: 40,  reward: 90 },
  { id: 'burn',     text: 'Kill 60 burning enemies',           stat: 'burnKills', target: 60,  reward: 110 },
  { id: 'nohit',    text: 'Clear a wave without taking damage',stat: 'nohit',     target: 1,   reward: 120 },
  { id: 'wild',     text: 'Forge with a wild rune',            stat: 'wild',      target: 1,   reward: 90 },
  { id: 'legend',   text: 'Forge a legendary spell (★★★★★)',   stat: 'legendary', target: 1,   reward: 150 },
  { id: 'box',      text: 'Open a Rune Cache',                 stat: 'boxes',     target: 1,   reward: 60 },
  { id: 'fireK',    text: 'Kill 100 enemies with Fire spells',  stat: 'el_fire',   target: 100, reward: 110 },
  { id: 'iceK',     text: 'Kill 100 enemies with Ice spells',   stat: 'el_ice',    target: 100, reward: 110 },
  { id: 'stormK',   text: 'Kill 100 enemies with Storm spells', stat: 'el_storm',  target: 100, reward: 110 },
  { id: 'voidK',    text: 'Kill 100 enemies with Void spells',  stat: 'el_void',   target: 100, reward: 110 },
  { id: 'boss',     text: 'Defeat a boss',                     stat: 'bosses',    target: 1,   reward: 200 },
  { id: 'darkK',    text: 'Kill 100 enemies with Dark spells',  stat: 'el_dark',   target: 100, reward: 110 },
  { id: 'poisonK',  text: 'Kill 100 enemies with Poison spells',stat: 'el_poison', target: 100, reward: 110 },
];

WF.Challenges = {
  onComplete: null, // set by the game (toast + sound)
  today() {
    const d = WF.Save.data, day = WF.dayKey(0);
    if (!d.ch || d.ch.day !== day) {
      // pick 3 distinct, avoiding two of the same stat
      const picked = [], stats = new Set();
      let h = WF.hash('ch:' + day);
      while (picked.length < 3) {
        const c = WF.CHALLENGES[h % WF.CHALLENGES.length];
        if (!stats.has(c.stat)) { picked.push({ id: c.id, p: 0, done: false }); stats.add(c.stat); }
        h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
      }
      d.ch = { day, items: picked };
      WF.Save.save();
    }
    return d.ch.items.map(it => Object.assign({}, WF.CHALLENGES.find(c => c.id === it.id), it));
  },
  bump(stat, amount = 1) { this._apply(stat, v => v + amount); },
  max(stat, value) { this._apply(stat, v => Math.max(v, value)); },
  _apply(stat, fn) {
    const d = WF.Save.data; this.today();
    let changed = false;
    for (const it of d.ch.items) {
      const def = WF.CHALLENGES.find(c => c.id === it.id);
      if (!def || it.done || def.stat !== stat) continue;
      it.p = Math.min(def.target, fn(it.p)); changed = true;
      if (it.p >= def.target) {
        it.done = true;
        d.points = (d.points || 0) + def.reward;
        if (this.onComplete) this.onComplete(def);
      }
    }
    if (changed) this._dirty = true;
  },
  flush() { if (this._dirty) { WF.Save.save(); this._dirty = false; } },
};
