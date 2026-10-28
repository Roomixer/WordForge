// Wordforge — areas. The map changes every 3 waves; each area has its own floor,
// ambient weather, enemy skins and music track.
window.WF = window.WF || {};

WF.BIOMES = [
  {
    id: 'crypt', name: 'Ember Crypt', tagline: 'Where the first words were burned.',
    floor: { style: 'slabs', hue: 225, sat: 14, lit: 8.5, seam: '#07080c', carve: '255,211,110', words: ['IGNIS', 'CINIS', 'FLAMMA', 'VERBUM'] },
    bg: '#07080c', light: '#ff9a4d', ambient: { kind: 'embers', color: '#ff8a3d', core: '#ffd9a0' },
    enemy: { grunt: '#d9dde6', runner: '#ff9fa8', brute: '#9aa3b8', elite: '#ffd36e', body: '#151821', eye: '#ff4f6a', deco: 'horns' },
    music: 'crypt',
  },
  {
    id: 'frost', name: 'Frozen Archive', tagline: 'Every page here is ice.',
    floor: { style: 'ice', hue: 205, sat: 30, lit: 11, seam: '#06121c', carve: '200,240,255', words: ['GLACIES', 'NIX', 'SILENTIUM', 'LIBER'] },
    bg: '#050b12', light: '#9fdcff', ambient: { kind: 'snow', color: '#cfefff', core: '#ffffff' },
    enemy: { grunt: '#bfeaff', runner: '#7fd8ff', brute: '#e0f4ff', elite: '#ffffff', body: '#0e1d29', eye: '#e8fbff', deco: 'crystal' },
    music: 'frost',
  },
  {
    id: 'storm', name: 'Storm Spire', tagline: 'The sky argues with itself.',
    floor: { style: 'grate', hue: 250, sat: 12, lit: 9, seam: '#05040a', carve: '255,225,77', words: ['TONITRUS', 'FULGUR', 'VENTUS', 'CAELUM'] },
    bg: '#06050c', light: '#ffe14d', ambient: { kind: 'rain', color: '#b8c4ff', core: '#ffffff' },
    enemy: { grunt: '#ffe14d', runner: '#fff3a0', brute: '#c9b24a', elite: '#ffffff', body: '#17150c', eye: '#fff6b0', deco: 'spark' },
    music: 'storm',
  },
  {
    id: 'marsh', name: 'Rot Marsh', tagline: 'Words go here to decompose.',
    floor: { style: 'mud', hue: 95, sat: 18, lit: 8, seam: '#050a04', carve: '160,255,120', words: ['PUTREDO', 'LIMUS', 'VENENUM', 'MUSCUS'] },
    bg: '#050904', light: '#a8ff7a', ambient: { kind: 'spores', color: '#8dff5a', core: '#e6ffb0' },
    enemy: { grunt: '#8dff5a', runner: '#c4ff8a', brute: '#6aa84f', elite: '#e6ff7a', body: '#0d170c', eye: '#e6ff7a', deco: 'drip' },
    music: 'marsh',
  },
  {
    id: 'void', name: 'Void Rift', tagline: 'Language ends. Something else begins.',
    floor: { style: 'void', hue: 268, sat: 28, lit: 7, seam: '#030108', carve: '200,150,255', words: ['VACUUM', 'NIHIL', 'UMBRA', 'FINIS'] },
    bg: '#04020a', light: '#b07cff', ambient: { kind: 'motes', color: '#b07cff', core: '#f0d6ff' },
    enemy: { grunt: '#b07cff', runner: '#ff7fe0', brute: '#7d5cc9', elite: '#ff5af0', body: '#120c1c', eye: '#ff5af0', deco: 'tentacle' },
    music: 'void',
  },
];
WF.biomeIndex = wave => Math.floor(Math.max(0, wave - 1) / 3) % WF.BIOMES.length;
WF.biomeFor = wave => WF.BIOMES[WF.biomeIndex(wave)];

