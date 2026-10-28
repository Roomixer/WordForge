// Wordforge — player skins: catalog, rarity table, and a self-contained renderer
// (takes its own 2D context so the wardrobe can draw previews on small canvases).
window.WF = window.WF || {};

WF.RARITIES = {
  common:    { name: 'Common',       color: '#a9b1c2', weight: 45,   dupe: 20 },
  uncommon:  { name: 'Uncommon',     color: '#6fdc8c', weight: 27,   dupe: 35 },
  rare:      { name: 'Rare',         color: '#5aa9ff', weight: 15,   dupe: 60 },
  epic:      { name: 'Epic',         color: '#c77dff', weight: 8,    dupe: 100 },
  legendary: { name: 'Legendary',    color: '#ffb84d', weight: 3.6,  dupe: 160 },
  mythic:    { name: 'Mythic',       color: '#ff5fd2', weight: 0.9,  dupe: 300 },
  light:     { name: 'Light',        color: '#fff3b0', weight: 0.25, dupe: 450 },
  dark:      { name: 'Dark',         color: '#ff3355', weight: 0.25, dupe: 450 },
  ultra:     { name: 'Ultra Mythic', color: '#ffffff', weight: 0,    dupe: 1000 }, // challenge rewards only
};
WF.RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'light', 'dark', 'ultra'];
WF.BOX_COST = 200;

