// Wordforge — infinite maps. The world is generated in 16×16-cell chunks on demand from a
// seed, in the current area's style. Every chunk keeps an open street along its top row and
// left column, so the whole world stays connected. Some chunks hold treasure rooms. On boss
// waves an arena is stamped into the world some distance away; the boss waits inside it.
// Enemies navigate with a BFS flow field over a window around the player.
window.WF = window.WF || {};

WF.Map = (function () {
  const CS = 80, CH = 16, WIN = 60;
  const WALL = {
    crypt: { top: '#2a2e3a', side: '#14161d', edge: '#4a4f60', accent: 'rgba(255,211,110,0.18)', style: 'ruins' },
    frost: { top: '#2c4a5e', side: '#122230', edge: '#9fdcff', accent: 'rgba(230,248,255,0.35)', style: 'shelves' },
    storm: { top: '#2b2936', side: '#121118', edge: '#5a566e', accent: 'rgba(255,225,77,0.55)', style: 'plaza' },
    marsh: { top: '#22331f', side: '#0e170c', edge: '#4a6a3a', accent: 'rgba(160,255,120,0.25)', style: 'blobs' },
    void:  { top: '#241838', side: '#0d0716', edge: '#7d5cc9', accent: 'rgba(200,150,255,0.5)', style: 'shards' },
  };
  const ARENA_WALL = { top: '#3a1620', side: '#1a070c', edge: '#ff4f6a' };

  function create(biomeId, seed) {
    return { biomeId, seed: seed >>> 0, wall: WALL[biomeId] || WALL.crypt, chunks: new Map(), arena: null, newLoot: [],
      dist: new Int16Array(WIN * WIN).fill(-1), grid: new Uint8Array(WIN * WIN), ox: 0, oy: 0, flowCell: '', flowT: 0, miniKey: '', mini: null };
  }

  const key = (kx, ky) => kx + ',' + ky;
  function rng(seed) { let s = (seed % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  function chunk(m, kx, ky) {
    const k = key(kx, ky);
    let c = m.chunks.get(k);
    if (!c) { c = genChunk(m, kx, ky); m.chunks.set(k, c); }
    return c;
  }
  function cell(m, cx, cy) {
    const kx = Math.floor(cx / CH), ky = Math.floor(cy / CH);
    return chunk(m, kx, ky).cells[(cy - ky * CH) * CH + (cx - kx * CH)];
  }

  function genChunk(m, kx, ky) {
    const rnd = rng(WF.hash(m.seed + ':' + kx + ':' + ky));
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const cells = new Uint8Array(CH * CH);
    const set = (x, y, v = 1) => { if (x >= 1 && y >= 1 && x < CH && y < CH) cells[y * CH + x] = v; };
    const style = m.wall.style, home = kx === 0 && ky === 0;
    const loot = [];

    if (!home) {
      if (style === 'ruins') {
        for (let k = 0; k < 2; k++) {
          const w = ri(4, 7), h = ri(3, 6), x0 = ri(2, CH - w - 2), y0 = ri(2, CH - h - 2);
          for (let x = x0; x <= x0 + w; x++) { set(x, y0); set(x, y0 + h); }
          for (let y = y0; y <= y0 + h; y++) { set(x0, y); set(x0 + w, y); }
          for (let d = 0; d < 2; d++) { const side = ri(0, 3); if (side < 2) { const x = ri(x0 + 1, x0 + w - 1); set(x, side ? y0 + h : y0, 0); } else { const y = ri(y0 + 1, y0 + h - 1); set(side === 3 ? x0 + w : x0, y, 0); } }
        }
        for (let k = 0; k < 4; k++) set(ri(2, CH - 2), ri(2, CH - 2));
      } else if (style === 'shelves') {
        for (let y = 2; y < CH - 1; y += ri(3, 4)) { let x = ri(2, 4); while (x < CH - 2) { const len = ri(3, 7); for (let i = 0; i < len && x + i < CH - 1; i++) set(x + i, y); x += len + ri(2, 3); } }
      } else if (style === 'plaza') {
        for (let x = 3; x < CH - 2; x += 5) for (let y = 3; y < CH - 2; y += 5) if (rnd() < 0.65) { set(x, y); set(x + 1, y); set(x, y + 1); set(x + 1, y + 1); }
        if (rnd() < 0.6) { const x = ri(2, 9), y = ri(2, 9), L = ri(3, 5); for (let i = 0; i < L; i++) { set(x + i, y); set(x, y + i); } }
      } else if (style === 'blobs') {
        for (let k = 0; k < 4; k++) { const cx = ri(3, CH - 3), cy = ri(3, CH - 3), r = 1.1 + rnd() * 2.2; for (let x = Math.floor(cx - r); x <= cx + r; x++) for (let y = Math.floor(cy - r); y <= cy + r; y++) if ((x - cx) ** 2 + ((y - cy) * 1.3) ** 2 <= r * r) set(x, y); }
      } else {
        for (let k = 0; k < 5; k++) { let x = ri(2, CH - 2), y = ri(2, CH - 2); for (let i = 0; i < ri(3, 6); i++) { set(x, y); const d = ri(0, 3); x += [1, -1, 0, 0][d]; y += [0, 0, 1, -1][d]; } }
      }
      // treasure room: walled, one doorway, loot in the middle
      if (rnd() < 0.28) {
        const x0 = ri(3, 6), y0 = ri(3, 6), w = 6, h = 5;
        for (let x = x0 - 1; x <= x0 + w + 1; x++) for (let y = y0 - 1; y <= y0 + h + 1; y++) set(x, y, 0);
        for (let x = x0; x <= x0 + w; x++) { set(x, y0); set(x, y0 + h); }
        for (let y = y0; y <= y0 + h; y++) { set(x0, y); set(x0 + w, y); }
        const side = ri(0, 3);
        if (side === 0) set(x0 + 3, y0, 0); else if (side === 1) set(x0 + 3, y0 + h, 0); else if (side === 2) set(x0, y0 + 2, 0); else set(x0 + w, y0 + 2, 0);
        const r = rnd();
        loot.push({ x: (kx * CH + x0 + 3.5) * CS, y: (ky * CH + y0 + 2.5) * CS, kind: r < 0.45 ? 'chest' : r < 0.8 ? 'runes' : 'shrine', room: true });
      } else if (rnd() < 0.12) {
        loot.push({ x: (kx * CH + ri(3, 12) + 0.5) * CS, y: (ky * CH + ri(3, 12) + 0.5) * CS, kind: rnd() < 0.6 ? 'chest' : 'runes' });
      }
    } else {
      // home chunk: a few pillars around an open start
      for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) { set(x, y); set(x + 1, y); set(x, y + 1); set(x + 1, y + 1); }
    }

    // boss arena overlay
    if (m.arena) {
      const A = m.arena;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
        const gx = kx * CH + x + 0.5, gy = ky * CH + y + 0.5, d = Math.hypot(gx - A.cx, gy - A.cy);
        if (d > A.R + 2) continue;
        if (d < A.R - 0.5 || d > A.R + 0.6) { cells[y * CH + x] = 0; continue; }
        const a = Math.atan2(gy - A.cy, gx - A.cx);
        const gate = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI].some(g => Math.abs(a - g) < 0.24);
        cells[y * CH + x] = gate ? 0 : 2;
      }
    }

    // streets keep the world connected
    for (let i = 0; i < CH; i++) { cells[i] = cells[i] === 2 ? 2 : 0; cells[i * CH] = cells[i * CH] === 2 ? 2 : 0; }
    // seal pockets unreachable from the chunk edges
    const seen = new Uint8Array(CH * CH), q = [];
    for (let i = 0; i < CH; i++) for (const j of [i, i * CH, (CH - 1) * CH + i, i * CH + CH - 1]) if (!cells[j] && !seen[j]) { seen[j] = 1; q.push(j); }
    while (q.length) {
      const j = q.pop(), x = j % CH, y = (j / CH) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= CH || ny >= CH) continue;
        const n = ny * CH + nx; if (seen[n] || cells[n]) continue; seen[n] = 1; q.push(n);
      }
    }
    for (let j = 0; j < CH * CH; j++) if (!cells[j] && !seen[j]) cells[j] = 1;
    // loot inside a sealed pocket is dropped
    const vary = new Uint8Array(CH * CH); for (let j = 0; j < vary.length; j++) vary[j] = (rnd() * 255) | 0;
    loot.forEach((L, i) => { L.id = kx + ',' + ky + ',' + i; });
    for (const L of loot) { const lx = Math.floor(L.x / CS) - kx * CH, ly = Math.floor(L.y / CS) - ky * CH; if (!cells[ly * CH + lx]) m.newLoot.push(L); }
    return { cells, vary };
  }

  const solidCell = (m, cx, cy) => cell(m, cx, cy) !== 0;
  const solid = (m, x, y) => solidCell(m, Math.floor(x / CS), Math.floor(y / CS));

  function collide(m, e, r = e.r) {
    let hitWall = false;
    for (let pass = 0; pass < 2; pass++) {
      const x0 = Math.floor((e.x - r) / CS), x1 = Math.floor((e.x + r) / CS), y0 = Math.floor((e.y - r) / CS), y1 = Math.floor((e.y + r) / CS);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        if (!solidCell(m, cx, cy)) continue;
        const L = cx * CS, T = cy * CS, R = L + CS, B = T + CS;
        const nx = Math.max(L, Math.min(e.x, R)), ny = Math.max(T, Math.min(e.y, B));
        const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hitWall = true;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), push = r - d; e.x += dx / d * push; e.y += dy / d * push; }
        else {
          const opts = [[e.x - L + r, -1, 0], [R - e.x + r, 1, 0], [e.y - T + r, 0, -1], [B - e.y + r, 0, 1]].sort((a, b) => a[0] - b[0]);
          e.x += opts[0][1] * opts[0][0]; e.y += opts[0][2] * opts[0][0];
        }
      }
    }
    return hitWall;
  }

  // BFS over a WIN×WIN window centred on the player
  function updateFlow(m, px, py, dt) {
    const pcx = Math.floor(px / CS), pcy = Math.floor(py / CS), k = pcx + ',' + pcy;
    m.flowT -= dt;
    if (k === m.flowCell && m.flowT > 0) return;
    m.flowCell = k; m.flowT = 0.25;
    m.ox = pcx - (WIN >> 1); m.oy = pcy - (WIN >> 1);
    const G = m.grid, d = m.dist; d.fill(-1);
    for (let y = 0; y < WIN; y++) for (let x = 0; x < WIN; x++) G[y * WIN + x] = cell(m, m.ox + x, m.oy + y) ? 1 : 0;
    const start = (WIN >> 1) * WIN + (WIN >> 1);
    if (G[start]) return;
    const q = new Int32Array(WIN * WIN); let h = 0, t = 0; q[t++] = start; d[start] = 0;
    while (h < t) {
      const i = q[h++], x = i % WIN, y = (i / WIN) | 0, nd = d[i] + 1;
      if (x > 0 && !G[i - 1] && d[i - 1] < 0) { d[i - 1] = nd; q[t++] = i - 1; }
      if (x < WIN - 1 && !G[i + 1] && d[i + 1] < 0) { d[i + 1] = nd; q[t++] = i + 1; }
      if (y > 0 && !G[i - WIN] && d[i - WIN] < 0) { d[i - WIN] = nd; q[t++] = i - WIN; }
      if (y < WIN - 1 && !G[i + WIN] && d[i + WIN] < 0) { d[i + WIN] = nd; q[t++] = i + WIN; }
    }
  }
  const wdist = (m, cx, cy) => { const x = cx - m.ox, y = cy - m.oy; return x < 0 || y < 0 || x >= WIN || y >= WIN ? -2 : m.dist[y * WIN + x]; };

  function steer(m, x, y, px, py) {
    const cx = Math.floor(x / CS), cy = Math.floor(y / CS), here = wdist(m, cx, cy);
    if (here < 0 || here <= 2) return { x: px, y: py };
    let bx = cx, by = cy, bd = here;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (dx && dy && (solidCell(m, cx + dx, cy) || solidCell(m, cx, cy + dy))) continue;
      const v = wdist(m, nx, ny), c = v + (dx && dy ? 0.4 : 0);
      if (v >= 0 && c < bd) { bd = c; bx = nx; by = ny; }
    }
    return { x: (bx + 0.5) * CS, y: (by + 0.5) * CS };
  }

  function spawnPoint(m, px, py, minD, maxD) {
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const cx = Math.floor((px + Math.cos(a) * d) / CS), cy = Math.floor((py + Math.sin(a) * d) / CS);
      if (solidCell(m, cx, cy) || wdist(m, cx, cy) < 0) continue;
      return { x: (cx + 0.2 + Math.random() * 0.6) * CS, y: (cy + 0.2 + Math.random() * 0.6) * CS };
    }
    return { x: px + minD, y: py };
  }

  const center = () => ({ x: CH / 2 * CS, y: CH / 2 * CS });

  // stamp a boss arena 26–34 cells away, regenerating any chunks it touches
  function placeArena(m, px, py, R = 7) {
    const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 8;
    const cx = Math.floor(px / CS + Math.cos(a) * d) + 0.5, cy = Math.floor(py / CS + Math.sin(a) * d) + 0.5;
    m.arena = { cx, cy, R };
    const k0x = Math.floor((cx - R - 3) / CH), k1x = Math.floor((cx + R + 3) / CH), k0y = Math.floor((cy - R - 3) / CH), k1y = Math.floor((cy + R + 3) / CH);
    for (let kx = k0x; kx <= k1x; kx++) for (let ky = k0y; ky <= k1y; ky++) m.chunks.delete(key(kx, ky));
    m.newLoot = m.newLoot.filter(L => Math.hypot(L.x / CS - cx, L.y / CS - cy) > R + 2);
    m.flowT = 0; m.miniKey = '';
    return { x: cx * CS, y: cy * CS, r: (R - 1) * CS };
  }

  const LIFT = 16;
  function draw(g, m, left, top, w, h, t) {
    const x0 = Math.floor(left / CS) - 1, x1 = Math.floor((left + w) / CS) + 1;
    const y0 = Math.floor(top / CS) - 1, y1 = Math.floor((top + h) / CS) + 2;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const v0 = cell(m, cx, cy);
      if (!v0) continue;
      const W = v0 === 2 ? ARENA_WALL : m.wall;
      const kx = Math.floor(cx / CH), ky = Math.floor(cy / CH), v = chunk(m, kx, ky).vary[(cy - ky * CH) * CH + (cx - kx * CH)];
      const x = cx * CS, y = cy * CS, openBelow = !solidCell(m, cx, cy + 1);
      if (openBelow) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + CS, CS, 10); g.fillStyle = W.side; g.fillRect(x, y + CS - LIFT, CS, LIFT); }
      g.fillStyle = W.top; g.fillRect(x, y - LIFT, CS, CS);
      if (v0 === 2) { g.fillStyle = 'rgba(255,79,106,' + (0.12 + 0.08 * Math.sin(t * 3 + v)) + ')'; g.fillRect(x + 6, y - LIFT + 6, CS - 12, CS - 12); }
      else if (m.wall.style === 'ruins') { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, y - LIFT + (v % 2 ? 26 : 40), CS, 2); g.fillRect(x + (v % 60) + 6, y - LIFT, 2, CS); }
      else if (m.wall.style === 'shelves') { g.fillStyle = W.accent; g.fillRect(x, y - LIFT, CS, 5); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(x + 8 + k * 18, y - LIFT + 14, 12, CS - 30); }
      else if (m.wall.style === 'plaza') { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 6, y - LIFT + 6, 3, 3); g.fillRect(x + CS - 9, y - LIFT + 6, 3, 3); }
      else if (m.wall.style === 'blobs') { g.fillStyle = W.accent; g.beginPath(); g.ellipse(x + 20 + v % 40, y - LIFT + 20 + (v >> 2) % 40, 10, 6, 0, 0, 6.29); g.fill(); }
      else { g.fillStyle = 'rgba(176,124,255,0.08)'; g.beginPath(); g.moveTo(x + 10, y - LIFT + CS - 10); g.lineTo(x + CS / 2, y - LIFT + 8); g.lineTo(x + CS - 10, y - LIFT + CS - 20); g.closePath(); g.fill(); }
      g.fillStyle = W.edge;
      if (!solidCell(m, cx, cy - 1)) g.fillRect(x, y - LIFT, CS, 2);
      if (!solidCell(m, cx - 1, cy)) g.fillRect(x, y - LIFT, 2, CS);
      if (!solidCell(m, cx + 1, cy)) g.fillRect(x + CS - 2, y - LIFT, 2, CS);
      if (m.wall.style === 'plaza' && openBelow && v0 === 1) { g.fillStyle = W.accent; for (let k = 0; k < CS; k += 16) g.fillRect(x + k, y + CS - LIFT + 5, 8, 4); }
    }
  }

  // minimap: a window of cells around the player, cached per player cell
  const MW = 44;
  function drawMini(g, m, x, y, size, run, extra) {
    const pcx = Math.floor(run.p.x / CS), pcy = Math.floor(run.p.y / CS), k = pcx + ',' + pcy + (m.arena ? 'A' : '');
    if (k !== m.miniKey) {
      m.miniKey = k;
      const c = m.mini || (m.mini = document.createElement('canvas')); c.width = c.height = MW * 3;
      const gg = c.getContext('2d');
      gg.fillStyle = 'rgba(8,10,16,0.88)'; gg.fillRect(0, 0, c.width, c.height);
      for (let yy = 0; yy < MW; yy++) for (let xx = 0; xx < MW; xx++) {
        const v = cell(m, pcx - MW / 2 + xx, pcy - MW / 2 + yy);
        if (v) { gg.fillStyle = v === 2 ? '#ff4f6a' : m.wall.edge; gg.fillRect(xx * 3, yy * 3, 3, 3); }
      }
    }
    const sc = size / (MW * CS), ox = (pcx - MW / 2) * CS, oy = (pcy - MW / 2) * CS;
    const P = (wx, wy) => [x + (wx - ox) * sc, y + (wy - oy) * sc];
    const inside = ([a, b]) => a >= x && b >= y && a <= x + size && b <= y + size;
    g.save();
    g.drawImage(m.mini, x, y, size, size);
    g.strokeStyle = 'rgba(255,211,110,0.4)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    g.beginPath(); g.rect(x, y, size, size); g.clip();
    for (const L of extra.loot) { const p = P(L.x, L.y); if (inside(p)) { g.fillStyle = L.kind === 'chest' ? '#ffd36e' : L.kind === 'shrine' ? '#6fdc8c' : '#c99be0'; g.fillRect(p[0] - 2, p[1] - 2, 4, 4); } }
    g.fillStyle = '#ff4f6a';
    for (let i = 0; i < run.enemies.length; i += Math.max(1, Math.floor(run.enemies.length / 120))) { const e = run.enemies[i]; const p = P(e.x, e.y); g.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
    for (const e of run.enemies) if (e.type === 'boss' || e.type === 'elite') { const p = P(e.x, e.y); g.fillStyle = e.type === 'boss' ? '#ff2244' : '#ffb84d'; g.beginPath(); g.arc(p[0], p[1], e.type === 'boss' ? 4 : 3, 0, 6.29); g.fill(); }
    const pp = P(run.p.x, run.p.y); g.fillStyle = '#fff'; g.beginPath(); g.arc(pp[0], pp[1], 2.8, 0, 6.29); g.fill();
    g.restore();
    // arena marker (clamped to the minimap edge when off-window)
    if (extra.arena) {
      let [ax, ay] = P(extra.arena.x, extra.arena.y);
      const cx = x + size / 2, cy = y + size / 2;
      if (!inside([ax, ay])) { const a = Math.atan2(ay - cy, ax - cx), r = size / 2 - 5; ax = cx + Math.cos(a) * r; ay = cy + Math.sin(a) * r; }
      g.fillStyle = '#ff2244'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(ax, ay, 5, 0, 6.29); g.fill(); g.stroke();
    }
  }

  return { CS, create, solid, collide, updateFlow, steer, spawnPoint, center, placeArena, draw, drawMini };
})();
