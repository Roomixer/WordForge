// Wordforge — daily curses + save data (meta layer / D1 hooks).
window.WF = window.WF || {};

WF.CURSES = [
  { id: 'ember',  name: 'Ember Tide',   desc: 'Fire spells +60%. Ice spells −40%.', mods: { el: { fire: 1.6, ice: 0.6 } } },
  { id: 'frost',  name: 'Frost Pact',   desc: 'Ice spells +60%. Fire spells −40%.', mods: { el: { ice: 1.6, fire: 0.6 } } },
  { id: 'blood',  name: 'Blood Moon',   desc: 'Enemies 25% faster. Runes drop twice as often.', mods: { enemySpeed: 1.25, drop: 2 } } ,
  { id: 'swarm',  name: 'The Swarm',    desc: '+60% enemies, but they have −40% HP.', mods: { count: 1.6, enemyHp: 0.6 } },
  { id: 'glass',  name: 'Glass Cannon', desc: 'You deal double damage. Your max HP is halved.', mods: { dmg: 2, playerHp: 0.5 } },
  { id: 'storm',  name: 'Storm Season', desc: 'Chain spells jump +3 times. Storm spells +30%.', mods: { chain: 3, el: { storm: 1.3 } } },
  { id: 'hollow', name: 'Hollow Night', desc: 'Void spells heal you on hit. Light spells −30%.', mods: { voidHeal: true, el: { light: 0.7 } } },
  { id: 'wild',   name: 'Wild Words',   desc: 'Wild runes drop 5x as often. Type anything.', mods: { wild: 5 } },
  { id: 'bloom',  name: 'Overgrowth',   desc: 'Life & Poison spells +50%. Enemies regenerate.', mods: { el: { life: 1.5, poison: 1.5 }, regen: true } },
];

WF.dayKey = function (offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
WF.curseFor = function (offset = 0) {
  return WF.CURSES[WF.hash('curse:' + WF.dayKey(offset)) % WF.CURSES.length];
};

WF.STARTER = {
  key: '_starter', words: ['ember', 'dart'], name: 'Ember Dart', element: 'fire', secondary: null, form: 'bolt',
  tags: ['burn'], power: 4, rate: 1, flavor: "Every apprentice's first mistake.", source: 'starter',
};

WF.Save = {
  KEY: 'wordforge_v1',
  data: null,
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) {}
    this.data = Object.assign({
      grimoire: {}, best: 0, bestToday: 0, bestDay: '', runs: 0, streak: 0, lastDay: '',
      firsts: 0, loadout: '_starter', name: '', seenTutorial: false,
      points: 0, skins: { ember: true }, skin: 'ember', boxes: 0,
      settings: { master: 0.9, music: 0.55, sfx: 0.75, amb: 0.6, muted: false }, ch: null,
      perks: {}, xpTotal: 0, dev: false,
      tomes: { leather: true }, tome: 'leather', stats: null, ms: {},
    }, d || {});
    return this.data;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
  discoveries() { return Object.keys(this.data.grimoire).length; },
  bonusRunes() { return Math.min(4, Math.floor(this.discoveries() / 5)); },
  touchDay() {
    const today = WF.dayKey(0), yest = WF.dayKey(-1), d = this.data;
    if (d.lastDay === today) return;
    d.streak = d.lastDay === yest ? d.streak + 1 : 1;
    d.lastDay = today;
    this.save();
  },
  recordRun(wave) {
    const d = this.data, today = WF.dayKey(0);
    d.runs++;
    if (d.bestDay !== today) { d.bestDay = today; d.bestToday = 0; }
    d.bestToday = Math.max(d.bestToday, wave);
    const newBest = wave > d.best; d.best = Math.max(d.best, wave);
    this.save();
    return newBest;
  },
};
