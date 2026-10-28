// Wordforge — symbol set. 24×24 stroke paths usable as inline SVG (DOM) and Path2D (canvas).
window.WF = window.WF || {};

WF.ICONS = {
  // elements
  fire:   'M12 3c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0c0-3 2-4 2-6.5 1 1 2 2.2 2 3.5 1.2-2 1.5-5 1-7.5z',
  ice:    'M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9 4l3 3 3-3M9 20l3-3 3 3',
  storm:  'M13 2L4.5 13.5h6.5L10 22l9-12h-6.5L13 2z',
  earth:  'M2 20l7-12 4 6 3-4 6 10z',
  poison: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11zM10 13.5a1.6 1.6 0 1 0 0.01 0',
  void:   'M12 12a1 1 0 1 1 1.5-.8 3 3 0 1 1-4.4 3.4 5 5 0 1 1 8.6-3.9 7 7 0 1 1-13.2 4',
  light:  'M12 8a4 4 0 1 0 0.01 0M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  life:   'M5 19C5 10 11 5 20 5c0 9-5 15-14 14zM5 19l8-8',
  dark:   'M20 14.5A8.5 8.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z',
  // effects (tags)
  burn:      'M12 4c.8 3 4 4.2 4 8.2a4 4 0 0 1-8 0c0-2.4 1.6-3.2 1.6-5.2.8.8 1.6 1.8 1.6 2.8 1-1.6 1.2-4 .8-5.8zM8 21h8',
  freeze:    'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
  slow:      'M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9',
  poisonT:   'M8 15a3 3 0 1 0 .01 0M15.5 8a3.5 3.5 0 1 0 .01 0M17 18a2 2 0 1 0 .01 0',
  knockback: 'M3 12h12M10 6l6 6-6 6M20 4v16',
  pierce:    'M4 20L20 4M13 4h7v7M4 20l1-4 3 3z',
  split:     'M12 21v-8M12 13L5 4M12 13l7-9M5 4v4M5 4h4M19 4v4M19 4h-4',
  heal:      'M12 20s-8-5-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15 12 20 12 20zM12 10v5M9.5 12.5h5',
  weaken:    'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 7l-2 5h4l-2 5',
  // forms
  bolt:   'M4 20L18 6M18 6h-6M18 6v6',
  nova:   'M12 7a5 5 0 1 0 .01 0M12 2v2M12 20v2M2 12h2M20 12h2',
  orbit:  'M12 6a6 6 0 1 0 .01 0M18 12a1.5 1.5 0 1 0 .01 0M6 12a1.5 1.5 0 1 0 .01 0',
  beam:   'M3 12h18M3 9v6M7 10.5l14-0',
  zone:   'M12 5a7 7 0 1 0 .01 0M12 9a3 3 0 1 0 .01 0',
  chain:  'M3 7l6 7 4-5 8 9',
  summon: 'M12 6a2 2 0 1 0 .01 0M6 16a2 2 0 1 0 .01 0M18 16a2 2 0 1 0 .01 0',
  shield: 'M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7z',
  // stats
  hp: 'M12 20s-8-5-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15 12 20 12 20z',
  dmg: 'M14.5 3.5l6 6-11 11-6-6zM3 21l3-3',
  haste: 'M13 2L4.5 13.5h6.5L10 22l9-12h-6.5L13 2z',
  multi: 'M4 18l6-6M10 18l6-6M16 18l6-6M10 12V6M4 12V6',
  area: 'M12 3a9 9 0 1 0 .01 0M12 8a4 4 0 1 0 .01 0',
  move: 'M5 12h11M12 6l6 6-6 6M3 8h4M3 16h4',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4M6 8h4M14 8h4',
  regen: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4M12 9v6M9 12h6',
  armor: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  crit: 'M12 2l2.5 7H22l-6 4.5 2.3 7.5L12 16.5 5.7 21 8 13.5 2 9h7.5z',
  luck: 'M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.5 6.5 19.5l1-6.3L3 8.9 9 8z',
};
WF.TAG_ICON = t => t === 'poison' ? 'poisonT' : t;

WF.svgIcon = function (name, color = 'currentColor', size = 18, sw = 2) {
  const d = WF.ICONS[name] || WF.ICONS.light;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
};
const _p2d = {};
WF.drawIcon = function (g, name, x, y, size, color, lw = 2) {
  const d = WF.ICONS[name]; if (!d) return;
  const p = _p2d[name] || (_p2d[name] = new Path2D(d));
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24);
  g.strokeStyle = color; g.lineWidth = lw * 24 / size; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke(p); g.restore();
};

// spell rarity by power — same six tiers & colours as skins
WF.spellRarity = function (power, element) {
  if (power >= 9 && (element === 'light' || element === 'dark')) return element;
  return power >= 10 ? 'mythic' : power >= 8 ? 'legendary' : power === 7 ? 'epic' : power === 6 ? 'rare' : power >= 4 ? 'uncommon' : 'common';
};