WF.makeFloor = function (b) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), F = b.floor;
  let seed = WF.hash(b.id) % 2147483646 + 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = F.seam; g.fillRect(0, 0, S, S);
  const shade = (k = 0) => `hsl(${F.hue}, ${F.sat}%, ${F.lit + k}%)`;

  if (F.style === 'slabs' || F.style === 'ice') {
    const cell = 128;
    for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) {
      const off = (y / cell) % 2 ? cell / 2 : 0;
      for (const dx of [0, -S]) {
        const X = x + off + dx;
        g.fillStyle = shade(rnd() * 4 - 1); g.fillRect(X + 3, y + 3, cell - 6, cell - 6);
        for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.025})`; g.fillRect(X + 3 + rnd() * (cell - 8), y + 3 + rnd() * (cell - 8), 2, 2); }
        if (F.style === 'ice') {
          const gr = g.createLinearGradient(X, y, X + cell, y + cell);
          gr.addColorStop(0, 'rgba(200,240,255,0.06)'); gr.addColorStop(0.5, 'rgba(200,240,255,0)'); gr.addColorStop(1, 'rgba(200,240,255,0.03)');
          g.fillStyle = gr; g.fillRect(X + 3, y + 3, cell - 6, cell - 6);
        }
        if (rnd() < (F.style === 'ice' ? 0.7 : 0.35)) {
          g.strokeStyle = F.style === 'ice' ? 'rgba(220,245,255,0.16)' : 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.beginPath();
          let cx = X + 10 + rnd() * (cell - 20), cy = y + 10 + rnd() * (cell - 20); g.moveTo(cx, cy);
          for (let k = 0; k < 5; k++) { cx += rnd() * 34 - 17; cy += rnd() * 34 - 17; g.lineTo(cx, cy); }
          g.stroke();
        }
      }
    }
  } else if (F.style === 'grate') {
    const cell = 64;
    for (let y = 0; y < S; y += cell) for (let x = 0; x < S; x += cell) {
      g.fillStyle = shade(rnd() * 3); g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      if ((x / cell + y / cell) % 3 === 0) {
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
        for (let k = 10; k < cell - 6; k += 8) { g.beginPath(); g.moveTo(x + 8, y + k); g.lineTo(x + cell - 8, y + k); g.stroke(); }
      }
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (const [rx, ry] of [[6, 6], [cell - 8, 6], [6, cell - 8], [cell - 8, cell - 8]]) g.fillRect(x + rx, y + ry, 2, 2);
    }
    g.strokeStyle = 'rgba(255,225,77,0.05)'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(rnd() * S, 0); g.lineTo(rnd() * S, S); g.stroke(); }
  } else if (F.style === 'mud') {
    g.fillStyle = shade(0); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 50;
      g.fillStyle = rnd() < 0.5 ? shade(-2.5) : shade(2);
      for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.6, rnd() * 3, 0, 6.29); g.fill(); }
    }
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(160,255,120,0.07)'; g.lineWidth = 1; g.beginPath(); g.arc(rnd() * S, rnd() * S, 3 + rnd() * 6, 0, 6.29); g.stroke(); }
  } else if (F.style === 'void') {
    g.fillStyle = shade(-2); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(230,200,255,${rnd() * 0.35})`; const s = rnd() < 0.1 ? 2 : 1; g.fillRect(rnd() * S, rnd() * S, s, s); }
    for (let i = 0; i < 9; i++) {
      const x = rnd() * S, y = rnd() * S, w = 50 + rnd() * 70;
      g.save(); g.translate(x, y); g.rotate(rnd() * 3);
      g.fillStyle = shade(3 + rnd() * 2); g.beginPath(); g.moveTo(-w / 2, -w / 3); g.lineTo(w / 2, -w / 4); g.lineTo(w / 3, w / 3); g.lineTo(-w / 2.5, w / 3.5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(200,150,255,0.18)'; g.lineWidth = 1; g.stroke();
      g.restore();
    }
  }
  // carved words
  g.font = '800 15px Cinzel, serif'; g.textAlign = 'center';
  for (let i = 0; i < 6; i++) {
    g.save(); g.translate(rnd() * S, rnd() * S); g.rotate((rnd() - 0.5) * 0.6);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillText(F.words[i % F.words.length], 1, 1);
    g.fillStyle = `rgba(${F.carve},0.035)`; g.fillText(F.words[i % F.words.length], 0, 0);
    g.restore();
  }
  return c;
};
