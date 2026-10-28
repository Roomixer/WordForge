// Wordforge — lifetime stats and milestone challenges. Milestones are permanent goals
// (kill 100 … 100,000 enemies, forge 1,000 spells, travel 100 km, reach wave 30 fast…).
// The big ones award exclusive skins, including Ultra Mythic skins that can't drop from caches.
window.WF = window.WF || {};

WF.Stats = {
  get d() { const s = WF.Save.data; return s.stats || (s.stats = { kills: 0, forged: 0, discovered: 0, distance: 0, bosses: 0, majors: 0, waveMax: 0, boxes: 0, runs: 0, bestW30: 0 }); },
  add(k, n = 1) { this.d[k] = (this.d[k] || 0) + n; this._dirty = true; },
  max(k, v) { if (v > (this.d[k] || 0)) { this.d[k] = v; this._dirty = true; } },
  min(k, v) { if (!this.d[k] || v < this.d[k]) { this.d[k] = v; this._dirty = true; } },
  // called every couple of seconds in a run, at wave clear and at run end
  flushRun(run) {
    if (run) {
      const m = (run.dist - (run.distBanked || 0)) / 40; // 40 px ≈ 1 m
      if (m > 0) { this.add('distance', m); run.distBanked = run.dist; }
      this.max('waveMax', run.wave);
    }
    WF.Milestones.check();
    if (this._dirty) { WF.Save.save(); this._dirty = false; }
  },
};

const fmt = n => n >= 1000 ? (n / 1000).toLocaleString() + 'k' : String(n);
WF.MILESTONES = [
  { id: 'k100',    group: 'Slayer',     text: 'Kill 100 enemies',          stat: 'kills', target: 100,    reward: { points: 100 } },
  { id: 'k1000',   group: 'Slayer',     text: 'Kill 1,000 enemies',        stat: 'kills', target: 1000,   reward: { points: 250, skin: 'veteran' } },
  { id: 'k10000',  group: 'Slayer',     text: 'Kill 10,000 enemies',       stat: 'kills', target: 10000,  reward: { points: 800, skin: 'warlord' } },
  { id: 'k100000', group: 'Slayer',     text: 'Kill 100,000 enemies',      stat: 'kills', target: 100000, reward: { points: 5000, skin: 'worldforge' } },
  { id: 'f10',     group: 'Scribe',     text: 'Forge 10 spells',           stat: 'forged', target: 10,    reward: { points: 100 } },
  { id: 'f100',    group: 'Scribe',     text: 'Forge 100 spells',          stat: 'forged', target: 100,   reward: { points: 300, tome: 'ledger' } },
  { id: 'f1000',   group: 'Scribe',     text: 'Forge 1,000 spells',        stat: 'forged', target: 1000,  reward: { points: 2000, skin: 'firstword' } },
  { id: 'd25',     group: 'Scholar',    text: 'Discover 25 different spells', stat: 'discovered', target: 25, reward: { points: 200 } },
  { id: 'd100',    group: 'Scholar',    text: 'Discover 100 different spells', stat: 'discovered', target: 100, reward: { points: 600, tome: 'codex' } },
  { id: 'm1',      group: 'Wanderer',   text: 'Travel 1 km',               stat: 'distance', target: 1000,   reward: { points: 100 } },
  { id: 'm10',     group: 'Wanderer',   text: 'Travel 10 km',              stat: 'distance', target: 10000,  reward: { points: 400, skin: 'pathfinder' } },
  { id: 'm100',    group: 'Wanderer',   text: 'Travel 100 km',             stat: 'distance', target: 100000, reward: { points: 3000, skin: 'wanderer' } },
  { id: 'b1',      group: 'Bossbreaker',text: 'Defeat a boss',             stat: 'bosses', target: 1,     reward: { points: 150 } },
  { id: 'b10',     group: 'Bossbreaker',text: 'Defeat 10 bosses',          stat: 'bosses', target: 10,    reward: { points: 500, skin: 'bossbreaker' } },
  { id: 'u1',      group: 'Bossbreaker',text: 'Defeat a major boss (wave 20)', stat: 'majors', target: 1, reward: { points: 800, tome: 'unwritten' } },
  { id: 'w10',     group: 'Survivor',   text: 'Reach wave 10',             stat: 'waveMax', target: 10,   reward: { points: 150 } },
  { id: 'w20',     group: 'Survivor',   text: 'Reach wave 20',             stat: 'waveMax', target: 20,   reward: { points: 400 } },
  { id: 'w30',     group: 'Survivor',   text: 'Reach wave 30',             stat: 'waveMax', target: 30,   reward: { points: 800, skin: 'survivor' } },
  { id: 't40',     group: 'Speedrunner',text: 'Reach wave 30 in under 40 minutes', stat: 'bestW30', target: 2400, lower: true, reward: { points: 1000 } },
  { id: 't25',     group: 'Speedrunner',text: 'Reach wave 30 in under 25 minutes', stat: 'bestW30', target: 1500, lower: true, reward: { points: 2500, skin: 'chronoblade' } },
  { id: 'c10',     group: 'Collector',  text: 'Open 10 Rune Caches',       stat: 'boxes', target: 10,     reward: { points: 200 } },
  { id: 'c50',     group: 'Collector',  text: 'Open 50 Rune Caches',       stat: 'boxes', target: 50,     reward: { points: 500, tome: 'folio' } },
];

WF.Milestones = {
  onComplete: null,
  progress(m) {
    const v = WF.Stats.d[m.stat] || 0;
    if (m.lower) return v > 0 && v <= m.target ? 1 : 0;
    return Math.min(1, v / m.target);
  },
  label(m) {
    const v = WF.Stats.d[m.stat] || 0;
    if (m.lower) { if (!v) return 'not reached yet'; const mm = Math.floor(v / 60), ss = Math.round(v % 60); return `best ${mm}:${String(ss).padStart(2, '0')}`; }
    if (m.stat === 'distance') return `${(Math.min(v, m.target) / 1000).toFixed(m.target >= 10000 ? 1 : 2)} / ${m.target / 1000} km`;
    return `${fmt(Math.min(Math.floor(v), m.target))} / ${fmt(m.target)}`;
  },
  rewardFor(kind, id) { return WF.MILESTONES.find(m => m.reward[kind] === id); },
  check() {
    const d = WF.Save.data; d.ms = d.ms || {};
    for (const m of WF.MILESTONES) {
      if (d.ms[m.id] || this.progress(m) < 1) continue;
      d.ms[m.id] = true;
      const r = m.reward;
      if (r.points) d.points = (d.points || 0) + r.points;
      if (r.skin) d.skins[r.skin] = true;
      if (r.tome) { d.tomes = d.tomes || { leather: true }; d.tomes[r.tome] = true; }
      WF.Stats._dirty = true;
      if (this.onComplete) this.onComplete(m);
    }
  },
};
