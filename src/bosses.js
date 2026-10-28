// Wordforge — bosses. An area boss on waves 6, 11 and 16 of every 20, and a major boss
// (The Unwriter) on wave 20, 40, … Bosses run a loop of telegraphed attack patterns;
// the major boss has three phases that add patterns and speed up.
window.WF = window.WF || {};

WF.isBossWave = w => { const k = ((w - 1) % 20) + 1; return k === 6 || k === 11 || k === 16 || k === 20; };
WF.isMajorBoss = w => w % 20 === 0;
// minor bosses rotate so every one of them shows up: 6, 11, 16 → crypt, storm, void; 26, 31, 36 → frost, marsh, crypt …
WF.BOSS_ORDER = ['crypt', 'storm', 'void', 'bone', 'mirror', 'frost', 'hive', 'marsh', 'colossus'];
WF.majorForWave = w => (w % 40 === 0 ? WF.BOSSES.silence : WF.BOSSES.major);
WF.BOSS_HP_MULT = 2.2; // bosses were too easy; this is the main tuning knob
WF.bossForWave = w => { const k = ((w - 1) % 20) + 1, n = Math.floor((w - 1) / 20) * 3 + [6, 11, 16].indexOf(k), L = WF.BOSS_ORDER.length; return WF.BOSSES[WF.BOSS_ORDER[((n % L) + L) % L]]; };

WF.BOSSES = {
  crypt: { name: 'Cinder Golem',   title: 'Keeper of the First Fire', color: '#ff8a3d', r: 46, hp: 900,  speed: 52, pats: ['charge', 'ring', 'summon'], shape: 'golem' },
  frost: { name: 'Glacial Warden', title: 'Librarian of Silence',     color: '#9fdcff', r: 44, hp: 850,  speed: 46, pats: ['aimed', 'slowzone', 'ring'], shape: 'warden' },
  storm: { name: 'Storm Herald',   title: 'Voice of the Spire',       color: '#ffe14d', r: 42, hp: 850,  speed: 62, pats: ['strike', 'aimed', 'ring'], shape: 'herald' },
  marsh: { name: 'Rot Mother',     title: 'She Who Composts',         color: '#8dff5a', r: 52, hp: 1000, speed: 38, pats: ['summon', 'puddle', 'aimed'], shape: 'mother' },
  void:  { name: 'Void Eye',       title: 'It Was Always Watching',   color: '#b07cff', r: 44, hp: 900,  speed: 42, pats: ['spiral', 'summon', 'strike'], shape: 'eye' },
  bone:     { name: 'Bone Choir',     title: 'Every rib a singing voice',  color: '#e8e2d0', r: 48, hp: 950,  speed: 44, pats: ['bonewall', 'summon', 'ring'], shape: 'choir' },
  mirror:   { name: 'Mirror Wraith',  title: 'You are already behind you',  color: '#cfefff', r: 40, hp: 820,  speed: 58, pats: ['teleport', 'aimed', 'teleport', 'spiral'], shape: 'wraith' },
  hive:     { name: 'Hive Queen',     title: 'Ten thousand small mouths',   color: '#ffb84d', r: 50, hp: 980,  speed: 40, pats: ['swarm', 'spiral', 'aimed'], shape: 'hive' },
  colossus: { name: 'Iron Colossus',  title: 'It does not stop. It turns.', color: '#b9c2d6', r: 54, hp: 1150, speed: 34, pats: ['laser', 'ring', 'charge'], shape: 'colossus' },
  silence:  { name: 'The Silence',    title: 'After the last word',        color: '#9a5cff', r: 66, hp: 5400, speed: 50, shape: 'silence',
              phases: [['laser', 'bonewall', 'summon'], ['teleport', 'laser', 'spiral', 'bonewall'], ['laser', 'teleport', 'spiral', 'ring', 'strike']] },
  major: { name: 'The Unwriter',   title: 'Erases every word you know', color: '#ff4f6a', r: 64, hp: 4200, speed: 56, shape: 'unwriter',
           phases: [['spiral', 'aimed', 'summon'], ['charge', 'strike', 'ring', 'summon'], ['spiral', 'strike', 'charge', 'ring', 'puddle']] },
};