// core: [highlight, mid, edge]   ring: ring colour   ringStyle: solid|dash|double|runes
// deco: crown|horns|spikes|eye|rays|halo|aurora|wings|disk|prism|glyph
// glow: legendary aura colour    anim: mythic (animated)   emit: particles the game spawns behind the player
WF.SKINS = [
  { id: 'ember',  name: 'Ember Adept',    rarity: 'common',    core: ['#ffffff', '#fff1d0', '#ffb84d'], ring: '#ffd36e' },
  { id: 'ash',    name: 'Ashen',          rarity: 'common',    core: ['#f4f4f4', '#bdbdbd', '#6f6f6f'], ring: '#cfcfcf' },
  { id: 'slate',  name: 'Slate Monk',     rarity: 'common',    core: ['#eef4ff', '#9fb2d6', '#4d5f86'], ring: '#9fb2d6' },
  { id: 'copper', name: 'Copper Novice',  rarity: 'common',    core: ['#fff3e6', '#e0a070', '#a0522d'], ring: '#e0a070' },

  { id: 'moss',   name: 'Mossback',       rarity: 'uncommon',  core: ['#f4ffe8', '#a8e07a', '#3f7a22'], ring: '#a8e07a', ringStyle: 'dash' },
  { id: 'tide',   name: 'Tidecaller',     rarity: 'uncommon',  core: ['#e8fbff', '#7fd8ff', '#1f6f9f'], ring: '#7fd8ff', ringStyle: 'dash' },
  { id: 'rust',   name: 'Rustblood',      rarity: 'uncommon',  core: ['#fff0e0', '#ff9f5a', '#9a2f12'], ring: '#ff9f5a', ringStyle: 'dash' },

  { id: 'frost',  name: 'Frostbite',      rarity: 'rare',      core: ['#ffffff', '#cfefff', '#3d9bd6'], ring: '#cfefff', ringStyle: 'double', trail: '#7fd8ff' },
  { id: 'venom',  name: 'Venomweaver',    rarity: 'rare',      core: ['#f6ffe0', '#8dff5a', '#1f5c12'], ring: '#8dff5a', ringStyle: 'double', trail: '#8dff5a' },
  { id: 'dusk',   name: 'Duskwalker',     rarity: 'rare',      core: ['#fff0f6', '#ff8fb8', '#5a2a7a'], ring: '#ffb0d0', ringStyle: 'double', trail: '#c77dff' },

  { id: 'king',   name: 'Ember King',     rarity: 'epic',      core: ['#ffffff', '#ffe7a8', '#d98a1f'], ring: '#ffd36e', ringStyle: 'runes', deco: 'crown',  trail: '#ffd36e' },
  { id: 'warlock',name: 'Hex Warlock',    rarity: 'epic',      core: ['#ffe8f0', '#ff5a7a', '#3a0f1f'], ring: '#ff5a7a', ringStyle: 'runes', deco: 'horns',  trail: '#ff3d5a' },
  { id: 'star',   name: 'Starforged',     rarity: 'epic',      core: ['#ffffff', '#d6e4ff', '#5a6fd6'], ring: '#d6e4ff', ringStyle: 'double', deco: 'spikes', trail: '#9fb2ff' },
  { id: 'watcher',name: 'The Watcher',    rarity: 'epic',      core: ['#ffffff', '#f2ecdf', '#b9ad95'], ring: '#7dffd9', ringStyle: 'runes', deco: 'eye',    trail: '#7dffd9' },

  { id: 'solar',  name: 'Solar Flare',    rarity: 'legendary', core: ['#ffffff', '#fff3a0', '#ff8a1f'], ring: '#fff3a0', ringStyle: 'double', deco: 'rays',   glow: '#ffb84d', trail: '#ffb84d' },
  { id: 'abyss',  name: 'Abyssal Lantern',rarity: 'legendary', core: ['#f3e6ff', '#9a5cff', '#12061f'], ring: '#c9a0ff', ringStyle: 'double', deco: 'halo',   glow: '#9a5cff', trail: '#b07cff' },
  { id: 'aurora', name: 'Aurora',         rarity: 'legendary', core: ['#ffffff', '#b8ffe8', '#2a8fa0'], ring: '#b8ffe8', ringStyle: 'double', deco: 'aurora', glow: '#5affc8', trail: '#5affc8' },

  { id: 'phoenix',name: 'Phoenix',        rarity: 'mythic',    core: ['#ffffff', '#ffd27a', '#ff3d00'], ring: '#ffd27a', ringStyle: 'runes',  deco: 'wings', glow: '#ff6a1f', anim: true, trail: '#ff6a1f', emit: { colors: ['#ffd27a', '#ff8a3d', '#ff3d00'], rate: 40 } },
  { id: 'singular',name:'Singularity',    rarity: 'mythic',    core: ['#000000', '#05030a', '#000000'], ring: '#ffffff', ringStyle: 'none',   deco: 'disk',  glow: '#ff9ad6', anim: true, trail: '#ffb0e0' },
  { id: 'prism',  name: 'Prismatic',      rarity: 'mythic',    core: ['#ffffff', '#ffffff', '#ffffff'], ring: '#ffffff', ringStyle: 'double', deco: 'prism', glow: 'hue',     anim: true, trail: 'hue', emit: { colors: ['hue'], rate: 30 } },
  // ---- more skins ----
  { id: 'clay',     name: 'Clay Adept',      rarity: 'common',    core: ['#fff2e6', '#d9a77a', '#7a4a2a'], ring: '#d9a77a' },
  { id: 'midnight', name: 'Midnight',        rarity: 'common',    core: ['#e6ecff', '#6a7ab8', '#1a2250'], ring: '#8a9ae0' },
  { id: 'jade',     name: 'Jade Sage',       rarity: 'uncommon',  core: ['#f0fff6', '#5fd6a0', '#0f5a3a'], ring: '#5fd6a0', ringStyle: 'dash' },
  { id: 'sapphire', name: 'Sapphire',        rarity: 'uncommon',  core: ['#eef6ff', '#5a9cff', '#10306a'], ring: '#5a9cff', ringStyle: 'dash' },
  { id: 'wire',     name: 'Copperwire',      rarity: 'rare',      core: ['#fffbe6', '#ffe14d', '#8a6a10'], ring: '#ffe14d', ringStyle: 'double', deco: 'antenna', trail: '#ffe14d' },
  { id: 'tidepool', name: 'Tidepool',        rarity: 'rare',      core: ['#e6fffb', '#5fe0d0', '#0f4a5a'], ring: '#5fe0d0', ringStyle: 'double', deco: 'bubbles', trail: '#5fe0d0' },
  { id: 'plague',   name: 'Plague Doctor',   rarity: 'epic',      core: ['#f2f0ea', '#8a8270', '#2a2620'], ring: '#8dff5a', ringStyle: 'runes', deco: 'beak',   trail: '#8dff5a' },
  { id: 'thorn',    name: 'Thorn Druid',     rarity: 'epic',      core: ['#f4ffe8', '#7ac05a', '#2a4a1a'], ring: '#a8e07a', ringStyle: 'runes', deco: 'thorns', trail: '#8dff5a' },
  { id: 'knight',   name: 'Lantern Knight',  rarity: 'epic',      core: ['#ffffff', '#c9d2e6', '#4a5568'], ring: '#ffd36e', ringStyle: 'double', deco: 'visor', trail: '#ffd36e' },
  { id: 'seraph',   name: 'Ember Seraph',    rarity: 'legendary', core: ['#ffffff', '#ffe7a8', '#ff8a1f'], ring: '#ffe7a8', ringStyle: 'double', deco: 'seraph',   glow: '#ffd36e', trail: '#ffd36e' },
  { id: 'monarch',  name: 'Frost Monarch',   rarity: 'legendary', core: ['#ffffff', '#cfefff', '#2b7fb0'], ring: '#cfefff', ringStyle: 'double', deco: 'icecrown', glow: '#9fdcff', trail: '#9fdcff' },
  { id: 'starfall', name: 'Starfall',        rarity: 'mythic',    core: ['#ffffff', '#e6e0ff', '#5a3ab8'], ring: '#e6e0ff', ringStyle: 'double', deco: 'stars',  glow: '#9a8cff', anim: true, trail: '#c9c0ff', emit: { colors: ['#ffffff', '#c9c0ff'], rate: 18 } },
  { id: 'kraken',   name: 'Kraken',          rarity: 'mythic',    core: ['#e6fffb', '#3ad6c0', '#0a3a4a'], ring: '#3ad6c0', ringStyle: 'none',   deco: 'kraken', glow: '#3ad6c0', anim: true, trail: '#3ad6c0' },
  // Light & Dark: the rarest cache drops
  { id: 'dawn',     name: 'Dawnbringer',     rarity: 'light',     core: ['#ffffff', '#fffbe6', '#ffe7a0'], ring: '#ffffff', ringStyle: 'double', deco: 'radiant', glow: '#fff3b0', anim: true, trail: '#fff3b0', emit: { colors: ['#ffffff', '#fff3b0'], rate: 26 } },
  { id: 'sol',      name: 'Sol Invictus',    rarity: 'light',     core: ['#ffffff', '#fff6c9', '#ffd36e'], ring: '#fff6c9', ringStyle: 'none',   deco: 'sun',     glow: '#ffffff', anim: true, trail: '#fff6c9' },
  { id: 'nightmare',name: 'Nightmare',       rarity: 'dark',      core: ['#2a0a10', '#0a0204', '#000000'], ring: '#ff3355', ringStyle: 'runes',  deco: 'nightmare', aura: 'dark', glow: '#ff3355', anim: true, trail: '#ff3355', emit: { colors: ['#ff3355', '#5a0a1a'], rate: 22 } },
  { id: 'hollow',   name: 'Hollow King',     rarity: 'dark',      core: ['#1a0a2a', '#08040e', '#000000'], ring: '#9a5cff', ringStyle: 'double', deco: 'hollowcrown', aura: 'dark', glow: '#7a00ff', anim: true, trail: '#9a5cff' },
  // challenge rewards (never drop from caches)
  { id: 'veteran',  name: 'Veteran',         rarity: 'rare',      exclusive: true, core: ['#f4f4f4', '#b9c2d6', '#4a5568'], ring: '#ff5566', ringStyle: 'runes', deco: 'swords', trail: '#ff5566' },
  { id: 'pathfinder',name:'Pathfinder',      rarity: 'rare',      exclusive: true, core: ['#fff8e6', '#e0c08a', '#6a4a20'], ring: '#e0c08a', ringStyle: 'none',  deco: 'compass', trail: '#e0c08a' },
  { id: 'survivor', name: 'Survivor',        rarity: 'epic',      exclusive: true, core: ['#ffffff', '#ff9a8a', '#8a1a1a'], ring: '#ff5566', ringStyle: 'double', deco: 'spikes', trail: '#ff5566' },
  { id: 'warlord',  name: 'Warlord',         rarity: 'legendary', exclusive: true, core: ['#ffe8e0', '#d94a3a', '#3a0a06'], ring: '#ffd36e', ringStyle: 'runes', deco: 'warlord', glow: '#ff5533', trail: '#ff5533' },
  { id: 'bossbreaker',name:'Bossbreaker',    rarity: 'legendary', exclusive: true, core: ['#ffffff', '#ffd6a0', '#a04a10'], ring: '#ffd36e', ringStyle: 'double', deco: 'crown', glow: '#ff2244', trail: '#ff2244' },
  // Ultra Mythic: the top milestone rewards
  { id: 'worldforge', name: 'Worldforge',    rarity: 'ultra', exclusive: true, core: ['#ffffff', '#ffe7a8', '#ff6a1f'], ring: 'hue', ringStyle: 'runes', deco: 'worldforge', glow: 'hue', anim: true, trail: 'hue', emit: { colors: ['hue', '#ffd36e'], rate: 45 } },
  { id: 'firstword',  name: 'The First Word',rarity: 'ultra', exclusive: true, core: ['#ffffff', '#ffffff', '#c9b48a'], ring: '#ffd36e', ringStyle: 'none', deco: 'firstword', glow: '#ffffff', anim: true, trail: 'hue', emit: { colors: ['#ffffff', 'hue'], rate: 30 } },
  { id: 'wanderer',   name: 'Eternal Wanderer', rarity: 'ultra', exclusive: true, core: ['#ffffff', '#cfe8ff', '#3a5a8a'], ring: '#cfe8ff', ringStyle: 'none', deco: 'wanderer', glow: '#7fd8ff', anim: true, trail: '#cfe8ff', emit: { colors: ['#ffffff', '#7fd8ff'], rate: 30 } },
  { id: 'chronoblade',name: 'Chronoblade',   rarity: 'ultra', exclusive: true, core: ['#ffffff', '#e8f0ff', '#2a3a6a'], ring: '#ffd36e', ringStyle: 'none', deco: 'chrono', glow: '#9fb2ff', anim: true, trail: '#ffd36e' },
  { id: 'glyph',  name: 'Living Glyph',   rarity: 'mythic',    core: ['#fff8e6', '#ffd36e', '#7a4a0a'], ring: '#ffd36e', ringStyle: 'none',   deco: 'glyph', glow: '#ffd36e', anim: true, trail: '#ffd36e' },
];
WF.skinById = id => WF.SKINS.find(s => s.id === id) || WF.SKINS[0];
WF.skinHue = t => `hsl(${Math.floor((t * 90) % 360 / 15) * 15}, 100%, 65%)`; // quantised so glow sprites cache