WF.Bosses = {
  // api: { run, player, spawnEnemy(type,x,y), hurt(dmg), map, sound(name), shake(n), rand }
  update(e, dt, api) {
    const B = e.boss, ai = e.ai, p = api.player;
    // phases (major boss)
    if (B.phases) {
      const ph = e.hp / e.maxHp < 0.33 ? 2 : e.hp / e.maxHp < 0.66 ? 1 : 0;
      if (ph !== ai.phase) { ai.phase = ph; ai.cd = 1.2; ai.state = null; api.phaseChange(e, ph); }
    }
    const pats = B.phases ? B.phases[ai.phase || 0] : B.pats;
    const speedK = 1 + (ai.phase || 0) * 0.25;
    ai.t += dt;

    // active pattern
    if (ai.state) {
      const s = ai.state; s.t += dt;
      const P = PATTERNS[s.kind];
      if (P.tick(e, s, dt * speedK, api)) { ai.state = null; ai.cd = (B.phases ? 1.1 : 1.5) / speedK; }
      return s.kind === 'charge' && s.phase === 'dash';
    }
    ai.cd -= dt;
    if (ai.cd <= 0) {
      const kind = pats[ai.next++ % pats.length];
      ai.state = { kind, t: 0 }; PATTERNS[kind].start(e, ai.state, api);
    }
    return false;
  },
};

const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
function bullet(api, x, y, a, sp, dmg, color, r = 7) { api.run.eprojs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, dmg, color, life: 6 }); }