// Grimoire skins ("tomes") restyle the in-game book bar and the grimoire.
WF.TOMES = [
  { id: 'leather',  name: 'Worn Leather',     rarity: 'common',    cover: ['#3a2416', '#1e120b'], border: '#ffd36e', page: ['#16130f', '#221d16'], seal: '#7a1f2a', ink: '#f2e8d2' },
  { id: 'oak',      name: 'Oakbound',         rarity: 'common',    cover: ['#4a3a22', '#2a1f10'], border: '#c8a46a', page: ['#171410', '#211c15'], seal: '#3a5a2a', ink: '#efe4cc' },
  { id: 'iron',     name: 'Iron-Clasped',     rarity: 'uncommon',  cover: ['#3a3f4a', '#1a1d24'], border: '#b9c2d6', page: ['#121419', '#1a1d24'], seal: '#4a5568', ink: '#e6ecf5' },
  { id: 'frost',    name: 'Frost Codex',      rarity: 'rare',      cover: ['#1f4a66', '#0d2233'], border: '#9fdcff', page: ['#0f1a22', '#16242e'], seal: '#2b7fb0', ink: '#e6f6ff' },
  { id: 'verdant',  name: 'Verdant Tome',     rarity: 'rare',      cover: ['#1f4a2a', '#0d2212'], border: '#8dff5a', page: ['#0f1a10', '#162416'], seal: '#2a6a3a', ink: '#ecffe0' },
  { id: 'emberbook',name: 'Ember Grimoire',   rarity: 'epic',      cover: ['#5a1f10', '#2a0d06'], border: '#ff8a3d', page: ['#1a0f0b', '#24150f'], seal: '#ff6a1f', ink: '#ffe6d6', glow: '#ff6a1f' },
  { id: 'voidbook', name: 'Void Tome',        rarity: 'epic',      cover: ['#2a1640', '#120a1f'], border: '#b07cff', page: ['#120d1a', '#1a1424'], seal: '#5a2a9a', ink: '#efe6ff', glow: '#9a5cff' },
  { id: 'gilded',   name: 'Gilded Gospel',    rarity: 'legendary', cover: ['#6a4a10', '#3a2806'], border: '#ffe7a0', page: ['#221c10', '#2e2616'], seal: '#ffd36e', ink: '#fff6dd', glow: '#ffd36e' },
  { id: 'living',   name: 'Living Book',      rarity: 'mythic',    cover: ['#3a1030', '#1a0616'], border: 'hue', page: ['#170c16', '#21121f'], seal: '#ff5fd2', ink: '#ffe6fa', glow: 'hue', anim: true },
  { id: 'dawnbook', name: 'Book of Dawn',     rarity: 'light',     cover: ['#f2e6c8', '#b9a47a'], border: '#ffffff', page: ['#2a2618', '#363020'], seal: '#fff3b0', ink: '#fffbe6', glow: '#fff3b0', anim: true },
  { id: 'nightbook',name: 'Book of Night',    rarity: 'dark',      cover: ['#120810', '#050205'], border: '#ff3355', page: ['#0e0a0e', '#161016'], seal: '#ff3355', ink: '#ffe0e6', glow: '#ff3355', anim: true },
  { id: 'ledger',   name: "Scribe's Ledger",  rarity: 'epic',      exclusive: true, cover: ['#2a2a3a', '#14141e'], border: '#c9c0ff', page: ['#16151c', '#1e1d26'], seal: '#5a4ab8', ink: '#f0eeff' },
  { id: 'codex',    name: 'Codex Infinitum',  rarity: 'legendary', exclusive: true, cover: ['#0f2a3a', '#06141e'], border: '#5affc8', page: ['#0c161c', '#122026'], seal: '#2a8fa0', ink: '#e6fffa', glow: '#5affc8' },
  { id: 'folio',    name: "Collector's Folio",rarity: 'legendary', exclusive: true, cover: ['#4a1030', '#240616'], border: '#ffb84d', page: ['#1c1016', '#26161e'], seal: '#ffb84d', ink: '#fff0e0', glow: '#ffb84d' },
  { id: 'unwritten',name: 'The Unwritten',    rarity: 'ultra',     exclusive: true, cover: ['#0a0a0a', '#000000'], border: 'hue', page: ['#0a0a0c', '#111114'], seal: '#ff4f6a', ink: '#ffffff', glow: 'hue', anim: true },
];
WF.tomeById = id => WF.TOMES.find(t => t.id === id) || WF.TOMES[0];
WF.resolveCol = (c, t) => c === 'hue' ? WF.skinHue(t) : c;

// one cache roll: pick a rarity by weight, then any non-exclusive skin or tome of that rarity
WF.rollCache = function () {
  const tiers = WF.RARITY_ORDER.filter(k => WF.RARITIES[k].weight > 0);
  const total = tiers.reduce((s, k) => s + WF.RARITIES[k].weight, 0);
  let r = Math.random() * total, rar = 'common';
  for (const k of tiers) { r -= WF.RARITIES[k].weight; if (r <= 0) { rar = k; break; } }
  const pool = WF.SKINS.filter(s => s.rarity === rar && !s.exclusive).map(item => ({ kind: 'skin', item }))
    .concat(WF.TOMES.filter(s => s.rarity === rar && !s.exclusive).map(item => ({ kind: 'tome', item })));
  return pool[(Math.random() * pool.length) | 0];
};
WF.rollSkin = () => WF.rollCache().item; // kept for older callers

// mini book cover for wardrobe previews
WF.drawTome = function (g, x, y, w, h, tome, t) {
  const C = c => WF.resolveCol(c, t);
  g.save();
  if (tome.glow) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2); g.drawImage(WF.glowSprite(C(tome.glow)), x - w * 0.3, y - h * 0.3, w * 1.6, h * 1.6); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, tome.cover[0]); gr.addColorStop(1, tome.cover[1]);
  g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 4) : g.rect(x, y, w, h); g.fill();
  g.strokeStyle = C(tome.border); g.lineWidth = 2; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w * 0.12, h);
  // corner studs + seal
  g.fillStyle = C(tome.border); for (const [cx, cy] of [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]]) { g.beginPath(); g.arc(cx, cy, 2.5, 0, 6.29); g.fill(); }
  g.fillStyle = tome.seal; g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.18, 0, 6.29); g.fill();
  g.strokeStyle = C(tome.border); g.lineWidth = 1.5; g.stroke();
  g.fillStyle = tome.ink; g.font = `800 ${Math.round(Math.min(w, h) * 0.18)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('W', x + w / 2, y + h / 2 + 1);
  if (tome.id === 'unwritten') { g.globalCompositeOperation = 'lighter'; g.font = '800 9px Cinzel, serif'; for (let i = 0; i < 7; i++) { const a = t + i * 0.9; g.fillStyle = WF.skinHue(t + i); g.fillText('UNWRITE'[i], x + w / 2 + Math.cos(a) * w * 0.32, y + h / 2 + Math.sin(a) * h * 0.32); } }
  g.restore();
};

(function () {
  const cache = {};
  function sprite(color) {
    if (cache[color]) return cache[color];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.25, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (cache[color] = c);
  }
  WF.glowSprite = sprite;
  const glow = (g, x, y, r, color, a) => { g.globalAlpha = a; g.drawImage(sprite(color), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); };
  const col = (c, t) => c === 'hue' ? WF.skinHue(t) : c;

  const star = (g, x, y, R, n = 5) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, rr = i % 2 ? R * 0.45 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  const add = (g, fn) => { g.save(); g.globalCompositeOperation = 'lighter'; fn(); g.restore(); };
  const wing = (g, x, y, r, side, flap, fill, scale = 1) => {
    g.save(); g.translate(x, y); g.scale(side * scale, scale); g.rotate(-0.25 + flap);
    g.fillStyle = fill; g.beginPath(); g.moveTo(r * 0.4, 0);
    g.quadraticCurveTo(r * 1.6, -r * 2.4, r * 3.4, -r * 1.3); g.quadraticCurveTo(r * 2.4, -r * 0.9, r * 2.8, -r * 0.2);
    g.quadraticCurveTo(r * 1.8, -r * 0.2, r * 2.1, r * 0.7); g.quadraticCurveTo(r * 1.2, r * 0.3, r * 0.4, r * 0.5); g.closePath(); g.fill(); g.restore();
  };
  function extraBack(g, x, y, r, skin, t, face) {
    switch (skin.deco) {
      case 'radiant':
        add(g, () => { g.translate(x, y); g.rotate(t * 0.4); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, L = r * (2.4 + 0.4 * Math.sin(t * 3 + i)); g.globalAlpha = 0.5; g.fillStyle = '#fff6d6'; g.beginPath(); g.moveTo(Math.cos(a - 0.08) * r, Math.sin(a - 0.08) * r); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 0.08) * r, Math.sin(a + 0.08) * r); g.fill(); } });
        add(g, () => { const f = Math.sin(t * 5) * 0.25; wing(g, x, y, r, -1, f, 'rgba(255,250,230,0.85)'); wing(g, x, y, r, 1, f, 'rgba(255,250,230,0.85)'); });
        break;
      case 'seraph': add(g, () => { const f = Math.sin(t * 6) * 0.2; wing(g, x, y, r, -1, f, 'rgba(255,220,150,0.7)', 0.7); wing(g, x, y, r, 1, f, 'rgba(255,220,150,0.7)', 0.7); }); break;
      case 'sun':
        add(g, () => { g.translate(x, y); for (let k = 0; k < 2; k++) { g.rotate(t * (k ? -0.5 : 0.7)); g.fillStyle = k ? 'rgba(255,200,80,0.6)' : 'rgba(255,240,180,0.7)'; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = r * (1.6 + (i % 2 ? 0.5 : 0) + 0.2 * Math.sin(t * 5 + i)); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill(); } });
        break;
      case 'nightmare':
        for (let i = 0; i < 7; i++) { const a = t * 0.7 + i * 0.9, R = r * (1.4 + 0.3 * Math.sin(t * 2 + i)); g.fillStyle = 'rgba(10,0,4,0.65)'; circ(g, x + Math.cos(a) * R, y + Math.sin(a) * R * 0.8, r * (0.55 + 0.15 * Math.sin(t * 3 + i))); g.fill(); }
        break;
      case 'kraken':
        g.strokeStyle = '#3ad6c0'; g.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const a0 = i * Math.PI * 2 / 7 + t * 0.3; g.lineWidth = r * 0.22; g.beginPath(); g.moveTo(x + Math.cos(a0) * r * 0.8, y + Math.sin(a0) * r * 0.8); for (let k = 1; k <= 6; k++) { const a = a0 + Math.sin(t * 3 + i + k * 0.6) * 0.5 + k * 0.12; const R = r * (0.8 + k * 0.32); g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); g.lineWidth = r * 0.22 * (1 - k / 7); } g.stroke(); }
        break;
      case 'swords':
        for (const s of [-1, 1]) { g.save(); g.translate(x, y); g.rotate(s * 0.7); g.fillStyle = '#d6dce8'; g.fillRect(-r * 0.12, -r * 2.1, r * 0.24, r * 1.6); g.fillStyle = '#ffd36e'; g.fillRect(-r * 0.4, -r * 0.55, r * 0.8, r * 0.14); g.restore(); }
        break;
      case 'compass':
        g.save(); g.translate(x, y); g.rotate(face + Math.PI / 2);
        g.strokeStyle = '#e0c08a'; g.lineWidth = 1.5; circ(g, 0, 0, r * 1.6); g.stroke();
        for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = i === 3 ? '#ff5566' : '#e0c08a'; g.beginPath(); g.moveTo(0, -r * 2.1); g.lineTo(r * 0.22, -r * 1.3); g.lineTo(-r * 0.22, -r * 1.3); g.fill(); }
        g.restore(); break;
      case 'worldforge':
        add(g, () => { for (let i = 0; i < 3; i++) { g.save(); g.translate(x, y); g.rotate(t * (0.5 + i * 0.3) + i); g.strokeStyle = WF.skinHue(t + i); g.lineWidth = 2; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(0, 0, r * (2.2 + i * 0.4), r * (0.7 + i * 0.15), 0, 0, 6.29); g.stroke(); g.fillStyle = '#fff'; const a = t * 2 + i; circ(g, Math.cos(a) * r * (2.2 + i * 0.4), Math.sin(a) * r * (0.7 + i * 0.15), 2.5); g.fill(); g.restore(); } });
        add(g, () => { g.font = `800 ${Math.max(7, r * 0.55)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const W2 = 'FORGE'; for (let i = 0; i < W2.length; i++) { const a = -t * 1.1 + i * Math.PI * 2 / W2.length; g.fillStyle = WF.skinHue(t * 2 + i); g.fillText(W2[i], x + Math.cos(a) * r * 3.1, y + Math.sin(a) * r * 3.1); } });
        break;
      case 'firstword':
        add(g, () => { for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; g.strokeStyle = '#ffffff'; g.globalAlpha = (1 - ph) * 0.6; g.lineWidth = 2; circ(g, x, y, r * (1 + ph * 2.6)); g.stroke(); } });
        add(g, () => { g.font = `800 ${Math.max(7, r * 0.6)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for (let i = 0; i < 12; i++) { const a = t * 0.8 + i * Math.PI / 6, R = r * (2 + 0.2 * Math.sin(t * 3 + i)); g.fillStyle = WF.skinHue(t + i * 0.3); g.fillText(L[(i + Math.floor(t * 2)) % 26], x + Math.cos(a) * R, y + Math.sin(a) * R); } });
        break;
      case 'wanderer':
        add(g, () => { g.strokeStyle = '#7fd8ff'; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a0 = t * 1.5 + i * Math.PI / 2; g.globalAlpha = 0.7; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * (1.8 + i * 0.25), a0, a0 + 1.4); g.stroke(); } g.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) { const a = -t * 0.6 + i; star(g, x + Math.cos(a) * r * 2.8, y + Math.sin(a) * r * 2.8, 2.6 + Math.sin(t * 4 + i)); } });
        break;
      case 'chrono':
        g.save(); g.translate(x, y);
        g.strokeStyle = '#9fb2ff'; g.lineWidth = 1.5; circ(g, 0, 0, r * 1.9); g.stroke();
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.fillStyle = i % 3 ? '#9fb2ff' : '#ffd36e'; g.fillRect(Math.cos(a) * r * 1.9 - 1.5, Math.sin(a) * r * 1.9 - 1.5, 3, 3); }
        g.rotate(t * 0.5); g.fillStyle = '#5a6fd6'; for (let i = 0; i < 10; i++) { g.rotate(Math.PI / 5); g.fillRect(-r * 0.12, -r * 2.55, r * 0.24, r * 0.35); }
        g.restore();
        add(g, () => { for (let k = 1; k <= 3; k++) { g.globalAlpha = 0.18 / k; g.fillStyle = '#9fb2ff'; circ(g, x - Math.cos(face) * k * r * 0.6, y - Math.sin(face) * k * r * 0.6, r); g.fill(); } });
        break;
    }
  }
  function extraFront(g, x, y, r, skin, t, face) {
    switch (skin.deco) {
      case 'antenna':
        for (const s of [-1, 1]) { const tx = x + s * r * 0.7, ty = y - r * 1.7 + Math.sin(t * 8 + s) * 2; g.strokeStyle = '#ffe14d'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + s * r * 0.35, y - r * 0.8); g.lineTo(tx, ty); g.stroke(); add(g, () => glow(g, tx, ty, r * (0.6 + 0.4 * Math.random()), '#ffe14d', 0.9)); }
        break;
      case 'bubbles':
        g.strokeStyle = 'rgba(200,255,250,0.8)'; g.lineWidth = 1;
        for (let i = 0; i < 5; i++) { const ph = (t * 0.5 + i / 5) % 1; circ(g, x + Math.sin(i * 2 + t) * r * 0.9, y - r - ph * r * 2, 1.5 + i % 3); g.globalAlpha = 1 - ph; g.stroke(); } g.globalAlpha = 1;
        break;
      case 'beak':
        g.save(); g.translate(x, y); g.rotate(face);
        g.fillStyle = '#2a2620'; g.strokeStyle = '#8a8270'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(r * 0.5, -r * 0.35); g.quadraticCurveTo(r * 1.9, -r * 0.1, r * 2.1, r * 0.35); g.quadraticCurveTo(r * 1.3, r * 0.2, r * 0.5, r * 0.35); g.closePath(); g.fill(); g.stroke();
        for (const s of [-1, 1]) { g.fillStyle = '#8dff5a'; circ(g, r * 0.25, s * r * 0.4, r * 0.22); g.fill(); g.strokeStyle = '#2a2620'; g.lineWidth = 2; g.stroke(); }
        g.restore(); break;
      case 'thorns':
        g.fillStyle = '#5a8a3a';
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + t * 0.2; g.beginPath(); g.moveTo(x + Math.cos(a - 0.15) * r * 0.95, y + Math.sin(a - 0.15) * r * 0.95); g.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45); g.lineTo(x + Math.cos(a + 0.15) * r * 0.95, y + Math.sin(a + 0.15) * r * 0.95); g.fill(); }
        g.fillStyle = '#ff7fb0'; circ(g, x + r * 0.6, y - r * 0.75, r * 0.2); g.fill();
        break;
      case 'visor':
        g.save(); g.translate(x, y); g.rotate(face);
        g.fillStyle = '#2a2f3a'; g.fillRect(-r * 0.2, -r * 0.95, r * 1.1, r * 1.9);
        add(g, () => { g.fillStyle = '#ffd36e'; g.fillRect(r * 0.55, -r * 0.6, r * 0.18, r * 1.2); glow(g, r * 0.65, 0, r * 1.1, '#ffd36e', 0.7); });
        g.restore(); break;
      case 'icecrown':
        g.fillStyle = 'rgba(220,245,255,0.9)'; g.strokeStyle = '#2b7fb0'; g.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { const bx = x + i * r * 0.35, h = r * (1.1 - Math.abs(i) * 0.25); g.beginPath(); g.moveTo(bx - r * 0.16, y - r * 0.8); g.lineTo(bx, y - r * 0.8 - h); g.lineTo(bx + r * 0.16, y - r * 0.8); g.closePath(); g.fill(); g.stroke(); }
        break;
      case 'stars':
        add(g, () => { for (let i = 0; i < 5; i++) { const a = t * (0.9 + i * 0.1) + i * 1.26, R = r * (1.7 + 0.3 * Math.sin(t + i)); g.fillStyle = i % 2 ? '#ffffff' : '#c9c0ff'; g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5 + i); star(g, x + Math.cos(a) * R, y + Math.sin(a) * R, 3.5 + (i % 2)); } });
        break;
      case 'radiant':
        add(g, () => { g.strokeStyle = '#fffbe6'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - r * 1.25, r * 0.85, r * 0.26, 0, 0, 6.29); g.stroke(); });
        break;
      case 'seraph':
        add(g, () => { g.strokeStyle = '#ffe7a8'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - r * 1.25, r * 0.8, r * 0.25, 0, 0, 6.29); g.stroke(); });
        break;
      case 'nightmare': {
        g.save(); g.translate(x, y); g.rotate(face);
        for (const s of [-1, 1]) { g.fillStyle = '#ff2244'; g.beginPath(); g.ellipse(r * 0.35, s * r * 0.32, r * 0.22, r * 0.08, s * 0.35, 0, 6.29); g.fill(); }
        g.restore(); add(g, () => glow(g, x + Math.cos(face) * r * 0.35, y + Math.sin(face) * r * 0.35, r * 1.2, '#ff2244', 0.4));
        break; }
      case 'hollowcrown':
        g.fillStyle = '#05020a'; g.strokeStyle = '#9a5cff'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x - r, y - r * 0.8); for (let i = 0; i <= 4; i++) { g.lineTo(x - r + i * r * 0.5, y - r * (i % 2 ? 1.3 : 2.0)); } g.lineTo(x + r, y - r * 0.8); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#9a5cff'; for (let i = 0; i < 2; i++) { const ph = (t * 0.6 + i * 0.5) % 1; g.globalAlpha = 1 - ph; circ(g, x + (i ? r * 0.4 : -r * 0.4), y + r * (0.8 + ph * 1.2), r * 0.12); g.fill(); } g.globalAlpha = 1;
        break;
      case 'warlord':
        for (const s of [-1, 1]) { g.fillStyle = '#1a0806'; g.strokeStyle = '#ff5533'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + s * r * 0.4, y - r * 0.8); g.quadraticCurveTo(x + s * r * 1.6, y - r * 1.1, x + s * r * 1.5, y - r * 2.1); g.quadraticCurveTo(x + s * r * 1.1, y - r * 1.2, x + s * r * 0.75, y - r * 0.5); g.closePath(); g.fill(); g.stroke(); }
        g.fillStyle = '#ffd36e'; g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.85); g.lineTo(x - r * 0.6, y - r * 1.25); g.lineTo(x - r * 0.3, y - r * 1.05); g.lineTo(x, y - r * 1.4); g.lineTo(x + r * 0.3, y - r * 1.05); g.lineTo(x + r * 0.6, y - r * 1.25); g.lineTo(x + r * 0.6, y - r * 0.85); g.closePath(); g.fill();
        break;
      case 'firstword':
        g.fillStyle = '#2a1a06'; g.font = `800 ${Math.max(9, r * 1.1)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('A', x, y + 1);
        break;
      case 'chrono':
        g.save(); g.translate(x, y); g.strokeStyle = '#2a3a6a'; g.lineCap = 'round';
        g.lineWidth = 2; g.rotate(t * 2); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 0.75); g.stroke();
        g.rotate(-t * 2 + t * 0.2); g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 0.5); g.stroke();
        g.restore(); break;
      case 'worldforge':
        g.fillStyle = 'rgba(60,20,0,0.7)'; g.beginPath(); g.moveTo(x - r * 0.5, y + r * 0.15); g.lineTo(x + r * 0.5, y + r * 0.15); g.lineTo(x + r * 0.3, y - r * 0.15); g.lineTo(x - r * 0.6, y - r * 0.15); g.closePath(); g.fill();
        break;
    }
  }

  WF.drawSkin = function (g, x, y, r, skin, t, o = {}) {
    const face = o.face || 0, hurt = !!o.hurt;
    const ring = col(skin.ring, t);
    g.save();
    if (skin.aura === 'dark') { const dg = g.createRadialGradient(x, y, r * 0.5, x, y, r * 4); dg.addColorStop(0, 'rgba(0,0,0,0.75)'); dg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = dg; circ(g, x, y, r * 4); g.fill(); }
    // --- aura (legendary / mythic) ---
    if (skin.glow) {
      g.globalCompositeOperation = 'lighter';
      glow(g, x, y, r * 4.2, col(skin.glow, t), 0.55 + 0.15 * Math.sin(t * 3));
      g.globalCompositeOperation = 'source-over';
    }
    // --- back decorations ---
    if (skin.deco === 'rays') {
      g.globalCompositeOperation = 'lighter';
      g.save(); g.translate(x, y); g.rotate(t * 0.6);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, L = r * (2.1 + 0.35 * Math.sin(t * 4 + i));
        g.globalAlpha = 0.55; g.fillStyle = '#ffd36e';
        g.beginPath(); g.moveTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r); g.lineTo(Math.cos(a) * L, Math.sin(a) * L); g.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r); g.fill();
      }
      g.restore(); g.globalCompositeOperation = 'source-over';
    }
    if (skin.deco === 'aurora') {
      g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      ['#5affc8', '#5ad6ff', '#c77dff'].forEach((c, i) => {
        g.strokeStyle = c; g.globalAlpha = 0.55; g.lineWidth = 4;
        g.beginPath(); g.arc(x, y, r * (1.7 + i * 0.35), t * (1.2 - i * 0.5) + i, t * (1.2 - i * 0.5) + i + 2.2); g.stroke();
      });
      g.globalCompositeOperation = 'source-over';
    }
    if (skin.deco === 'wings') {
      const flap = Math.sin(t * 9) * 0.35;
      g.globalCompositeOperation = 'lighter';
      for (const side of [-1, 1]) {
        g.save(); g.translate(x, y); g.scale(side, 1); g.rotate(-0.25 + flap);
        const gr = g.createLinearGradient(0, 0, r * 3.2, -r);
        gr.addColorStop(0, 'rgba(255,210,122,0.95)'); gr.addColorStop(0.6, 'rgba(255,106,31,0.7)'); gr.addColorStop(1, 'rgba(255,61,0,0)');
        g.fillStyle = gr; g.globalAlpha = 1;
        g.beginPath(); g.moveTo(r * 0.4, 0);
        g.quadraticCurveTo(r * 1.6, -r * 2.4, r * 3.4, -r * 1.3);
        g.quadraticCurveTo(r * 2.4, -r * 0.9, r * 2.8, -r * 0.2);
        g.quadraticCurveTo(r * 1.8, -r * 0.2, r * 2.1, r * 0.7);
        g.quadraticCurveTo(r * 1.2, r * 0.3, r * 0.4, r * 0.5);
        g.closePath(); g.fill();
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
    }
    if (skin.deco === 'disk') {
      // back half of the accretion disk
      g.save(); g.translate(x, y); g.rotate(-0.35);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = ['#ffb0e0', '#ffd6a0', '#9ad6ff'][i]; g.globalAlpha = 0.6; g.lineWidth = 3 - i * 0.6;
        g.beginPath(); g.ellipse(0, 0, r * (2.2 + i * 0.35), r * (0.55 + i * 0.1), 0, Math.PI + t * 0, Math.PI * 2); g.stroke();
      }
      g.restore(); g.globalCompositeOperation = 'source-over';
    }
    if (skin.deco === 'prism') {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        g.save(); g.translate(x, y); g.rotate(t * (0.8 + i * 0.4) + i * 2.1);
        g.strokeStyle = WF.skinHue(t + i * 1.3); g.globalAlpha = 0.7; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(0, 0, r * 2.1, r * 0.7, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = WF.skinHue(t + i); circ(g, Math.cos(t * 3 + i) * r * 2.1, Math.sin(t * 3 + i) * r * 0.7, 2.6); g.fill();
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
    }
    // --- ring ---
    const rs = skin.ringStyle || 'solid';
    g.globalAlpha = 0.9; g.strokeStyle = hurt ? '#ff5566' : ring; g.fillStyle = ring; g.lineWidth = 1.5;
    if (rs !== 'none') {
      g.save(); g.translate(x, y); g.rotate(t * 1.2);
      if (rs === 'dash') { g.setLineDash([5, 5]); circ(g, 0, 0, r + 7); g.stroke(); g.setLineDash([]); }
      else { circ(g, 0, 0, r + 7); g.stroke(); }
      if (rs === 'double') { g.rotate(-t * 2.6); g.setLineDash([2, 6]); circ(g, 0, 0, r + 11); g.stroke(); g.setLineDash([]); }
      if (rs === 'runes') {
        g.font = `800 ${Math.max(6, r * 0.55)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const L = 'ΨΩΔΣΞΦΛΘ';
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.save(); g.translate(Math.cos(a) * (r + 7), Math.sin(a) * (r + 7)); g.rotate(a + Math.PI / 2); g.fillStyle = '#0d0f15'; g.fillRect(-4, -4, 8, 8); g.fillStyle = ring; g.fillText(L[i], 0, 0.5); g.restore(); }
      } else {
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.fillRect(Math.cos(a) * (r + 7) - 1.5, Math.sin(a) * (r + 7) - 1.5, 3, 3); }
      }
      g.restore();
    }
    g.globalAlpha = 1;
    // facing notch
    g.fillStyle = ring;
    g.beginPath(); g.moveTo(x + Math.cos(face) * (r + 14), y + Math.sin(face) * (r + 14));
    g.lineTo(x + Math.cos(face + 0.35) * (r + 8), y + Math.sin(face + 0.35) * (r + 8));
    g.lineTo(x + Math.cos(face - 0.35) * (r + 8), y + Math.sin(face - 0.35) * (r + 8)); g.closePath(); g.fill();
    // spikes (behind core)
    if (skin.deco === 'spikes') {
      g.save(); g.translate(x, y); g.rotate(t * 0.8);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.fillStyle = i % 2 ? '#9fb2ff' : '#ffffff';
        g.beginPath(); g.moveTo(Math.cos(a - 0.3) * r * 0.85, Math.sin(a - 0.3) * r * 0.85); g.lineTo(Math.cos(a) * r * 1.75, Math.sin(a) * r * 1.75); g.lineTo(Math.cos(a + 0.3) * r * 0.85, Math.sin(a + 0.3) * r * 0.85); g.fill();
      }
      g.restore();
    }
    extraBack(g, x, y, r, skin, t, face);
    // --- core ---
    let c0 = skin.core[0], c1 = skin.core[1], c2 = skin.core[2];
    if (skin.deco === 'prism') { c1 = WF.skinHue(t); c2 = WF.skinHue(t + 2); }
    if (hurt) { c1 = '#ffb0b8'; c2 = '#ff5566'; }
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    gr.addColorStop(0, c0); gr.addColorStop(0.6, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; circ(g, x, y, r); g.fill();
    // --- front decorations ---
    if (skin.deco === 'crown') {
      const cy = y - r * 0.85, w = r * 1.1;
      g.fillStyle = '#ffd36e'; g.strokeStyle = '#7a4a0a'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - w, cy); g.lineTo(x - w, cy - r * 0.7); g.lineTo(x - w * 0.5, cy - r * 0.35); g.lineTo(x, cy - r * 0.95); g.lineTo(x + w * 0.5, cy - r * 0.35); g.lineTo(x + w, cy - r * 0.7); g.lineTo(x + w, cy); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff4f6a'; circ(g, x, cy - r * 0.3, r * 0.15); g.fill();
    }
    if (skin.deco === 'horns') {
      for (const s of [-1, 1]) {
        g.fillStyle = '#1a0a10'; g.strokeStyle = '#ff5a7a'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x + s * r * 0.35, y - r * 0.8);
        g.quadraticCurveTo(x + s * r * 1.4, y - r * 1.3, x + s * r * 1.15, y - r * 2.05);
        g.quadraticCurveTo(x + s * r * 0.95, y - r * 1.25, x + s * r * 0.75, y - r * 0.55); g.closePath(); g.fill(); g.stroke();
      }
    }
    if (skin.deco === 'eye') {
      const blink = (Math.sin(t * 0.9) > 0.985) ? 0.15 : 1;
      g.save(); g.beginPath(); g.ellipse(x, y, r * 0.85, r * 0.55 * blink, 0, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#fbf7ee'; g.fillRect(x - r, y - r, r * 2, r * 2);
      const ix = x + Math.cos(face) * r * 0.3, iy = y + Math.sin(face) * r * 0.15;
      g.fillStyle = '#1fd6a6'; circ(g, ix, iy, r * 0.42); g.fill();
      g.fillStyle = '#05140f'; circ(g, ix, iy, r * 0.2); g.fill();
      g.fillStyle = '#fff'; circ(g, ix - r * 0.1, iy - r * 0.1, r * 0.08); g.fill();
      g.restore();
    }
    if (skin.deco === 'halo') {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#c9a0ff'; g.lineWidth = 2; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(x, y - r * 1.25, r * 0.85, r * 0.28, 0, 0, Math.PI * 2); g.stroke();
      glow(g, x, y - r * 1.25, r * 1.2, '#9a5cff', 0.6);
      g.globalCompositeOperation = 'source-over';
    }
    if (skin.deco === 'disk') {
      // front half + photon ring
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#ffffff'; g.globalAlpha = 0.9; g.lineWidth = 1.5; circ(g, x, y, r * 1.05); g.stroke();
      g.save(); g.translate(x, y); g.rotate(-0.35);
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = ['#ffb0e0', '#ffd6a0', '#9ad6ff'][i]; g.globalAlpha = 0.95; g.lineWidth = 3 - i * 0.6;
        g.beginPath(); g.ellipse(0, 0, r * (2.2 + i * 0.35), r * (0.55 + i * 0.1), 0, 0, Math.PI); g.stroke();
        const a = t * (2.5 - i * 0.6) % (Math.PI * 2);
        g.fillStyle = '#fff'; circ(g, Math.cos(a) * r * (2.2 + i * 0.35), Math.sin(a) * r * (0.55 + i * 0.1), 1.8); g.fill();
      }
      g.restore(); g.globalCompositeOperation = 'source-over';
    }
    if (skin.deco === 'glyph') {
      const word = 'WORDFORGE';
      g.font = `800 ${Math.max(7, r * 0.7)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < word.length; i++) {
        const a = t * 1.4 + i * (Math.PI * 2 / word.length), R = r * (1.65 + 0.15 * Math.sin(t * 3 + i));
        g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4 + i);
        g.fillStyle = '#ffd36e'; g.fillText(word[i], x + Math.cos(a) * R, y + Math.sin(a) * R);
      }
      g.globalAlpha = 1; g.fillStyle = '#7a4a0a';
      g.font = `800 ${Math.max(8, r * 0.95)}px Cinzel, serif`; g.globalCompositeOperation = 'source-over';
      g.fillText('Ω', x, y + 1);
    }
    extraFront(g, x, y, r, skin, t, face);
    g.restore();
  };
})();