const PATTERNS = {
  ring: {
    start(e, s) { s.n = 0; s.waves = e.boss.phases ? 3 : 2; },
    tick(e, s, dt, api) {
      if (s.t > 0.5 * s.n + 0.3) {
        const n = e.boss.phases ? 26 : 18, off = s.n * 0.17;
        for (let i = 0; i < n; i++) bullet(api, e.x, e.y, off + i * Math.PI * 2 / n, 170, 10, e.boss.color);
        api.sound('ring'); s.n++;
      }
      return s.n >= s.waves;
    },
  },
  spiral: {
    start(e, s) { s.a = Math.random() * 6; s.fire = 0; },
    tick(e, s, dt, api) {
      s.fire -= dt; s.a += dt * 2.4;
      if (s.fire <= 0) { s.fire = 0.09; for (let k = 0; k < 3; k++) bullet(api, e.x, e.y, s.a + k * Math.PI * 2 / 3, 150, 8, e.boss.color, 6); }
      return s.t > 3.2;
    },
  },
  aimed: {
    start(e, s) { s.n = 0; },
    tick(e, s, dt, api) {
      if (s.t > 0.45 * s.n + 0.35) {
        const a = ang(e, api.player);
        for (let k = -2; k <= 2; k++) bullet(api, e.x, e.y, a + k * 0.16, 250, 11, e.boss.color);
        api.sound('aimed'); s.n++;
      }
      return s.n >= 3;
    },
  },
  charge: {
    start(e, s, api) { s.phase = 'aim'; s.a = ang(e, api.player); api.run.hazards.push({ kind: 'line', x: e.x, y: e.y, a: s.a, len: 520, w: e.r * 1.6, t: 0, life: 0.8, color: '#ff3355' }); api.sound('tele'); },
    tick(e, s, dt, api) {
      if (s.phase === 'aim') { if (s.t > 0.8) { s.phase = 'dash'; s.t = 0; api.sound('charge'); } return false; }
      const sp = 950;
      e.x += Math.cos(s.a) * sp * dt; e.y += Math.sin(s.a) * sp * dt;
      if (Math.random() < 0.6) api.trail(e);
      const hitWall = api.map && WF.Map.collide(api.map, e);
      if (hitWall || s.t > 0.55) { api.shake(10); api.sound('slam'); for (let i = 0; i < 12; i++) bullet(api, e.x, e.y, i * Math.PI / 6, 140, 9, e.boss.color, 6); return true; }
      return false;
    },
  },
  strike: {
    start(e, s, api) {
      const p = api.player, n = e.boss.phases ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const x = p.x + (i ? api.rand(-170, 170) : 0), y = p.y + (i ? api.rand(-170, 170) : 0);
        api.run.hazards.push({ kind: 'tele', x, y, r: 62, t: 0, delay: 1 + i * 0.08, dmg: 16, after: 'bolt', color: e.boss.color });
      }
      api.sound('tele');
    },
    tick(e, s) { return s.t > 1.6; },
  },
  slowzone: {
    start(e, s, api) {
      const p = api.player;
      for (let i = 0; i < 4; i++) api.run.hazards.push({ kind: 'tele', x: p.x + api.rand(-140, 140), y: p.y + api.rand(-140, 140), r: 80, t: 0, delay: 0.9, dmg: 8, after: 'slow', color: '#9fdcff' });
      api.sound('tele');
    },
    tick(e, s) { return s.t > 1.3; },
  },
  puddle: {
    start(e, s, api) {
      const p = api.player;
      for (let i = 0; i < 4; i++) api.run.hazards.push({ kind: 'tele', x: p.x + api.rand(-160, 160), y: p.y + api.rand(-160, 160), r: 70, t: 0, delay: 0.8, dmg: 6, after: 'puddle', color: '#8dff5a' });
      api.sound('tele');
    },
    tick(e, s) { return s.t > 1.2; },
  },
  bonewall: {
    start(e, s) { s.n = 0; },
    tick(e, s, dt, api) {
      if (s.t > 0.75 * s.n + 0.3) {
        const a = ang(e, api.player), px = -Math.sin(a), py = Math.cos(a), gap = Math.floor(Math.random() * 10) - 5;
        for (let k = -9; k <= 9; k++) { if (k >= gap - 1 && k <= gap + 1) continue; bullet(api, e.x + px * k * 28, e.y + py * k * 28, a, 150, 10, e.boss.color, 7); }
        api.sound('ring'); s.n++;
      }
      return s.n >= (e.boss.phases ? 4 : 3);
    },
  },
  teleport: {
    start(e, s, api) {
      const p = api.player, a = Math.random() * Math.PI * 2;
      s.tx = p.x + Math.cos(a) * 190; s.ty = p.y + Math.sin(a) * 190;
      if (api.map && WF.Map.solid(api.map, s.tx, s.ty)) { s.tx = e.x; s.ty = e.y; }
      api.run.hazards.push({ kind: 'tele', x: s.tx, y: s.ty, r: e.r + 10, t: 0, delay: 0.85, dmg: 14, after: null, color: e.boss.color });
      api.sound('tele');
    },
    tick(e, s, dt, api) {
      if (s.t > 0.85 && !s.done) {
        s.done = true; api.trail(e); e.x = s.tx; e.y = s.ty; api.shake(6);
        for (let i = 0; i < 14; i++) bullet(api, e.x, e.y, i * Math.PI / 7, 150, 9, e.boss.color, 6);
      }
      return s.t > 1.2;
    },
  },
  laser: {
    start(e, s, api) { s.a = ang(e, api.player) - 1.2; s.dir = Math.random() < 0.5 ? 1 : -1; if (s.dir < 0) s.a += 2.4; api.run.hazards.push({ kind: 'sweep', boss: e, a: s.a, dir: s.dir, speed: e.boss.phases ? 1.1 : 0.85, len: 620, w: 22, t: 0, warm: 0.9, life: 3.4, dmg: 14, color: e.boss.color }); api.sound('tele'); },
    tick(e, s) { return s.t > 3.5; },
  },
  swarm: {
    start(e, s, api) { for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10; const m = api.spawnEnemy('runner', e.x + Math.cos(a) * (e.r + 30), e.y + Math.sin(a) * (e.r + 30)); if (m) m.speed *= 1.25; } api.sound('summon'); },
    tick(e, s) { return s.t > 0.8; },
  },
  summon: {
    start(e, s, api) {
      const n = e.boss.phases ? 8 : 6;
      for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; api.spawnEnemy(i % 3 ? 'grunt' : 'runner', e.x + Math.cos(a) * (e.r + 40), e.y + Math.sin(a) * (e.r + 40)); }
      api.sound('summon');
    },
    tick(e, s) { return s.t > 0.8; },
  },
};
