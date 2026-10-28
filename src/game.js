// Wordforge — core game loop.
(function () {
  const $ = id => document.getElementById(id);
  const C = $('game'), ctx = C.getContext('2d');
  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    C.width = W * dpr; C.height = H * dpr; C.style.width = W + 'px'; C.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  const Save = WF.Save; Save.load();
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const elColor = el => (WF.ELEMENTS[el] || WF.ELEMENTS.fire).color;

  // ---------- input ----------
  const keys = {};
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => WF.Audio.init(), { capture: true }));
  addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape' && (state === 'play' || state === 'paused')) togglePause(); });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  const touch = { active: false, ox: 0, oy: 0, x: 0, y: 0, id: null };
  C.addEventListener('pointerdown', e => {
    touch.active = true; touch.id = e.pointerId; touch.ox = touch.x = e.clientX; touch.oy = touch.y = e.clientY;
  });
  addEventListener('pointermove', e => { if (touch.active && e.pointerId === touch.id) { touch.x = e.clientX; touch.y = e.clientY; } });
  addEventListener('pointerup', e => { if (e.pointerId === touch.id) touch.active = false; });
  addEventListener('pointercancel', () => { touch.active = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

  // ---------- state ----------
  let state = 'title';
  let run = null;
  let curse = WF.curseFor(0);
  const DEV = { god: false, speed: 1, hitboxes: false };

  const ENEMY = {
    grunt:  { r: 12, hp: 12,  speed: 72,  dmg: 8,  color: '#d9dde6', shape: 'sq',  drop: 0.22, xp: 1 },
    runner: { r: 9,  hp: 7,   speed: 128, dmg: 6,  color: '#ff9fa8', shape: 'tri', drop: 0.18, xp: 1 },
    brute:  { r: 22, hp: 60,  speed: 46,  dmg: 15, color: '#9aa3b8', shape: 'sq',  drop: 0.85, xp: 4 },
    elite:  { r: 32, hp: 420, speed: 58,  dmg: 22, color: '#ffd36e', shape: 'dia', drop: 1,    xp: 20 },
    spitter:{ r: 11, hp: 16,  speed: 62,  dmg: 6,  color: '#ffb84d', shape: 'spit', drop: 0.3, xp: 3 },
    boss:   { r: 46, hp: 900, speed: 50,  dmg: 26, color: '#ff4f6a', shape: 'boss', drop: 1,   xp: 120 },
  };

  function newRun() {
    curse = WF.curseFor(0);
    Save.touchDay();
    const st = WF.statsForRun();
    const maxHp = Math.round(st.hp * (curse.mods.playerHp || 1));
    run = {
      t: 0, wave: 0, kills: 0,
      p: { x: 0, y: 0, vx: 0, vy: 0, r: 13, hp: maxHp, maxHp, iframe: 0, speed: 215, dr: 0, slowed: 0 },
      cam: { x: 0, y: 0 }, st, dist: 0, loot: [], lootSeen: new Set(), arena: null, lvl: 1, xp: 0, xpNext: WF.xpForLevel(1), lvlQueue: 0, taken: {},
      enemies: [], projs: [], eprojs: [], hazards: [], fx: [], parts: [], texts: [], runes: [], minions: [],
      slots: [null, null, null], bag: [], quota: 0, spawnT: 0, waveT: 0, banner: 0, boss: null, bossPending: 0,
      discoveries: [], points: 0, xpGained: 0, biomeIdx: -1, prevBiomeIdx: -1, biomeFade: 1, areaBanner: 0, ducked: false, waveHurt: false,
      lightning: 0, lightT: 6, shake: 0, orbitAng: 0, hitstop: 0, flash: null, hpLag: maxHp, bagBump: 0, waveTotal: 1, trail: [], trailT: 0, face: 0, map: null,
    };
    const start = Save.data.grimoire[Save.data.loadout] || WF.STARTER;
    run.slots[0] = mkSlot(start);
    const n = 2 + Save.bonusRunes();
    for (let i = 0; i < n; i++) run.bag.push(randomRune());
    startWave();
    state = 'play';
    hideAll(); setPlaying(true);
  }

  function mkSlot(spell) { return { spell, cd: rand(0.1, 0.5), cdMax: 1 }; }
  function setCd(slot, v) { v /= run.st.haste; slot.cd = v; slot.cdMax = v; WF.Audio.cast(slot.spell.element, slot.spell.form); }
  function randomRune() {
    const wildChance = 0.03 * (curse.mods.wild || 1);
    return Math.random() < wildChance ? '*' : pick(WF.RUNE_POOL);
  }

  function enterArea(bi) {
    run.prevBiomeIdx = run.biomeIdx; run.biomeIdx = bi; run.biomeFade = run.prevBiomeIdx < 0 ? 1 : 0; run.areaBanner = 3.2;
    run.map = WF.Map.create(WF.BIOMES[bi].id, (Math.random() * 1e9) >>> 0);
    const c = WF.Map.center();
    run.p.x = c.x; run.p.y = c.y; run.p.vx = run.p.vy = 0; run.cam.x = c.x; run.cam.y = c.y;
    run.enemies = []; run.eprojs = []; run.hazards = []; run.runes = []; run.minions = []; run.projs = []; run.fx = []; run.trail = []; run.loot = []; run.lootSeen = new Set(); run.arena = null;
    WF.Map.updateFlow(run.map, c.x, c.y, 1);
    WF.Audio.areaEnter(); WF.Audio.setAmbience(WF.BIOMES[bi].id);
  }

  function startWave() {
    run.wave++;
    const w = run.wave, bossWave = WF.isBossWave(w);
    run.quota = bossWave ? Math.round((6 + w) * (curse.mods.count || 1)) : Math.round((16 + w * 8) * (curse.mods.count || 1));
    run.spawnT = 0.5; run.waveT = 0; run.banner = 1.8;
    run.eliteSpawned = bossWave || w % 4 !== 0;
    run.boss = null; run.bossPending = bossWave ? 1 : 0;
    run.waveTotal = run.quota + (run.eliteSpawned ? 0 : 1) + (bossWave ? 1 : 0);
    run.waveHurt = false; run.ducked = false;
    WF.Audio.duck(1, 20000, 1.2);
    WF.Challenges.max('wave', w);
    if (w === 30) WF.Stats.min('bestW30', run.t);
    const bi = WF.biomeIndex(w);
    if (bi !== run.biomeIdx) enterArea(bi); else WF.Audio.waveStart();
    if (bossWave) { run.arena = WF.Map.placeArena(run.map, run.p.x, run.p.y); toast('A boss awaits. Follow the red arrow to its arena.'); }
    else run.arena = null;
    WF.Audio.playTrack(bossWave ? (WF.isMajorBoss(w) ? 'major' : 'boss') : WF.BIOMES[bi].music);
  }

  function spawnEnemy(type, x, y) {
    const T = ENEMY[type], w = run.wave, B = WF.BIOMES[Math.max(0, run.biomeIdx)];
    if (x === undefined) {
      const minD = Math.hypot(W, H) * 0.55 + 30;
      const pt = WF.Map.spawnPoint(run.map, run.p.x, run.p.y, minD, minD + 320);
      x = pt.x; y = pt.y;
    }
    const hpScale = (1 + 0.24 * (w - 1) + 0.025 * (w - 1) ** 2) * (curse.mods.enemyHp || 1);
    const e = {
      type, x, y, r: T.r,
      hp: T.hp * hpScale, maxHp: T.hp * hpScale, speed: T.speed * (1 + 0.015 * w) * (curse.mods.enemySpeed || 1),
      dmg: T.dmg, color: type === 'spitter' ? B.light : (B.enemy[type] || T.color), body: B.enemy.body, eye: B.enemy.eye, deco: B.enemy.deco, glowC: B.light, shape: T.shape, flash: 0,
      shootT: rand(1.5, 3), windup: 0, spawn: type === 'elite' ? 0.9 : 0.45, spawnMax: type === 'elite' ? 0.9 : 0.45, seed: Math.random() * 6.28, face: 0, burn: 0, burnDps: 0, slow: 0, freeze: 0, freezeCd: 0, poison: 0, stacks: 0, weak: 0, hitcd: {}, kx: 0, ky: 0,
    };
    run.enemies.push(e);
    return e;
  }

  function spawnBoss() {
    const w = run.wave, major = WF.isMajorBoss(w);
    const def = major ? WF.majorForWave(w) : WF.bossForWave(w);
    const pt = run.arena ? { x: run.arena.x, y: run.arena.y } : WF.Map.spawnPoint(run.map, run.p.x, run.p.y, 360, 520);
    const e = spawnEnemy('boss', pt.x, pt.y);
    const hp = def.hp * WF.BOSS_HP_MULT * (1 + 0.14 * (w - 1)) * (curse.mods.enemyHp || 1);
    Object.assign(e, { boss: def, r: def.r, hp, maxHp: hp, speed: def.speed, color: def.color, glowC: def.color, deco: null, spawn: 1.2, spawnMax: 1.2, ai: { t: 0, cd: 2, next: 0, phase: 0, state: null } });
    run.boss = e; run.bossPending = 0;
    run.shake = 8; WF.Audio.bossRoar(major); toast(`${def.name}: ${def.title}`);
  }

  function pickType() {
    const w = run.wave, r = Math.random();
    if (w >= 3 && r < 0.14) { const n = run.enemies.reduce((a, e) => a + (e.type === 'spitter'), 0); if (n < Math.min(6, 1 + Math.floor(w / 4))) return 'spitter'; }
    if (w >= 3 && r < 0.10) return 'brute';
    if (w >= 2 && r < 0.38) return 'runner';
    return 'grunt';
  }

  // ---------- damage ----------
  function pm(spell) { return 0.55 + spell.power * 0.11; }
  function elMult(spell) {
    let m = (curse.mods.dmg || 1) * run.st.dmg;
    if (curse.mods.el && curse.mods.el[spell.element]) m *= curse.mods.el[spell.element];
    return m;
  }

  function hit(e, amount, spell, opts = {}) {
    if (e.dead) return;
    let dmg = amount * elMult(spell);
    if (spell.tags.includes('pierce') && spell.form !== 'bolt' && spell.form !== 'beam') dmg *= 1.15;
    if (e.freeze > 0) dmg *= 1.2;
    if (e.weak > 0) dmg *= 1.25;
    const crit = Math.random() < run.st.crit;
    if (crit) dmg *= 2;
    e.hp -= dmg; e.flash = 0.08;
    if (!opts.quiet) { addText(e.x, e.y - e.r, Math.round(dmg), crit ? '#fff3c4' : elColor(spell.element), crit); WF.Audio.hit(spell.element); }
    if (curse.mods.voidHeal && spell.element === 'void') healP(0.25);
    const boss = e.type === 'boss';
    for (const t of spell.tags) {
      if (t === 'burn') { e.burn = 3; e.burnDps = Math.max(e.burnDps, 3 * pm(spell) * run.st.dmg); }
      else if (t === 'freeze' && e.freezeCd <= 0) { e.freeze = boss ? 0.15 : e.type === 'elite' ? 0.3 : 0.8; e.freezeCd = boss ? 4 : 2.2; }
      else if (t === 'slow') e.slow = boss ? 0.6 : 2;
      else if (t === 'poison') { e.stacks = Math.min(6, e.stacks + 1); e.poison = 4; }
      else if (t === 'weaken') e.weak = 3;
      else if (t === 'knockback' && !boss) {
        const dx = e.x - run.p.x, dy = e.y - run.p.y, L = Math.hypot(dx, dy) || 1;
        const k = e.type === 'elite' ? 4 : e.type === 'brute' ? 12 : 26;
        e.kx += dx / L * k * 10; e.ky += dy / L * k * 10;
      }
    }
    if (spell.secondary) {
      const t = WF.ELEMENTS[spell.secondary].tag;
      if (t === 'burn' && !e.burn) { e.burn = 2; e.burnDps = 2 * pm(spell); }
      if (t === 'slow' && !e.slow) e.slow = 1;
      if (t === 'weaken' && !e.weak) e.weak = 1.5;
    }
    if (e.hp <= 0) kill(e, spell);
  }

  function hurtPlayer(dmg, src) {
    const p = run.p;
    if (p.iframe > 0 || DEV.god) return;
    const d = dmg * (1 - Math.min(0.7, p.dr + run.st.armor));
    p.hp -= d; p.iframe = 0.45;
    run.shake = Math.max(run.shake, 7); run.hitstop = Math.max(run.hitstop, 0.05); run.flash = { c: '#ff2040', a: 0.28 }; run.waveHurt = true; WF.Audio.hurt();
    addText(p.x, p.y - 20, '-' + Math.round(d), '#ff5566');
  }

  function gainXP(n) {
    run.xp += n; run.xpGained += n;
    while (run.xp >= run.xpNext) {
      run.xp -= run.xpNext; run.lvl++; run.xpNext = WF.xpForLevel(run.lvl); run.lvlQueue++;
      run.fx.push({ kind: 'ring', x: run.p.x, y: run.p.y, r: 120, t: 0, life: 0.5, color: '#ffd36e' });
      WF.Audio.levelUp();
    }
  }

  function kill(e, spell) {
    e.dead = true;
    run.kills++;
    const T = ENEMY[e.type];
    const pts = { grunt: 1, runner: 1, brute: 5, elite: 30, boss: e.boss && e.boss.phases ? 600 : 150 }[e.type] || 1;
    run.points += pts; Save.data.points = (Save.data.points || 0) + pts;
    if (e.type !== 'grunt' && e.type !== 'runner') addText(e.x, e.y - e.r - 14, '+' + pts + ' ◆', '#ffd36e');
    gainXP(e.type === 'boss' && e.boss.phases ? 400 : T.xp);
    WF.Audio.kill(e.type === 'boss' ? 'elite' : e.type);
    WF.Challenges.bump('kills'); WF.Stats.add('kills');
    if (e.type === 'boss') { WF.Stats.add('bosses'); if (e.boss.phases) WF.Stats.add('majors'); }
    if (e.type === 'elite') WF.Challenges.bump('elites');
    if (e.type === 'boss') WF.Challenges.bump('bosses');
    if (e.burn > 0) WF.Challenges.bump('burnKills');
    if (spell) WF.Challenges.bump('el_' + spell.element);
    const kc = spell ? elColor(spell.element) : '#ffffff';
    burst(e.x, e.y, kc, e.type === 'boss' ? 80 : e.type === 'elite' ? 40 : 8);
    shards(e.x, e.y, e.color, e.type === 'boss' ? 24 : e.type === 'elite' ? 14 : e.type === 'brute' ? 8 : 4, Math.min(e.r, 30));
    run.fx.push({ kind: 'pop', x: e.x, y: e.y, r: e.r * 2.2, t: 0, life: 0.25, color: kc });
    if (e.type === 'boss') {
      run.shake = 22; run.hitstop = 0.3; run.flash = { c: '#ffffff', a: 0.7 };
      run.eprojs = []; run.hazards = [];
      for (const o of run.enemies) if (o !== e && !o.dead) { o.dead = true; burst(o.x, o.y, '#ffffff', 4); }
      run.quota = 0; run.boss = null;
      toast(`${e.boss.name} defeated! +${pts} ◆`, 'ch');
    } else if (e.type === 'elite') { run.shake = Math.max(run.shake, 14); run.hitstop = 0.14; run.flash = { c: '#fff3d0', a: 0.5 }; }
    else if (e.type === 'brute') { run.hitstop = Math.max(run.hitstop, 0.035); run.shake = Math.max(run.shake, 4); }
    if (spell && spell.tags.includes('heal')) healP(1.5);
    if (spell && spell.tags.includes('split')) {
      for (let i = 0; i < 2; i++) {
        const a = rand(0, Math.PI * 2);
        run.projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 4, dmg: 6 * pm(spell), spell: noSplit(spell), life: 0.6, pierce: 0, hits: new Set() });
      }
    }
    const dropMul = (curse.mods.drop || 1) * run.st.luck;
    if (e.type === 'boss') { for (let i = 0; i < 6; i++) dropRune(e.x + rand(-40, 40), e.y + rand(-40, 40), i < 2 ? '*' : randomRune()); }
    else if (e.type === 'elite') { dropRune(e.x, e.y, '*'); dropRune(e.x + 20, e.y, randomRune()); dropRune(e.x - 20, e.y, randomRune()); }
    else if (Math.random() < T.drop * dropMul) dropRune(e.x, e.y, randomRune());
  }
  const _ns = new WeakMap();
  function noSplit(s) { if (!_ns.has(s)) _ns.set(s, Object.assign({}, s, { tags: s.tags.filter(t => t !== 'split') })); return _ns.get(s); }

  function dropRune(x, y, word) { run.runes.push({ x, y, word, t: 0, vx: rand(-60, 60), vy: rand(-60, 60), r: 6 }); }
  function healP(n) { run.p.hp = Math.min(run.p.maxHp, run.p.hp + n); }

  function nearest(x, y, maxD = 1e9, exclude) {
    let best = null, bd = maxD * maxD;
    for (const e of run.enemies) {
      if (e.dead || e.spawn > 0 || (exclude && exclude.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------- spells ----------
  function updateSlots(dt) {
    const p = run.p, S = run.st, M = S.multi, A = S.area;
    p.dr = 0;
    run.orbitAng += dt;
    run.slots.forEach((slot, i) => {
      if (!slot) return;
      const s = slot.spell, m = pm(s), rate = s.rate;
      slot.cd -= dt;
      switch (s.form) {
        case 'bolt': if (slot.cd <= 0) {
          const t = nearest(p.x, p.y, 560); if (!t) break;
          setCd(slot, 0.65 / rate);
          const n = 1 + (s.power >= 7 ? 1 : 0) + M;
          for (let k = 0; k < n; k++) {
            const a = Math.atan2(t.y - p.y, t.x - p.x) + (k - (n - 1) / 2) * 0.18;
            run.projs.push({ x: p.x, y: p.y, vx: Math.cos(a) * 470, vy: Math.sin(a) * 470, r: 5 + s.power * 0.3, dmg: 9 * m, spell: s, life: 1.3, pierce: s.tags.includes('pierce') ? 3 : 0, hits: new Set() });
          }
        } break;
        case 'nova': if (slot.cd <= 0) {
          const R = (90 + s.power * 6) * A;
          if (!nearest(p.x, p.y, R + 60)) break;
          setCd(slot, 2.3 / rate);
          const pulse = (rr, delay) => run.fx.push({ kind: 'ring', x: p.x, y: p.y, r: rr, t: -delay, life: 0.35, color: elColor(s.element) });
          pulse(R, 0); if (M) pulse(R * 0.7, 0.12);
          for (const e of run.enemies) if (!e.dead && dist2(e, p) < (R + e.r) ** 2) hit(e, 16 * m * (1 + M * 0.25), s);
          run.shake = Math.max(run.shake, 3);
        } break;
        case 'orbit': {
          const n = 2 + Math.floor(s.power / 4) + M, R = 66 * A;
          const sp = 3.2 * rate * S.haste;
          slot.blades = [];
          for (let k = 0; k < n; k++) {
            const a = run.orbitAng * sp + k * Math.PI * 2 / n + i;
            const b = { x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R, r: 9 };
            slot.blades.push(b);
            for (const e of run.enemies) {
              if (e.dead || (e.hitcd[i] || 0) > 0) continue;
              if (dist2(e, b) < (e.r + b.r) ** 2) { e.hitcd[i] = 0.35; hit(e, 7 * m, s); }
            }
          }
        } break;
        case 'beam': if (slot.cd <= 0) {
          const t = nearest(p.x, p.y, 480); if (!t) break;
          setCd(slot, 1.7 / rate);
          const base = Math.atan2(t.y - p.y, t.x - p.x), L = 480 * A;
          for (let k = 0; k <= M; k++) {
            const a = base + (k ? (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35 : 0), ux = Math.cos(a), uy = Math.sin(a);
            run.fx.push({ kind: 'beam', x: p.x, y: p.y, x2: p.x + ux * L, y2: p.y + uy * L, t: 0, life: 0.22, w: 10 + s.power, color: elColor(s.element) });
            for (const e of run.enemies) {
              if (e.dead) continue;
              const dx = e.x - p.x, dy = e.y - p.y, proj = dx * ux + dy * uy;
              if (proj < 0 || proj > L) continue;
              if (Math.abs(dx * uy - dy * ux) < e.r + 8 + s.power) hit(e, 20 * m, s);
            }
          }
        } break;
        case 'zone': if (slot.cd <= 0) {
          const t = nearest(p.x, p.y, 420); if (!t) break;
          setCd(slot, 3.1 / rate);
          for (let k = 0; k <= M; k++) {
            const zx = k ? t.x + rand(-90, 90) : t.x, zy = k ? t.y + rand(-90, 90) : t.y;
            run.fx.push({ kind: 'zone', x: zx, y: zy, r: (55 + s.power * 4) * A, t: 0, life: 3.5, tick: 0, spell: s, color: elColor(s.element) });
          }
        } break;
        case 'chain': if (slot.cd <= 0) {
          let t = nearest(p.x, p.y, 400); if (!t) break;
          setCd(slot, 1.25 / rate);
          const jumps = 3 + (s.power >= 7 ? 1 : 0) + (curse.mods.chain || 0) + M * 2;
          const pts = [{ x: p.x, y: p.y }], seen = new Set();
          let d = 13 * m;
          for (let k = 0; k <= jumps && t; k++) {
            seen.add(t); pts.push({ x: t.x, y: t.y });
            hit(t, d, s); d *= 0.85;
            t = nearest(t.x, t.y, 170 * A, seen);
          }
          run.fx.push({ kind: 'chain', pts, t: 0, life: 0.2, color: elColor(s.element) });
        } break;
        case 'summon': {
          const max = 2 + Math.floor(s.power / 5) + M;
          const mine = run.minions.filter(mn => mn.slot === i).length;
          if (slot.cd <= 0 && mine < max) {
            setCd(slot, 3.6 / rate);
            run.minions.push({ slot: i, x: p.x, y: p.y, r: 7, life: 10, spell: s, hitcd: new Map() });
          }
        } break;
        case 'shield': {
          const R = (46 + s.power * 3) * A;
          p.dr = Math.max(p.dr, 0.35);
          slot.aura = R;
          for (const e of run.enemies) {
            if (e.dead || (e.hitcd[i] || 0) > 0) continue;
            if (dist2(e, p) < (R + e.r) ** 2) { e.hitcd[i] = 0.4 / S.haste; hit(e, 5 * m, s); }
          }
        } break;
      }
    });
  }

  // ---------- update ----------
  const angLerp = (a, b, k) => { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * k; };

  function update(dt) {
    const p = run.p, S = run.st, map = run.map;
    run.t += dt; run.waveT += dt;
    if (run.banner > 0) run.banner -= dt;

    // ---- movement: analog input → eased velocity → wall collision (smooth 360°) ----
    let mx = 0, my = 0;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (touch.active) {
      const dx = touch.x - touch.ox, dy = touch.y - touch.oy, L = Math.hypot(dx, dy);
      if (L > 6) { mx = dx / Math.max(L, 40); my = dy / Math.max(L, 40); }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const spd = p.speed * S.move * (p.slowed > 0 ? 0.55 : 1);
    if (p.slowed > 0) p.slowed -= dt;
    const accel = 1 - Math.exp(-dt * (ml > 0.1 ? 13 : 16));
    p.vx += (mx * spd - p.vx) * accel; p.vy += (my * spd - p.vy) * accel;
    const ox = p.x, oy = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    WF.Map.collide(map, p);
    run.dist += Math.hypot(p.x - ox, p.y - oy);
    const vlen = Math.hypot(p.vx, p.vy);
    p.moving = vlen > 25;
    if (p.moving) run.face = angLerp(run.face, Math.atan2(p.vy, p.vx), 1 - Math.exp(-dt * 14));
    const ck = 1 - Math.exp(-dt * 9);
    run.cam.x += (p.x + p.vx * 0.12 - run.cam.x) * ck; run.cam.y += (p.y + p.vy * 0.12 - run.cam.y) * ck;
    if (S.regen) healP(S.regen * dt);

    run.trailT -= dt;
    if (run.trailT <= 0) { run.trailT = 0.03; if (p.moving) run.trail.push({ x: p.x, y: p.y, life: 0.3 }); }
    for (const tr of run.trail) tr.life -= dt;
    run.trail = run.trail.filter(tr => tr.life > 0);
    if (run.hpLag > p.hp) run.hpLag = Math.max(p.hp, run.hpLag - 40 * dt); else run.hpLag = p.hp;
    if (run.bagBump > 0) run.bagBump -= dt * 4;
    if (run.flash) { run.flash.a -= dt * 1.6; if (run.flash.a <= 0) run.flash = null; }
    if (run.biomeFade < 1) run.biomeFade = Math.min(1, run.biomeFade + dt / 1.6);
    if (run.areaBanner > 0) run.areaBanner -= dt;
    WF.Audio.setIntensity(run.boss ? 3 : run.wave === 1 ? (run.waveT > 10 ? 2 : 1) : Math.min(3, 1 + (run.waveT > 4) + (run.waveT > 16 && run.wave >= 3)));
    {
      const remain = run.quota + run.enemies.length + (run.eliteSpawned ? 0 : 1) + (run.bossPending > 0 ? 1 : 0);
      if (!run.ducked && !run.boss && run.bossPending <= 0 && run.quota <= 0 && run.eliteSpawned && remain <= Math.max(4, run.waveTotal * 0.12)) { run.ducked = true; WF.Audio.duck(0.3, 1800, 2.5); }
    }
    const sk = WF.skinById(Save.data.skin);
    if (sk.emit && Math.random() < dt * sk.emit.rate) {
      const c = sk.emit.colors[(Math.random() * sk.emit.colors.length) | 0];
      run.parts.push({ x: p.x + rand(-8, 8), y: p.y + rand(-4, 8), vx: rand(-20, 20) - p.vx * 0.3, vy: rand(-60, -20) - p.vy * 0.3, life: rand(0.3, 0.6), color: c === 'hue' ? WF.skinHue(run.t + Math.random() * 3) : c, r: rand(1.5, 3), add: true, drag: 0.97 });
    }
    if (WF.BIOMES[run.biomeIdx] && WF.BIOMES[run.biomeIdx].ambient.kind === 'rain') {
      run.lightT -= dt; if (run.lightning > 0) run.lightning -= dt * 2.5;
      if (run.lightT <= 0) { run.lightT = rand(5, 11); run.lightning = 1; WF.Audio.thunder(); }
    }
    if (p.iframe > 0) p.iframe -= dt;
    WF.Map.updateFlow(map, p.x, p.y, dt);

    // ---- spawning ----
    if (run.quota > 0) {
      run.spawnT -= dt;
      if (run.spawnT <= 0) {
        const interval = Math.max(0.12, 0.6 - run.wave * 0.045) / (curse.mods.count || 1) * (run.boss ? 2.2 : 1);
        run.spawnT = interval;
        const pack = 1 + Math.floor(run.wave / 4);
        for (let k = 0; k < pack && run.quota > 0; k++) { spawnEnemy(pickType()); run.quota--; }
      }
    }
    if (!run.eliteSpawned && run.waveT > 6) { spawnEnemy('elite'); run.eliteSpawned = true; }
    if (run.bossPending > 0 && run.arena && dist2(p, run.arena) < run.arena.r * run.arena.r) spawnBoss();
    // loot from newly generated chunks
    if (map.newLoot.length) { for (const L of map.newLoot) if (!run.lootSeen.has(L.id)) { run.lootSeen.add(L.id); run.loot.push(Object.assign({ t: Math.random() * 6 }, L)); } map.newLoot = []; }
    for (const L of run.loot) {
      L.t += dt;
      if (dist2(L, p) < (p.r + 22) ** 2) { L.taken = true; openLoot(L); }
    }
    if (run.loot.length) run.loot = run.loot.filter(L => !L.taken && Math.abs(L.x - p.x) < 6000 && Math.abs(L.y - p.y) < 6000);

    updateSlots(dt);

    // ---- player projectiles (stop at walls) ----
    for (const pr of run.projs) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (WF.Map.solid(map, pr.x, pr.y)) { pr.life = 0; burst(pr.x, pr.y, elColor(pr.spell.element), 3); continue; }
      for (const e of run.enemies) {
        if (e.dead || e.spawn > 0 || pr.hits.has(e)) continue;
        if (dist2(e, pr) < (e.r + pr.r) ** 2) {
          pr.hits.add(e); hit(e, pr.dmg, pr.spell);
          if (pr.pierce-- <= 0) { pr.life = 0; break; }
        }
      }
    }
    run.projs = run.projs.filter(pr => pr.life > 0);

    // ---- enemy bullets & boss hazards ----
    for (const b of run.eprojs) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (WF.Map.solid(map, b.x, b.y)) { b.life = 0; continue; }
      if (dist2(b, p) < (b.r + p.r - 3) ** 2) { b.life = 0; hurtPlayer(b.dmg); }
    }
    run.eprojs = run.eprojs.filter(b => b.life > 0);
    for (const h of run.hazards) {
      h.t += dt;
      if (h.kind === 'tele' && h.t >= h.delay && !h.done) {
        h.done = true;
        if (dist2(h, p) < (h.r + p.r) ** 2) { hurtPlayer(h.dmg); if (h.after === 'slow') p.slowed = 2.5; }
        if (h.after === 'puddle') run.hazards.push({ kind: 'puddle', x: h.x, y: h.y, r: h.r, t: 0, life: 5, tick: 0, dmg: h.dmg, color: h.color });
        if (h.after === 'slow') run.hazards.push({ kind: 'frost', x: h.x, y: h.y, r: h.r, t: 0, life: 3.5, color: h.color });
        run.fx.push({ kind: 'ring', x: h.x, y: h.y, r: h.r * 1.2, t: 0, life: 0.3, color: h.color });
        if (h.after === 'bolt') run.fx.push({ kind: 'beam', x: h.x + rand(-20, 20), y: h.y - 600, x2: h.x, y2: h.y, t: 0, life: 0.25, w: 14, color: h.color });
        WF.Audio.bossBoom();
      }
      if (h.kind === 'puddle') { h.tick -= dt; if (h.tick <= 0 && dist2(h, p) < (h.r + p.r * 0.5) ** 2) { h.tick = 0.5; hurtPlayer(h.dmg); } }
      if (h.kind === 'frost' && dist2(h, p) < h.r * h.r) p.slowed = Math.max(p.slowed, 0.3);
      if (h.kind === 'sweep') {
        if (h.boss.dead) { h.t = h.life; continue; }
        h.x = h.boss.x; h.y = h.boss.y;
        if (h.t > h.warm) {
          h.a += h.dir * h.speed * dt;
          const ux = Math.cos(h.a), uy = Math.sin(h.a), dx = p.x - h.x, dy = p.y - h.y, pr = dx * ux + dy * uy;
          if (pr > 0 && pr < h.len && Math.abs(dx * uy - dy * ux) < h.w / 2 + p.r) hurtPlayer(h.dmg);
        }
      }
    }
    run.hazards = run.hazards.filter(h => h.kind === 'tele' ? h.t < h.delay + 0.05 : h.t < h.life);
    run.statT = (run.statT || 0) - dt;
    if (run.statT <= 0) { run.statT = 2; WF.Stats.flushRun(run); }

    // ---- fx ----
    for (const f of run.fx) {
      f.t += dt;
      if (f.kind === 'zone') {
        f.tick -= dt;
        if (f.tick <= 0) {
          f.tick = 0.4;
          for (const e of run.enemies) if (!e.dead && dist2(e, f) < (f.r + e.r) ** 2) hit(e, 5 * pm(f.spell), f.spell, { quiet: true });
        }
      }
    }
    run.fx = run.fx.filter(f => f.t < f.life);

    // ---- minions ----
    for (const mn of run.minions) {
      mn.life -= dt;
      const t = nearest(mn.x, mn.y, 600);
      const tx = t ? t.x : p.x + Math.cos(run.t * 2 + mn.slot) * 50, ty = t ? t.y : p.y + Math.sin(run.t * 2 + mn.slot) * 50;
      const dx = tx - mn.x, dy = ty - mn.y, L = Math.hypot(dx, dy) || 1;
      mn.x += dx / L * 200 * dt; mn.y += dy / L * 200 * dt;
      WF.Map.collide(map, mn);
      for (const e of run.enemies) {
        if (e.dead) continue;
        const cd = mn.hitcd.get(e) || 0;
        if (cd > run.t) continue;
        if (dist2(e, mn) < (e.r + mn.r + 2) ** 2) { mn.hitcd.set(e, run.t + 0.4); hit(e, 7 * pm(mn.spell), mn.spell); }
      }
    }
    run.minions = run.minions.filter(mn => mn.life > 0);

    // ---- enemies: flow-field steering around walls, smooth turning ----
    const bossApi = { run, player: p, map, rand, spawnEnemy: (tp, x, y) => spawnEnemy(tp, x, y), hurt: hurtPlayer, shake: n => { run.shake = Math.max(run.shake, n); },
      sound: n => WF.Audio.bossSfx(n), trail: e => run.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.35, color: e.color, r: e.r * 0.5, add: true }),
      phaseChange: (e, ph) => { run.flash = { c: '#ffffff', a: 0.45 }; run.shake = 14; toast(`${e.boss.name} — phase ${ph + 1}`); WF.Audio.bossRoar(true); run.eprojs = []; } };
    for (const e of run.enemies) {
      if (e.dead) continue;
      for (const k in e.hitcd) e.hitcd[k] -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.freezeCd > 0) e.freezeCd -= dt;
      if (e.weak > 0) e.weak -= dt;
      if (e.burn > 0) { e.burn -= dt; e.hp -= e.burnDps * dt; }
      if (e.poison > 0) { e.poison -= dt; e.hp -= 1.8 * e.stacks * dt * S.dmg; if (e.poison <= 0) e.stacks = 0; }
      if (curse.mods.regen && e.hp < e.maxHp) e.hp += e.maxHp * 0.02 * dt;
      if (e.hp <= 0) { kill(e, null); continue; }
      if (e.spawn > 0) { e.spawn -= dt; continue; }
      if (e.burn > 0 && Math.random() < dt * 14) run.parts.push({ x: e.x + rand(-e.r, e.r) * 0.7, y: e.y - e.r * 0.5, vx: rand(-10, 10), vy: rand(-70, -40), life: rand(0.3, 0.5), color: '#ff8a3d', r: rand(1.5, 3), add: true, drag: 0.98 });
      if (e.poison > 0 && Math.random() < dt * 8) run.parts.push({ x: e.x + rand(-e.r, e.r) * 0.7, y: e.y, vx: 0, vy: rand(-40, -20), life: 0.5, color: '#8dff5a', r: rand(1.5, 2.5), add: true, ring: true, drag: 0.98 });
      e.face = angLerp(e.face, Math.atan2(p.y - e.y, p.x - e.x), 1 - Math.exp(-dt * 8));
      let dashing = false;
      if (e.type === 'boss') dashing = WF.Bosses.update(e, dt, bossApi);
      let spitTarget = null;
      if (e.type === 'spitter') {
        const d = Math.sqrt(dist2(e, p));
        if (d < 230) spitTarget = { x: e.x + (e.x - p.x), y: e.y + (e.y - p.y) };
        else if (d < 340) { const a = Math.atan2(e.y - p.y, e.x - p.x) + 0.6; spitTarget = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }; }
        if (e.windup > 0) { e.windup -= dt; spitTarget = { x: e.x, y: e.y }; if (e.windup <= 0) { const a = Math.atan2(p.y - e.y, p.x - e.x); run.eprojs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, r: 6, dmg: 7, color: e.color, life: 4 }); WF.Audio.bossSfx('aimed'); } }
        else { e.shootT -= dt; if (e.shootT <= 0 && d < 520) { e.windup = 0.55; e.shootT = rand(2.8, 3.8); } }
      }
      let sp = e.speed;
      if (e.slow > 0) { e.slow -= dt; sp *= 0.5; }
      if (e.freeze > 0) { e.freeze -= dt; sp = 0; }
      if (!dashing) {
        const tgt = spitTarget || WF.Map.steer(map, e.x, e.y, p.x, p.y);
        const dx = tgt.x - e.x, dy = tgt.y - e.y, L = Math.hypot(dx, dy) || 1;
        e.x += (dx / L * sp + e.kx) * dt; e.y += (dy / L * sp + e.ky) * dt;
      }
      e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);
      WF.Map.collide(map, e);
      if (dist2(e, p) < (p.r + e.r) ** 2) hurtPlayer(e.dmg * (dashing ? 1.4 : 1));
    }
    // light separation so hordes don't stack
    const es = run.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i]; if (a.dead) continue;
      for (let j = i + 1; j < Math.min(es.length, i + 12); j++) {
        const b = es[j]; if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d > 0 && d < min) {
          const wa = a.type === 'boss' ? 0 : 0.5, wb = b.type === 'boss' ? 0 : 0.5, tot = (wa + wb) || 1;
          const push = (min - d), ux = dx / d, uy = dy / d;
          a.x -= ux * push * wa / tot; a.y -= uy * push * wa / tot; b.x += ux * push * wb / tot; b.y += uy * push * wb / tot;
        }
      }
    }
    run.enemies = run.enemies.filter(e => !e.dead);

    // ---- runes ----
    const magnet = 95 * S.magnet;
    for (const r of run.runes) {
      r.t += dt;
      r.x += r.vx * dt; r.y += r.vy * dt; r.vx *= 0.9; r.vy *= 0.9;
      const d = Math.sqrt(dist2(r, p));
      if (d < magnet) { r.x += (p.x - r.x) / d * 340 * dt; r.y += (p.y - r.y) / d * 340 * dt; }
      else WF.Map.collide(map, r);
      if (d < p.r + 10) {
        r.got = true;
        if (run.bag.length < 8) { run.bag.push(r.word); run.bagBump = 1; WF.Audio.pickup(run.bag.length, r.word === '*'); WF.Challenges.bump('runes'); run.fx.push({ kind: 'pop', x: p.x, y: p.y, r: 34, t: 0, life: 0.3, color: r.word === '*' ? '#c99be0' : '#ffd36e' }); addText(p.x, p.y - 30, r.word === '*' ? '✦ WILD' : r.word.toUpperCase(), '#ffd36e'); }
        else { healP(3); addText(p.x, p.y - 30, 'bag full +3hp', '#8b93a7'); }
      }
    }
    run.runes = run.runes.filter(r => !r.got);

    // ---- particles / texts ----
    for (const q of run.parts) { q.x += q.vx * dt; q.y += q.vy * dt; const dr = q.drag || 0.92; q.vx *= dr; q.vy *= dr; if (q.g) q.vy += q.g * dt; if (q.spin) q.rot += q.spin * dt; q.life -= dt; }
    run.parts = run.parts.filter(q => q.life > 0);
    for (const t of run.texts) { t.y -= 30 * dt; t.life -= dt; }
    run.texts = run.texts.filter(t => t.life > 0);
    if (run.shake > 0) run.shake = Math.max(0, run.shake - 30 * dt);

    if (p.hp <= 0) { p.hp = 0; endRun(); return; }
    if (run.lvlQueue > 0 && state === 'play') { openLevelUp(); return; }
    // wave clear → forge
    if (run.quota <= 0 && run.eliteSpawned && run.bossPending <= 0 && !run.boss && run.enemies.length === 0) {
      for (const r of run.runes) { if (run.bag.length < 8) run.bag.push(r.word); }
      run.runes = []; run.eprojs = []; run.hazards = [];
      healP(run.p.maxHp * 0.15);
      const bonus = 10 * run.wave; run.points += bonus; Save.data.points += bonus;
      if (!run.waveHurt) WF.Challenges.bump('nohit');
      WF.Challenges.flush(); Save.save();
      WF.Audio.waveClear(); WF.Audio.duck(0.5, 900, 1);
      openForge(bonus);
    }
  }

  function openLoot(L) {
    const p = run.p;
    if (L.kind === 'chest') {
      const pts = Math.round((20 + run.wave * 6) * (L.room ? 1.5 : 1));
      run.points += pts; Save.data.points += pts;
      addText(L.x, L.y - 20, '+' + pts + ' ◆', '#ffd36e', true);
      burst(L.x, L.y, '#ffd36e', 24); WF.Audio.reveal('rare');
    } else if (L.kind === 'runes') {
      const n = L.room ? 4 : 2;
      for (let i = 0; i < n; i++) dropRune(L.x + rand(-20, 20), L.y + rand(-20, 20), Math.random() < 0.15 ? '*' : randomRune());
      burst(L.x, L.y, '#c99be0', 20); WF.Audio.reveal('uncommon');
    } else {
      gainXP(Math.round(run.xpNext * 0.6)); healP(p.maxHp * 0.25);
      addText(L.x, L.y - 20, 'SHRINE: XP + HEAL', '#6fdc8c', true);
      burst(L.x, L.y, '#6fdc8c', 24); WF.Audio.reveal('epic');
    }
    run.fx.push({ kind: 'ring', x: L.x, y: L.y, r: 70, t: 0, life: 0.4, color: '#ffd36e' });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(60, 260);
      run.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6), color, r: rand(1.5, 3.5), add: true });
    }
  }
  function addText(x, y, txt, color, crit) {
    if (run.texts.length >= 80) return;
    const big = !!crit || (typeof txt === 'number' && txt >= 30);
    run.texts.push({ x: x + rand(-8, 8), y, txt, color, life: big ? 0.9 : 0.7, max: big ? 0.9 : 0.7, big });
  }
  function shards(x, y, color, n, r) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 220);
      run.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.4, 0.7), color, r: rand(r * 0.25, r * 0.5), shard: true, rot: rand(0, 6), spin: rand(-12, 12), g: 380, drag: 0.96 });
    }
  }

  // ---------- render ----------
  // Look: a rune-forge at night. Ember-lit stone floor, dark husk enemies with
  // coloured rims, spells drawn additively so they read as light.
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1, 7), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  };

  // cached soft glow sprites
  const glowCache = {};
  function glowSprite(color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(0.25, hexA(color, 0.55)); gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glowCache[color] = c);
  }
  // always restores alpha: a leaked low alpha here once made enemies draw nearly invisible
  function glow(x, y, r, color, a = 1) { ctx.globalAlpha = a; ctx.drawImage(color[0] === '#' ? glowSprite(color) : WF.glowSprite(color), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }

  const floorPats = {};
  const floorPat = id => floorPats[id] || (floorPats[id] = ctx.createPattern(WF.makeFloor(WF.BIOMES.find(b => b.id === id)), 'repeat'));
  const curBiome = () => WF.BIOMES[run && run.biomeIdx >= 0 ? run.biomeIdx : 0];

  let vignette = null, vigW = 0, vigH = 0;
  function getVignette() {
    if (vignette && vigW === W && vigH === H) return vignette;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), R = Math.hypot(W, H) / 2;
    const gr = g.createRadialGradient(W / 2, H / 2, R * 0.25, W / 2, H / 2, R);
    gr.addColorStop(0, 'rgba(5,6,10,0)'); gr.addColorStop(0.75, 'rgba(5,6,10,0.22)'); gr.addColorStop(1, 'rgba(3,4,7,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    vignette = c; vigW = W; vigH = H; return c;
  }

  // screen-space embers
  const embers = Array.from({ length: 55 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.015, 0.05), r: rand(0.8, 2.2), ph: rand(0, 6.28), z: rand(0.2, 1) }));
  function drawEmbers(camX, camY, t, amb) {
    amb = amb || WF.BIOMES[0].ambient;
    if (amb.kind !== 'embers') return drawAmbient(camX, camY, t, amb);
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      const x = ((e.x * W - camX * 0.15 * e.z + Math.sin(t * 0.8 + e.ph) * 14) % W + W) % W;
      const y = ((e.y - t * e.s) * H - camY * 0.15 * e.z) % H;
      const yy = (y + H) % H;
      const a = 0.25 + 0.35 * Math.sin(t * 2 + e.ph) ** 2;
      glow(x, yy, e.r * 5, amb.color, a * 0.5);
      ctx.globalAlpha = a; ctx.fillStyle = amb.core; ctx.fillRect(x - e.r / 2, yy - e.r / 2, e.r, e.r);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawAmbient(camX, camY, t, amb) {
    const wrap = (v, m) => ((v % m) + m) % m;
    if (amb.kind === 'snow') {
      for (const e of embers) {
        const x = wrap(e.x * W - camX * 0.3 * e.z + Math.sin(t * 0.7 + e.ph) * 24 + t * 18 * e.z, W);
        const y = wrap(e.y * H - camY * 0.3 * e.z + t * 40 * (0.4 + e.z), H);
        ctx.globalAlpha = 0.35 + 0.5 * e.z; ctx.fillStyle = amb.core; circle(x, y, e.r * 0.9 * (0.6 + e.z)); ctx.fill();
      }
    } else if (amb.kind === 'rain') {
      ctx.strokeStyle = amb.color; ctx.lineWidth = 1;
      for (let i = 0; i < embers.length * 2; i++) {
        const e = embers[i % embers.length], o = i >= embers.length ? 0.5 : 0;
        const x = wrap((e.x + o) * W - camX * 0.4 + t * 260 * 0.35, W), y = wrap((e.y + o) * H - camY * 0.4 + t * 900 * (0.6 + e.z * 0.4), H);
        ctx.globalAlpha = 0.18 + 0.2 * e.z; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 18 * (0.6 + e.z)); ctx.stroke();
      }
      if (run && run.lightning > 0) { ctx.globalAlpha = Math.max(0, run.lightning) * 0.22 * (Math.random() < 0.7 ? 1 : 0.3); ctx.fillStyle = '#e6ecff'; ctx.fillRect(0, 0, W, H); }
    } else if (amb.kind === 'spores') {
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        const x = wrap(e.x * W - camX * 0.2 * e.z + Math.sin(t * 0.5 + e.ph) * 30, W), y = wrap(e.y * H - camY * 0.2 * e.z - t * 10 * e.z, H);
        const a = 0.2 + 0.3 * Math.sin(t * 1.5 + e.ph) ** 2;
        glow(x, y, e.r * 7, amb.color, a * 0.6);
        ctx.globalAlpha = a; ctx.strokeStyle = amb.core; ctx.lineWidth = 1; circle(x, y, e.r * 1.4); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (amb.kind === 'motes') {
      ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        const R = Math.hypot(W, H) * 0.5 * (0.2 + e.y * 0.8), a0 = e.x * 6.28 + t * 0.12 * (1.2 - e.y);
        const x = W / 2 + Math.cos(a0) * R - camX * 0.05 * e.z % 40, y = H / 2 + Math.sin(a0) * R * 0.7;
        const a = 0.25 + 0.35 * Math.sin(t * 2 + e.ph) ** 2;
        glow(x, y, e.r * 6, amb.color, a * 0.6); ctx.globalAlpha = a; ctx.fillStyle = amb.core; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  function drawFloor(cx, cy, id = 'crypt', a = 1) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(((cx % 512) + 512) % 512 - 512, ((cy % 512) + 512) % 512 - 512);
    ctx.fillStyle = floorPat(id); ctx.fillRect(0, 0, W + 1024, H + 1024);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function render() {
    const t = performance.now() / 1000;
    ctx.fillStyle = run ? curBiome().bg : '#07080c'; ctx.fillRect(0, 0, W, H);
    if (!run) { drawIdleBg(t); return; }
    const p = run.p;
    const sx = (Math.random() - 0.5) * run.shake, sy = (Math.random() - 0.5) * run.shake;
    const cx = Math.round(W / 2 - run.cam.x + sx), cy = Math.round(H / 2 - run.cam.y + sy);
    const lead = run.slots[0] ? elColor(run.slots[0].spell.element) : '#ffd36e';

    const B = curBiome();
    if (run.biomeFade < 1 && run.prevBiomeIdx >= 0) drawFloor(cx, cy, WF.BIOMES[run.prevBiomeIdx].id, 1);
    drawFloor(cx, cy, B.id, run.biomeFade);
    ctx.save(); ctx.translate(cx, cy);

    // player light pool
    ctx.globalCompositeOperation = 'lighter';
    glow(p.x, p.y, 260, B.light, 0.10);
    glow(p.x, p.y, 140, lead, 0.08);
    ctx.globalCompositeOperation = 'source-over';

    // zones (ground layer)
    for (const f of run.fx) if (f.kind === 'zone') {
      const fade = Math.min(1, (f.life - f.t) * 2, f.t * 6);
      const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      gr.addColorStop(0, hexA(f.color, 0.05)); gr.addColorStop(0.75, hexA(f.color, 0.22)); gr.addColorStop(1, hexA(f.color, 0.4));
      ctx.globalAlpha = fade; ctx.fillStyle = gr; circle(f.x, f.y, f.r); ctx.fill();
      ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -f.t * 40;
      circle(f.x, f.y, f.r); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 1; ctx.globalAlpha = fade * 0.5; circle(f.x, f.y, f.r * 0.6); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // boss hazards on the ground
    for (const h of run.hazards) {
      if (h.kind === 'tele') {
        const k = Math.min(1, h.t / h.delay);
        ctx.globalAlpha = 0.18 + 0.2 * k; ctx.fillStyle = '#ff2244'; circle(h.x, h.y, h.r * k); ctx.fill();
        ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2; circle(h.x, h.y, h.r); ctx.stroke();
      } else if (h.kind === 'puddle' || h.kind === 'frost') {
        const fade = Math.min(1, (h.life - h.t) * 1.5, h.t * 4);
        ctx.globalAlpha = 0.32 * fade; ctx.fillStyle = h.color; circle(h.x, h.y, h.r); ctx.fill();
        ctx.globalAlpha = 0.7 * fade; ctx.strokeStyle = h.color; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = h.t * 20; circle(h.x, h.y, h.r); ctx.stroke(); ctx.setLineDash([]);
      } else if (h.kind === 'sweep') {
        const live = h.t > h.warm;
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a);
        if (!live) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 20); ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(h.len, 0); ctx.stroke(); ctx.setLineDash([]); }
        else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35; ctx.fillStyle = h.color; ctx.fillRect(0, -h.w, h.len, h.w * 2);
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -h.w * 0.22, h.len, h.w * 0.44);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
      } else if (h.kind === 'line') {
        const k = Math.min(1, h.t / h.life);
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a);
        ctx.globalAlpha = 0.15 + 0.25 * k; ctx.fillStyle = '#ff2244'; ctx.fillRect(0, -h.w / 2, h.len * k, h.w);
        ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 2; ctx.strokeRect(0, -h.w / 2, h.len, h.w);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // walls
    WF.Map.draw(ctx, run.map, -cx, -cy, W, H, t);
    // arena floor glyph while the boss waits
    if (run.arena && run.bossPending > 0) {
      const A = run.arena;
      ctx.strokeStyle = '#ff2244'; ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3); ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 30;
      circle(A.x, A.y, A.r); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter'; glow(A.x, A.y, 120, '#ff2244', 0.25 + 0.1 * Math.sin(t * 4)); ctx.globalCompositeOperation = 'source-over';
    }
    // loot: chests, rune caches and shrines in treasure rooms
    for (const L of run.loot) {
      if (Math.abs(L.x + cx - W / 2) > W / 2 + 60 || Math.abs(L.y + cy - H / 2) > H / 2 + 60) continue;
      const bob = Math.sin(L.t * 3) * 3, col = L.kind === 'chest' ? '#ffd36e' : L.kind === 'shrine' ? '#6fdc8c' : '#c99be0';
      ctx.globalCompositeOperation = 'lighter'; glow(L.x, L.y + bob, 46, col, 0.45 + 0.15 * Math.sin(L.t * 4)); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(L.x, L.y + 16, 16, 5, 0, 0, 6.29); ctx.fill();
      if (L.kind === 'chest') {
        ctx.fillStyle = '#5a3a1a'; ctx.strokeStyle = '#ffd36e'; ctx.lineWidth = 2;
        roundRect(L.x - 15, L.y - 6 + bob, 30, 18, 3); ctx.fill(); ctx.stroke();
        roundRect(L.x - 16, L.y - 15 + bob, 32, 11, 6); ctx.fillStyle = '#7a5226'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd36e'; ctx.fillRect(L.x - 3, L.y - 7 + bob, 6, 8);
      } else if (L.kind === 'runes') {
        for (let i = 0; i < 3; i++) { const a = L.t + i * 2.1; ctx.save(); ctx.translate(L.x + Math.cos(a) * 10, L.y + bob + Math.sin(a) * 5); ctx.rotate(0.785); ctx.fillStyle = ['#c99be0', '#ffd36e', '#7fd8ff'][i]; ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
      } else {
        ctx.fillStyle = '#1b2a1f'; ctx.strokeStyle = '#6fdc8c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L.x, L.y - 20 + bob); ctx.lineTo(L.x + 12, L.y + 12); ctx.lineTo(L.x - 12, L.y + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6fdc8c'; circle(L.x, L.y - 2 + bob, 4); ctx.fill();
      }
    }

    // spawn sigils
    for (const e of run.enemies) if (e.spawn > 0) {
      const k = e.spawn / e.spawnMax;
      ctx.globalAlpha = 1 - k * 0.3; ctx.strokeStyle = e.type === 'boss' ? e.color : e.type === 'elite' ? '#ffd36e' : '#ff4466'; ctx.lineWidth = 2;
      circle(e.x, e.y, e.r * (1.8 - k)); ctx.stroke();
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(t * 3);
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * 2.094; ctx.lineTo(Math.cos(a) * e.r * 1.4, Math.sin(a) * e.r * 1.4); } ctx.closePath(); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }

    // runes on the floor: little stone tablets
    ctx.font = '800 11px Barlow, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const r of run.runes) {
      const wild = r.word === '*';
      const label = wild ? '✦ WILD' : r.word.toUpperCase();
      const w = ctx.measureText(label).width + 16, bob = Math.sin(r.t * 4) * 2.5;
      const col = wild ? '#c99be0' : (WF.LEX[r.word] ? elColor(WF.LEX[r.word][0]) : '#ffd36e');
      ctx.globalCompositeOperation = 'lighter'; glow(r.x, r.y + bob, w * 0.9, col, 0.35 + 0.15 * Math.sin(r.t * 6)); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(r.x, r.y + 13, w * 0.4, 3, 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = wild ? '#2a1640' : '#1c1a17'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      roundRect(r.x - w / 2, r.y - 10 + bob, w, 20, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3d6'; ctx.fillText(label, r.x, r.y + bob + 1);
    }

    // shadows under enemies
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    for (const e of run.enemies) { ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.85, e.r * 0.95, e.r * 0.32, 0, 0, 6.29); ctx.fill(); }

    // shield auras
    run.slots.forEach(s => {
      if (s && s.spell.form === 'shield' && s.aura) {
        const c = elColor(s.spell.element);
        ctx.globalCompositeOperation = 'lighter';
        glow(p.x, p.y, s.aura * 1.15, c, 0.22 + Math.sin(run.t * 6) * 0.04);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
        ctx.setLineDash([4, 10]); ctx.lineDashOffset = run.t * 30; circle(p.x, p.y, s.aura); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });

    // enemies
    for (const e of run.enemies) drawEnemy(e, t);

    // additive layer: minions, projectiles, blades, fx, particles
    ctx.globalCompositeOperation = 'lighter';
    for (const b of run.eprojs) {
      glow(b.x, b.y, b.r * 3, b.color, 0.75);
      ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; circle(b.x, b.y, b.r * 0.55); ctx.fill();
    }
    for (const mn of run.minions) {
      const c = elColor(mn.spell.element);
      glow(mn.x, mn.y, 22, c, 0.8);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; circle(mn.x, mn.y, 3.5); ctx.fill();
    }
    for (const pr of run.projs) {
      const c = elColor(pr.spell.element), sp = Math.hypot(pr.vx, pr.vy) || 1;
      for (let k = 3; k >= 1; k--) glow(pr.x - pr.vx / sp * k * pr.r * 1.3, pr.y - pr.vy / sp * k * pr.r * 1.3, pr.r * (2.6 - k * 0.4), c, 0.25);
      glow(pr.x, pr.y, pr.r * 3.2, c, 0.9);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fffaf0'; circle(pr.x, pr.y, pr.r * 0.55); ctx.fill();
    }
    run.slots.forEach(s => {
      if (s && s.spell.form === 'orbit' && s.blades) {
        const c = elColor(s.spell.element);
        for (const b of s.blades) {
          glow(b.x, b.y, 24, c, 0.7);
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(run.t * 9);
          ctx.globalAlpha = 1; ctx.fillStyle = '#fff6e0';
          ctx.beginPath(); ctx.moveTo(-b.r * 1.2, 0); ctx.quadraticCurveTo(0, -6, b.r * 1.2, 0); ctx.quadraticCurveTo(0, -1, -b.r * 1.2, 0); ctx.fill();
          ctx.restore();
        }
      }
    });
    for (const f of run.fx) {
      const k = f.t / f.life;
      if (f.kind === 'ring') {
        ctx.globalAlpha = (1 - k) * 0.35; ctx.fillStyle = f.color; circle(f.x, f.y, f.r * (0.3 + 0.7 * k)); ctx.fill();
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 10 * (1 - k) + 2; circle(f.x, f.y, f.r * (0.3 + 0.7 * k)); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * (1 - k); ctx.stroke();
      } else if (f.kind === 'pop') {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 3 * (1 - k) + 0.5; circle(f.x, f.y, f.r * (0.4 + 0.6 * Math.sqrt(k))); ctx.stroke();
      } else if (f.kind === 'beam') {
        const a = 1 - k;
        ctx.lineCap = 'round';
        ctx.globalAlpha = a * 0.35; ctx.strokeStyle = f.color; ctx.lineWidth = f.w * 2.6; line(f.x, f.y, f.x2, f.y2);
        ctx.globalAlpha = a; ctx.lineWidth = f.w; line(f.x, f.y, f.x2, f.y2);
        ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = f.w * 0.3; line(f.x, f.y, f.x2, f.y2);
        ctx.lineCap = 'butt';
        glow(f.x, f.y, 30, f.color, a);
      } else if (f.kind === 'chain') {
        const pts = [];
        f.pts.forEach((pt, i) => {
          if (i) { const pv = f.pts[i - 1]; pts.push({ x: (pv.x + pt.x) / 2 + rand(-12, 12), y: (pv.y + pt.y) / 2 + rand(-12, 12) }); }
          pts.push(pt);
        });
        const path = () => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); };
        ctx.lineJoin = 'round';
        ctx.globalAlpha = (1 - k) * 0.4; ctx.strokeStyle = f.color; ctx.lineWidth = 9; path();
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 2; path();
        for (const q of f.pts.slice(1)) glow(q.x, q.y, 22, f.color, 1 - k);
      }
    }
    ctx.globalAlpha = 1;
    for (const q of run.parts) {
      if (!q.add) continue;
      const a = Math.min(1, q.life * 3);
      if (q.ring) { ctx.globalAlpha = a; ctx.strokeStyle = q.color; ctx.lineWidth = 1; circle(q.x, q.y, q.r); ctx.stroke(); }
      else { glow(q.x, q.y, q.r * 3, q.color, a * 0.6); ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.fillRect(q.x - q.r / 2, q.y - q.r / 2, q.r, q.r); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // shards (solid)
    for (const q of run.parts) {
      if (!q.shard) continue;
      ctx.globalAlpha = Math.min(1, q.life * 2.5);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.fillStyle = '#1a1d27'; ctx.strokeStyle = q.color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-q.r, -q.r * 0.6); ctx.lineTo(q.r, 0); ctx.lineTo(-q.r * 0.4, q.r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    drawPlayer(p, lead);

    // floating numbers
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const tx of run.texts) {
      const k = 1 - tx.life / tx.max, sc = k < 0.15 ? 1.5 - k * 3.3 : 1;
      ctx.globalAlpha = Math.min(1, tx.life * 3);
      ctx.font = `800 ${Math.round((tx.big ? 19 : 13) * sc)}px Barlow, system-ui, sans-serif`;
      ctx.strokeStyle = 'rgba(5,6,10,0.85)'; ctx.lineWidth = 3.5; ctx.strokeText(tx.txt, tx.x, tx.y);
      ctx.fillStyle = tx.big ? '#fff3c4' : tx.color; ctx.fillText(tx.txt, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;

    if (DEV.hitboxes) {
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1;
      for (const e of run.enemies) { circle(e.x, e.y, e.r); ctx.stroke(); }
      circle(p.x, p.y, p.r); ctx.stroke();
    }
    ctx.restore();

    drawEmbers(run.cam.x, run.cam.y, t, B.ambient);
    // guide arrow to the boss arena
    if (run.arena && run.bossPending > 0) {
      const ax0 = run.arena.x + cx, ay0 = run.arena.y + cy;
      const a = Math.atan2(ay0 - (p.y + cy), ax0 - (p.x + cx));
      const onScreen = ax0 > 40 && ax0 < W - 40 && ay0 > 40 && ay0 < H - 110;
      const R = 58, px0 = p.x + cx + Math.cos(a) * R, py0 = p.y + cy + Math.sin(a) * R;
      ctx.save(); ctx.translate(px0, py0); ctx.rotate(a);
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 7); ctx.fillStyle = '#ff2244'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, 11); ctx.lineTo(-3, 0); ctx.lineTo(-8, -11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
      if (!onScreen) {
        const ex = Math.max(36, Math.min(W - 36, W / 2 + Math.cos(a) * W)), ey = Math.max(110, Math.min(H - 120, H / 2 + Math.sin(a) * H));
        ctx.fillStyle = '#ff2244'; ctx.font = '800 11px Barlow, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BOSS', ex, ey);
      }
    }
    // arrows pointing at off-screen elites and bosses
    for (const e of run.enemies) {
      if (e.type !== 'elite' && e.type !== 'boss') continue;
      const sxp = e.x + cx, syp = e.y + cy;
      if (sxp > 0 && sxp < W && syp > 0 && syp < H) continue;
      const a = Math.atan2(syp - H / 2, sxp - W / 2), m = 34;
      const ax = Math.max(m, Math.min(W - m, W / 2 + Math.cos(a) * W)), ay = Math.max(m + 70, Math.min(H - m - 90, H / 2 + Math.sin(a) * H));
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = e.type === 'boss' ? '#ff2244' : '#ffd36e'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, 9); ctx.lineTo(-4, 0); ctx.lineTo(-8, -9); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
    ctx.drawImage(getVignette(), 0, 0);
    // low health pulse
    const hpk = p.hp / p.maxHp;
    if (hpk < 0.35) {
      const pulse = (0.35 - hpk) * 1.6 * (0.6 + 0.4 * Math.sin(t * 7));
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
      gr.addColorStop(0, 'rgba(255,20,50,0)'); gr.addColorStop(1, `rgba(255,20,50,${pulse})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    if (run.flash) { ctx.globalAlpha = Math.max(0, run.flash.a); ctx.fillStyle = run.flash.c; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

    drawHUD(t);
    if (touch.active && state === 'play') {
      ctx.globalAlpha = 0.22; ctx.strokeStyle = '#ffd36e'; ctx.lineWidth = 2; circle(touch.ox, touch.oy, 44); ctx.stroke();
      const dx = touch.x - touch.ox, dy = touch.y - touch.oy, L = Math.min(44, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd36e'; circle(touch.ox + Math.cos(a) * L, touch.oy + Math.sin(a) * L, 18); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(5,6,10,0.7)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd36e'; ctx.font = '800 30px Cinzel, serif'; ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2 - 10);
      ctx.fillStyle = '#8b93a7'; ctx.font = '600 14px Barlow, system-ui, sans-serif'; ctx.fillText('Tap or press Esc to resume', W / 2, H / 2 + 22);
    }
  }

  function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

  // Enemies are drawn in their own facing frame (+x = toward the player), so eyes, horns,
  // spikes, antennae and trailing drips/tentacles all turn together.
  function drawEnemy(e, t) {
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const spawnK = e.spawn > 0 ? 1 - e.spawn / (e.spawnMax || 0.45) : 1;
    const hitK = e.flash > 0 ? e.flash / 0.08 : 0;
    const sc = Math.max(0, spawnK) * (1 + hitK * 0.18);
    if (sc <= 0.01) return;
    if (e.type === 'boss') { drawBoss(e, t, sc); return; }
    const rim = e.flash > 0 ? '#ffffff' : e.freeze > 0 ? '#d8f4ff' : e.color;
    const body = e.freeze > 0 ? '#2a4a5c' : e.flash > 0 ? '#3a3f4c' : (e.body || '#151821');
    const r = e.r;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(sc, sc);
    if (e.type === 'elite') {
      ctx.globalCompositeOperation = 'lighter'; glow(0, 0, r * 2.6, e.glowC || '#ffb84d', 0.35 + 0.1 * Math.sin(t * 4)); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6; ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 7]);
      circle(0, 0, r * 1.55); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.094; ctx.fillStyle = e.color; circle(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55, 3.5); ctx.fill(); }
    }
    ctx.rotate(e.face || 0);
    // back-mounted decorations first (behind the body)
    decoBack(e, r, t);
    // body: dark outline under a coloured rim keeps every enemy readable on any floor
    ctx.beginPath();
    if (e.type === 'grunt') { const wob = Math.sin(t * 8 + e.seed) * 1.2; roundRectPath(-r, -r + wob * 0.3, r * 2, r * 2 - wob * 0.3, r * 0.45); }
    else if (e.type === 'runner') { ctx.moveTo(r * 1.35, 0); ctx.lineTo(-r * 0.9, r * 0.95); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.9, -r * 0.95); ctx.closePath(); }
    else if (e.type === 'spitter') { circle(0, 0, r); }
    else if (e.type === 'brute') { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }
    else { ctx.moveTo(r * 1.2, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 1.0, 0); ctx.lineTo(0, -r); ctx.closePath(); }
    ctx.lineJoin = 'round';
    ctx.fillStyle = body; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = rim; ctx.lineWidth = e.type === 'brute' || e.type === 'elite' ? 3 : 2.4; ctx.stroke();
    if (e.type === 'brute') { ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); } ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.type === 'elite') { ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.lineTo(0, r * 0.6); ctx.lineTo(-r * 0.6, 0); ctx.lineTo(0, -r * 0.6); ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.type === 'spitter') {
      // a glowing mouth that charges before each shot
      const k = e.windup > 0 ? 1 - e.windup / 0.55 : 0;
      ctx.fillStyle = '#05060a'; circle(r * 0.55, 0, r * 0.42); ctx.fill();
      if (k > 0) { ctx.globalCompositeOperation = 'lighter'; glow(r * 0.6, 0, r * (1 + k * 1.6), e.color, 0.5 + k * 0.5); ctx.globalCompositeOperation = 'source-over'; }
      ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; circle(r * 0.55, 0, r * 0.42); ctx.stroke();
    }
    // eyes at the front
    ctx.fillStyle = e.eye || '#ff4f6a';
    const er = Math.max(1.8, r * 0.13);
    if (e.type === 'runner') { circle(r * 0.35, 0, 2.2); ctx.fill(); }
    else if (e.type === 'spitter') { circle(-r * 0.05, -r * 0.45, er); ctx.fill(); circle(-r * 0.05, r * 0.45, er); ctx.fill(); }
    else { circle(r * 0.42, -r * 0.3, er); ctx.fill(); circle(r * 0.42, r * 0.3, er); ctx.fill(); }
    // front-mounted decorations (horns frame the eyes)
    decoFront(e, r, t);
    ctx.restore();
    // status (unrotated)
    if (e.slow > 0 || e.freeze > 0) { ctx.strokeStyle = '#7fd8ff'; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.85, e.r * 1.1, e.r * 0.38, 0, 0, 6.29); ctx.stroke(); ctx.globalAlpha = 1; }
    if (e.weak > 0) { ctx.strokeStyle = '#e0466e'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); circle(e.x, e.y, e.r * 1.35); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if (e.stacks > 0) { ctx.fillStyle = '#8dff5a'; for (let i = 0; i < e.stacks; i++) ctx.fillRect(e.x - e.stacks * 2.5 + i * 5, e.y - e.r - 6, 3, 3); }
    if ((e.type === 'elite' || e.type === 'brute') && e.hp < e.maxHp) {
      const w = e.r * 2.2, y = e.y - e.r * 1.3 - 10;
      ctx.fillStyle = 'rgba(5,6,10,0.8)'; roundRect(e.x - w / 2 - 1, y - 1, w + 2, 6, 3); ctx.fill();
      ctx.fillStyle = e.type === 'elite' ? '#ffd36e' : '#ff5566'; roundRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4, 2); ctx.fill();
    }
  }

  function decoBack(e, r, t) {
    switch (e.deco) {
      case 'crystal':
        ctx.fillStyle = 'rgba(200,240,255,0.6)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        [[-0.55, 0.55], [-0.85, 0], [-0.55, -0.55]].forEach(([ox, oy], i) => {
          const L = r * (i === 1 ? 1.0 : 0.7), a = Math.atan2(oy, ox);
          ctx.beginPath(); ctx.moveTo(ox * r + Math.cos(a + 1.57) * r * 0.2, oy * r + Math.sin(a + 1.57) * r * 0.2); ctx.lineTo(ox * r + Math.cos(a) * L, oy * r + Math.sin(a) * L); ctx.lineTo(ox * r - Math.cos(a + 1.57) * r * 0.2, oy * r - Math.sin(a + 1.57) * r * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        break;
      case 'spark': {
        const tipX = -r * 1.7, tipY = Math.sin(t * 6 + e.seed) * r * 0.25;
        ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(tipX, tipY); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter'; glow(tipX, tipY, r * (0.9 + 0.5 * Math.random()), '#ffe14d', 0.9); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        if (Math.random() < 0.15) { ctx.strokeStyle = '#fffbe0'; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + rand(-8, 4), tipY + rand(-8, 8)); ctx.stroke(); }
        break; }
      case 'drip':
        ctx.fillStyle = e.color; ctx.globalAlpha = 0.85;
        for (let i = 0; i < 2; i++) { const ph = ((t * 0.8 + e.seed + i * 0.5) % 1); ctx.beginPath(); ctx.ellipse(-r * (0.9 + ph * 0.9), (i ? 0.45 : -0.4) * r, r * (0.18 + ph * 0.18), r * 0.14, 0, 0, 6.29); ctx.fill(); }
        ctx.globalAlpha = 1; break;
      case 'tentacle':
        ctx.strokeStyle = e.color; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.lineCap = 'round'; ctx.globalAlpha = 0.85;
        for (let i = 0; i < 3; i++) { const by = (i - 1) * r * 0.55; ctx.beginPath(); ctx.moveTo(-r * 0.8, by); for (let k = 1; k <= 4; k++) ctx.lineTo(-r * 0.8 - k * r * 0.24, by + Math.sin(t * 5 + e.seed + i + k) * r * 0.25); ctx.stroke(); }
        ctx.globalAlpha = 1; break;
    }
  }
  function decoFront(e, r, t) {
    if (e.deco === 'horns') {
      ctx.fillStyle = e.body || '#151821'; ctx.strokeStyle = e.color; ctx.lineWidth = 1.5;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(r * 0.15, s * r * 0.75);
        ctx.quadraticCurveTo(r * 0.35, s * r * 1.35, r * 0.95, s * r * 1.35);
        ctx.lineTo(r * 0.55, s * r * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (e.deco === 'drip') { ctx.fillStyle = e.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.45, r * 0.6, 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1; }
  }

  function drawBoss(e, t, sc) {
    const B = e.boss, r = e.r, c = e.flash > 0 ? '#ffffff' : e.color;
    const ph = e.ai ? e.ai.phase || 0 : 0;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(sc, sc);
    ctx.globalCompositeOperation = 'lighter'; glow(0, 0, r * 3, e.color, 0.35 + 0.12 * Math.sin(t * 3) + ph * 0.1); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // rotating outer rune ring
    ctx.save(); ctx.rotate(t * 0.6); ctx.strokeStyle = e.color; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.setLineDash([4, 10]); circle(0, 0, r * 1.5); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); ctx.globalAlpha = 1;
    ctx.rotate(e.face || 0);
    ctx.lineJoin = 'round';
    const outline = () => { ctx.fillStyle = '#0d0f15'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 3.5; ctx.stroke(); };
    switch (B.shape) {
      case 'golem': {
        for (const s of [-1, 1]) { ctx.beginPath(); roundRectPath(-r * 0.4, s * r * 0.75 - r * 0.35, r * 0.8, r * 0.7, 8); outline(); }
        ctx.beginPath(); roundRectPath(-r, -r * 0.8, r * 2, r * 1.6, r * 0.35); outline();
        ctx.strokeStyle = '#ff8a3d'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.lineTo(-r * 0.2, r * 0.1); ctx.lineTo(-r * 0.4, r * 0.5); ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(-r * 0.05, -r * 0.1); ctx.stroke(); ctx.globalAlpha = 1;
        break; }
      case 'warden': {
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.1); } ctx.closePath(); outline();
        ctx.fillStyle = 'rgba(200,240,255,0.7)';
        for (let i = 0; i < 5; i++) { const a = Math.PI + (i - 2) * 0.35; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.1) * r * 0.9, Math.sin(a - 0.1) * r * 0.9); ctx.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6); ctx.lineTo(Math.cos(a + 0.1) * r * 0.9, Math.sin(a + 0.1) * r * 0.9); ctx.fill(); }
        break; }
      case 'herald': {
        ctx.globalCompositeOperation = 'lighter';
        for (const s of [-1, 1]) { ctx.strokeStyle = '#ffe14d'; ctx.globalAlpha = 0.8; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.2, s * r * 0.5); ctx.lineTo(-r * 0.9, s * r * 1.3); ctx.lineTo(-r * 0.5, s * r * 1.2); ctx.lineTo(-r * 1.4, s * r * 1.9); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(0, r * 0.9); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 0.9); ctx.closePath(); outline();
        break; }
      case 'mother': {
        ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = r * (1 + 0.08 * Math.sin(a * 5 + t * 3)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); outline();
        ctx.fillStyle = '#8dff5a'; ctx.globalAlpha = 0.85;
        for (let i = 0; i < 3; i++) { const ph2 = (t * 0.6 + i * 0.33) % 1; ctx.beginPath(); ctx.ellipse(-r * (1 + ph2 * 0.8), (i - 1) * r * 0.5, r * 0.2, r * 0.13, 0, 0, 6.29); ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e6ff7a'; [[0.5, -0.45], [0.6, 0.1], [0.35, 0.5], [0.15, -0.15], [0.1, 0.25]].forEach(([x, y]) => { circle(x * r, y * r, r * 0.08); ctx.fill(); });
        break; }
      case 'eye': {
        ctx.strokeStyle = e.color; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const by = (i - 2.5) * r * 0.32; ctx.beginPath(); ctx.moveTo(-r * 0.6, by); for (let k = 1; k <= 5; k++) ctx.lineTo(-r * 0.6 - k * r * 0.25, by + Math.sin(t * 4 + i + k) * r * 0.2); ctx.stroke(); }
        circle(0, 0, r); outline();
        break; }
      case 'choir': {
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.9, 0, 0, 6.29); outline();
        ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(-r * 0.15, i * r * 0.28, r * 0.6, -1.2, 1.2); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.fillStyle = '#e8e2d0';
        for (let i = 0; i < 5; i++) { const a = Math.PI + (i - 2) * 0.32, rr = r * (1.25 + 0.08 * Math.sin(t * 6 + i)); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.14, 0, 6.29); ctx.fill(); }
        break; }
      case 'wraith': {
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 4);
        ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.quadraticCurveTo(r * 0.2, -r * 1.1, -r * 1.4, -r * 0.8 + Math.sin(t * 5) * 6); ctx.lineTo(-r * 1.0, 0); ctx.lineTo(-r * 1.4, r * 0.8 + Math.sin(t * 5 + 1) * 6); ctx.quadraticCurveTo(r * 0.2, r * 1.1, r * 1.1, 0); outline();
        ctx.globalAlpha = 1;
        break; }
      case 'hive': {
        for (let i = 3; i >= 1; i--) { ctx.beginPath(); ctx.ellipse(-r * 0.55 * i, 0, r * (0.75 - i * 0.08), r * (0.6 - i * 0.06), 0, 0, 6.29); outline(); }
        ctx.beginPath(); ctx.ellipse(r * 0.15, 0, r * 0.8, r * 0.7, 0, 0, 6.29); outline();
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,220,150,0.35)';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-r * 0.2, s * r * 0.95, r * 0.9, r * 0.35, s * (0.4 + Math.sin(t * 30) * 0.15), 0, 6.29); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
        break; }
      case 'colossus': {
        ctx.beginPath(); roundRectPath(-r, -r, r * 2, r * 2, r * 0.18); outline();
        ctx.strokeStyle = '#b9c2d6'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
        for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(-r, k * r); ctx.lineTo(r * 0.2, k * r); ctx.stroke(); }
        ctx.globalAlpha = 1;
        for (const s of [-1, 1]) { ctx.beginPath(); roundRectPath(-r * 0.5, s * r * 1.05 - r * 0.25, r, r * 0.5, 6); outline(); }
        break; }
      case 'silence': {
        ctx.beginPath(); circle(0, 0, r); ctx.fillStyle = '#000'; ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 4; k++) { const ph = (t * 0.4 + k / 4) % 1; ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - ph) * 0.7; ctx.lineWidth = 2; circle(0, 0, r * (1 + ph * 1.2)); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.strokeStyle = c; ctx.lineWidth = 3; circle(0, 0, r); ctx.stroke();
        ctx.fillStyle = '#fbf3e6';
        for (let i = 0; i < 6; i++) { const a = t * 0.5 + i * 1.047; circle(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.08); ctx.fill(); }
        break; }
      case 'unwriter': {
        // a floating tome: two pages and a spine, crowned with orbiting letters
        ctx.save(); ctx.rotate(-(e.face || 0));
        ctx.font = '800 18px Cinzel, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const L = 'UNWRITE';
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < L.length; i++) { const a = t * (1 + ph * 0.5) + i * Math.PI * 2 / L.length; ctx.fillStyle = e.color; ctx.globalAlpha = 0.8; ctx.fillText(L[i], Math.cos(a) * r * 1.9, Math.sin(a) * r * 1.9); }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.restore();
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 0.7, s * r * 1.1); ctx.lineTo(r * 0.8, s * r * 1.0); ctx.lineTo(r * 0.9, 0); ctx.closePath(); outline(); }
        ctx.strokeStyle = 'rgba(255,79,106,0.4)'; ctx.lineWidth = 1.5;
        for (let k = 1; k <= 4; k++) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r * 0.6, s * r * 0.22 * k); ctx.lineTo(r * 0.6, s * r * 0.22 * k); ctx.stroke(); }
        break; }
    }
    // the eye (every boss has one)
    const eyeR = B.shape === 'eye' ? r * 0.62 : r * 0.32, ex = B.shape === 'eye' ? 0 : r * 0.35;
    ctx.fillStyle = '#fbf3e6'; circle(ex, 0, eyeR); ctx.fill();
    ctx.fillStyle = e.color; circle(ex + eyeR * 0.3, 0, eyeR * 0.55); ctx.fill();
    ctx.fillStyle = '#05060a'; circle(ex + eyeR * 0.38, 0, eyeR * 0.25); ctx.fill();
    ctx.restore();
  }

  function drawPlayer(p, lead) {
    const t = run.t, skin = WF.skinById(Save.data.skin);
    const trailC = skin.trail === 'hue' ? WF.skinHue(t) : (skin.trail || lead);
    ctx.globalCompositeOperation = 'lighter';
    for (const tr of run.trail) glow(tr.x, tr.y, p.r * 1.6 * (tr.life / 0.3), trailC, tr.life * 0.9);
    glow(p.x, p.y, p.r * 4, lead, 0.45);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.9, p.r, p.r * 0.35, 0, 0, 6.29); ctx.fill();
    WF.drawSkin(ctx, p.x, p.y, p.r, skin, t, { face: run.face, hurt: p.iframe > 0 && Math.floor(t * 24) % 2 });
  }

  // ---------- HUD ----------
  function formIcon(form, x, y, r, color) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    switch (form) {
      case 'bolt': ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.6); ctx.lineTo(r * 0.6, -r * 0.6); ctx.moveTo(r * 0.6, -r * 0.6); ctx.lineTo(0, -r * 0.6); ctx.moveTo(r * 0.6, -r * 0.6); ctx.lineTo(r * 0.6, 0); ctx.stroke(); break;
      case 'nova': circle(0, 0, r * 0.65); ctx.stroke(); circle(0, 0, r * 0.2); ctx.fill(); break;
      case 'orbit': circle(0, 0, r * 0.55); ctx.stroke(); circle(r * 0.55, 0, 2.5); ctx.fill(); circle(-r * 0.55, 0, 2.5); ctx.fill(); break;
      case 'beam': ctx.lineWidth = 3; line(-r * 0.7, 0, r * 0.7, 0); circle(-r * 0.7, 0, 2.5); ctx.fill(); break;
      case 'zone': ctx.globalAlpha = 0.5; circle(0, 0, r * 0.65); ctx.fill(); ctx.globalAlpha = 1; circle(0, 0, r * 0.65); ctx.stroke(); break;
      case 'chain': ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.4); ctx.lineTo(-r * 0.1, r * 0.3); ctx.lineTo(r * 0.1, -r * 0.3); ctx.lineTo(r * 0.7, r * 0.4); ctx.stroke(); break;
      case 'summon': for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57; circle(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 2.6); ctx.fill(); } break;
      case 'shield': ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65); } ctx.closePath(); ctx.stroke(); break;
    }
    ctx.restore();
  }

  function drawHUD(t) {
    const p = run.p;
    ctx.textBaseline = 'middle';
    // HP: segmented bar with damage-lag
    const hx = 16, hy = 16, hw = Math.min(220, W * 0.42), hh = 14;
    ctx.fillStyle = 'rgba(5,6,10,0.75)'; roundRect(hx - 3, hy - 3, hw + 6, hh + 6, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(hx, hy, hw * Math.max(0, run.hpLag / p.maxHp), hh, 4); ctx.fill();
    const hg = ctx.createLinearGradient(0, hy, 0, hy + hh); hg.addColorStop(0, '#ff7a8a'); hg.addColorStop(1, '#d91f45');
    ctx.fillStyle = hg; roundRect(hx, hy, Math.max(0, hw * (p.hp / p.maxHp)), hh, 4); ctx.fill();
    ctx.fillStyle = 'rgba(5,6,10,0.55)';
    for (let v = 10; v < p.maxHp; v += 10) ctx.fillRect(hx + hw * v / p.maxHp, hy, 1, hh);
    ctx.fillStyle = '#fff'; ctx.font = '800 11px Barlow, system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, hx + 6, hy + hh / 2 + 0.5);
    // wave + progress
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff3d6'; ctx.font = '800 18px Cinzel, serif';
    ctx.fillText('WAVE ' + run.wave, W - 16, 22);
    const remain = run.quota + run.enemies.length + (run.eliteSpawned ? 0 : 1);
    const prog = Math.max(0, Math.min(1, 1 - remain / Math.max(1, run.waveTotal)));
    const pw = 120;
    ctx.fillStyle = 'rgba(5,6,10,0.75)'; roundRect(W - 16 - pw, 36, pw, 4, 2); ctx.fill();
    ctx.fillStyle = '#ffd36e'; roundRect(W - 16 - pw, 36, pw * prog, 4, 2); ctx.fill();
    ctx.font = '600 11px Barlow, system-ui, sans-serif'; ctx.fillStyle = '#9aa2b6';
    ctx.fillText(run.kills + ' kills', W - 16, 52);
    ctx.fillStyle = '#ffd36e'; ctx.font = '800 12px Barlow, system-ui, sans-serif'; ctx.fillText('◆ ' + (Save.data.points || 0), W - 16, 67);
    ctx.font = '600 11px Barlow, system-ui, sans-serif';
    ctx.fillStyle = curBiome().light; ctx.fillText(curBiome().name, W - 16, 82);
    ctx.fillStyle = '#c99be0'; ctx.fillText('☾ ' + curse.name, W - 16, 96);
    drawBook(t);
    // boss bar
    if (run.boss && run.boss.spawn <= 0.6) {
      const e = run.boss, bw = Math.min(460, W - 40), bx = (W - bw) / 2, byy = 58;
      ctx.textAlign = 'center'; ctx.font = '800 15px Cinzel, serif'; ctx.fillStyle = e.color;
      ctx.fillText(e.boss.name.toUpperCase(), W / 2, byy - 8);
      ctx.fillStyle = 'rgba(5,6,10,0.8)'; roundRect(bx - 3, byy - 1, bw + 6, 14, 4); ctx.fill();
      const k = Math.max(0, e.hp / e.maxHp);
      const g2 = ctx.createLinearGradient(bx, 0, bx + bw, 0); g2.addColorStop(0, '#ff2244'); g2.addColorStop(1, e.color);
      ctx.fillStyle = g2; roundRect(bx, byy + 2, bw * k, 8, 3); ctx.fill();
      if (e.boss.phases) { ctx.fillStyle = 'rgba(5,6,10,0.9)'; for (const f of [0.33, 0.66]) ctx.fillRect(bx + bw * f - 1, byy, 2, 12); }
      ctx.font = 'italic 600 11px Barlow, system-ui, sans-serif'; ctx.fillStyle = '#b4abc4'; ctx.fillText(e.boss.title, W / 2, byy + 24);
    } else if (run.bossPending > 0 && run.arena) {
      const dm = Math.round(Math.sqrt(dist2(run.p, run.arena)) / 40);
      ctx.textAlign = 'center'; ctx.font = '800 15px Cinzel, serif'; ctx.fillStyle = '#ff4f6a'; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5);
      ctx.fillText(WF.isMajorBoss(run.wave) ? 'A MAJOR BOSS WAITS IN ITS ARENA' : 'A BOSS WAITS IN ITS ARENA', W / 2, 62); ctx.globalAlpha = 1;
      ctx.font = '600 12px Barlow, system-ui, sans-serif'; ctx.fillStyle = '#ffb8c0'; ctx.fillText(`Follow the red arrow · ${dm} m`, W / 2, 80);
    }
    // minimap
    if (run.map) { const ms = Math.round(Math.min(132, W * 0.3)); WF.Map.drawMini(ctx, run.map, 16, 42, ms, run, { loot: run.loot, arena: run.bossPending > 0 ? run.arena : null }); }
    // wave banner
    if (run.banner > 0) {
      const k = 1.8 - run.banner, a = Math.min(1, run.banner * 1.5, k * 4);
      const sc = 1 + Math.max(0, 0.25 - k) * 2;
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(W / 2, H * 0.28); ctx.scale(sc, sc);
      ctx.font = '800 44px Cinzel, serif';
      ctx.fillStyle = 'rgba(5,6,10,0.6)'; ctx.fillText('WAVE ' + run.wave, 2, 3);
      const tg = ctx.createLinearGradient(0, -22, 0, 22); tg.addColorStop(0, '#fff2c4'); tg.addColorStop(1, '#ff9a4d');
      ctx.fillStyle = tg; ctx.fillText('WAVE ' + run.wave, 0, 0);
      const lw = Math.min(160, k * 600);
      ctx.fillStyle = '#ffd36e'; ctx.fillRect(-lw, 30, lw * 2, 1.5);
      ctx.restore();
      ctx.font = '600 15px Barlow, system-ui, sans-serif';
      if (run.areaBanner > 0) {
        const B = curBiome();
        ctx.fillStyle = B.light; ctx.font = '800 13px Barlow, system-ui, sans-serif';
        ctx.fillText('— ENTERING —', W / 2, H * 0.28 - 70);
        ctx.font = '800 26px Cinzel, serif'; ctx.fillText(B.name.toUpperCase(), W / 2, H * 0.28 - 44);
        ctx.font = 'italic 600 15px Barlow, system-ui, sans-serif'; ctx.fillStyle = '#d6dae4';
        ctx.fillText(run.wave === 1 && !Save.data.seenTutorial ? 'Move with WASD or drag. Spells cast themselves. Grab the glowing words.' : B.tagline, W / 2, H * 0.28 + 52);
      } else if (run.wave % 4 === 0) { ctx.fillStyle = '#ffb8c0'; ctx.fillText('An elite approaches. It carries a wild rune.', W / 2, H * 0.28 + 52); }
      else if (run.wave === 1 && !Save.data.seenTutorial) { ctx.fillStyle = '#e9ecf2'; ctx.fillText('Move with WASD or drag. Spells cast themselves. Grab the glowing words.', W / 2, H * 0.28 + 52); }
      ctx.globalAlpha = 1;
    }
  }
  // the grimoire bar: an open book holding your three spells, rune bag, level and XP
  function drawBook(t) {
    const T = WF.tomeById(Save.data.tome), C = c => WF.resolveCol(c, t);
    const bw = Math.min(640, W - 24), bh = 76, bx = (W - bw) / 2, by = H - bh - 14;
    const spine = 40, pageW = (bw - spine) / 2;
    if (T.glow) { ctx.globalCompositeOperation = 'lighter'; glow(W / 2, by + bh / 2, bw * 0.55, C(T.glow), 0.12 + 0.05 * Math.sin(t * 2)); ctx.globalCompositeOperation = 'source-over'; }
    // cover
    const cg = ctx.createLinearGradient(0, by - 8, 0, by + bh + 8); cg.addColorStop(0, T.cover[0]); cg.addColorStop(1, T.cover[1]);
    ctx.fillStyle = cg; roundRect(bx - 7, by - 7, bw + 14, bh + 14, 9); ctx.fill();
    ctx.strokeStyle = C(T.border); ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; roundRect(bx - 4.5, by - 4.5, bw + 9, bh + 9, 7); ctx.stroke(); ctx.globalAlpha = 1;
    // pages
    for (const px of [bx, bx + pageW + spine]) {
      const pg = ctx.createLinearGradient(px, 0, px + pageW, 0);
      if (px === bx) { pg.addColorStop(0, T.page[0]); pg.addColorStop(1, T.page[1]); } else { pg.addColorStop(0, T.page[1]); pg.addColorStop(1, T.page[0]); }
      ctx.fillStyle = pg; roundRect(px, by, pageW, bh, 4); ctx.fill();
    }
    // spine with the level seal sitting fully inside it
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx + pageW, by - 7, spine, bh + 14);
    const sx0 = W / 2, sy0 = by + bh / 2;
    ctx.fillStyle = T.seal; circle(sx0, sy0, 17); ctx.fill();
    ctx.strokeStyle = C(T.border); ctx.lineWidth = 2; circle(sx0, sy0, 17); ctx.stroke();
    ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 8px Barlow, system-ui, sans-serif'; ctx.fillText('LEVEL', sx0, sy0 - 27);
    ctx.font = `800 ${run.lvl >= 100 ? 11 : 15}px Barlow, system-ui, sans-serif`; ctx.fillText(run.lvl, sx0, sy0 + 1);
    // XP thread along the top edge, clear of the seal
    const xk = run.xp / run.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(bx, by - 14, bw, 4, 2); ctx.fill();
    const xg = ctx.createLinearGradient(bx, 0, bx + bw, 0); xg.addColorStop(0, '#ffb84d'); xg.addColorStop(1, '#fff3c4');
    ctx.fillStyle = xg; roundRect(bx, by - 14, Math.max(4, bw * xk), 4, 2); ctx.fill();
    // four cells: [slot1][slot2] | [slot3][runes]
    const pad = 6, cw = (pageW - pad * 3) / 2, ch = bh - pad * 2;
    const cells = [[bx + pad, 0], [bx + pad * 2 + cw, 1], [bx + pageW + spine + pad, 2], [bx + pageW + spine + pad * 2 + cw, 'runes']];
    const narrow = cw < 118;
    for (const [x, which] of cells) {
      const y = by + pad;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; roundRect(x + 0.5, y + 0.5, cw - 1, ch - 1, 4); ctx.stroke();
      if (which === 'runes') {
        const bump = Math.max(0, run.bagBump);
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffd36e'; ctx.font = '800 10px Barlow, system-ui, sans-serif';
        ctx.fillText('RUNES ' + run.bag.length + '/8', x + cw / 2, y + 12);
        for (let i = 0; i < 8; i++) {
          const col = i % 4, row = (i / 4) | 0, w = run.bag[i];
          const px = x + cw / 2 + (col - 1.5) * Math.min(20, cw / 5), py = y + 30 + row * 16;
          const s2 = i === run.bag.length - 1 ? 1 + bump * 0.6 : 1;
          ctx.save(); ctx.translate(px, py); ctx.scale(s2, s2); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = w === undefined ? 'rgba(255,255,255,0.07)' : w === '*' ? '#c99be0' : (WF.LEX[w] ? elColor(WF.LEX[w][0]) : '#ffd36e');
          ctx.fillRect(-4.5, -4.5, 9, 9); ctx.restore();
        }
        continue;
      }
      const s = run.slots[which];
      const T = WF.tomeById(Save.data.tome);
      if (!s) { ctx.textAlign = 'center'; ctx.fillStyle = '#4a4232'; ctx.font = 'italic 600 11px Barlow, system-ui, sans-serif'; ctx.fillText('blank page', x + cw / 2, y + ch / 2); continue; }
      const sp = s.spell, c = elColor(sp.element), rc = WF.RARITIES[WF.spellRarity(sp.power, sp.element)].color;
      ctx.fillStyle = rc; ctx.fillRect(x + 4, y, cw - 8, 2);
      const ix = narrow ? x + cw / 2 : x + 22, iy = narrow ? y + 20 : y + ch / 2;
      ctx.fillStyle = hexA(c, 0.14); circle(ix, iy, 15); ctx.fill();
      const cdk = s.cdMax > 0 ? Math.max(0, Math.min(1, s.cd / s.cdMax)) : 0;
      const continuous = ['orbit', 'shield'].includes(sp.form);
      if (!continuous && cdk > 0) { ctx.fillStyle = 'rgba(5,6,10,0.65)'; ctx.beginPath(); ctx.moveTo(ix, iy); ctx.arc(ix, iy, 15, -Math.PI / 2, -Math.PI / 2 + cdk * Math.PI * 2); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = rc; ctx.lineWidth = 1.5; circle(ix, iy, 15); ctx.stroke();
      if (!continuous && cdk < 0.08) { ctx.globalCompositeOperation = 'lighter'; glow(ix, iy, 24, c, 0.55); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      WF.drawIcon(ctx, sp.element, ix, iy, 18, c, 2);
      if (narrow) {
        ctx.textAlign = 'center'; ctx.fillStyle = T.ink; ctx.font = '800 10px Barlow, system-ui, sans-serif';
        ctx.fillText(fit(sp.name, cw - 8), x + cw / 2, y + 44);
        sp.tags.forEach((tg, k) => WF.drawIcon(ctx, WF.TAG_ICON(tg), x + cw / 2 + (k - (sp.tags.length - 1) / 2) * 14, y + 56, 11, '#b9ad95', 2));
      } else {
        ctx.textAlign = 'left'; ctx.fillStyle = T.ink; ctx.font = '800 12px Barlow, system-ui, sans-serif';
        ctx.fillText(fit(sp.name, cw - 48), x + 43, y + 16);
        ctx.fillStyle = rc; ctx.font = '800 9px Barlow, system-ui, sans-serif';
        ctx.fillText(WF.RARITIES[WF.spellRarity(sp.power, sp.element)].name.toUpperCase() + ' · ' + sp.form.toUpperCase(), x + 43, y + 30);
        sp.tags.forEach((tg, k) => WF.drawIcon(ctx, WF.TAG_ICON(tg), x + 49 + k * 17, y + 46, 13, '#b9ad95', 2));
      }
    }
  }
  function fit(s, w) { if (ctx.measureText(s).width <= w) return s; while (s.length > 3 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }
  function roundRectPath(x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); roundRectPath(x, y, w, h, r); }

  const idle = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), w: pick(WF.RUNE_POOL), s: rand(0.2, 0.6), ph: rand(0, 6.28) }));
  function drawIdleBg(t) {
    drawFloor(-t * 12, -t * 6);
    ctx.font = '800 13px Barlow, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const r of idle) {
      const el = WF.LEX[r.w] ? WF.LEX[r.w][0] : 'fire';
      const x = r.x * W, y = ((r.y - t * r.s * 0.03) % 1 + 1) % 1 * H;
      const a = 0.12 + 0.1 * Math.sin(t + r.ph);
      ctx.globalCompositeOperation = 'lighter'; glow(x, y, 40, elColor(el), a * 0.5); ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a + 0.05; ctx.fillStyle = '#ffe6b0'; ctx.fillText(r.w.toUpperCase(), x, y);
    }
    ctx.globalAlpha = 1;
    drawEmbers(t * 20, 0, t);
    ctx.drawImage(getVignette(), 0, 0);
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (state === 'play') { if (run.hitstop > 0) run.hitstop -= dt; else for (let k = 0; k < DEV.speed && state === 'play'; k++) update(dt); }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  function togglePause() {
    if (state === 'play') { state = 'paused'; show('ovPause'); WF.Audio.duck(0.4, 1200, 0.4); }
    else if (state === 'paused') { hideAll(); state = 'play'; last = performance.now(); WF.Audio.duck(run && run.ducked ? 0.3 : 1, run && run.ducked ? 1800 : 20000, 0.4); }
  }

  // ---------- UI ----------
  const overlays = ['ovTitle', 'ovHow', 'ovGrim', 'ovForge', 'ovDead', 'ovPause', 'ovSettings', 'ovWardrobe', 'ovCache', 'ovLevel', 'ovChar', 'ovChallenges'];
  function hideAll() { overlays.forEach(o => $(o).classList.remove('show')); }
  let show = function (id) { hideAll(); $(id).classList.add('show'); };
  function toast(msg, cls = '') { const t = $('toast'); t.textContent = msg; t.className = 'toast ' + cls; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = 'none', cls ? 3200 : 2200); }
  function setPlaying(on) { document.body.classList.toggle('playing', !!on); }

  function stars(n) { return '★'.repeat(Math.ceil(n / 2)) + '☆'.repeat(5 - Math.ceil(n / 2)); }
  function cardHTML(s, badge) {
    const c = elColor(s.element);
    const el = WF.ELEMENTS[s.element].name + (s.secondary ? ' / ' + WF.ELEMENTS[s.secondary].name : '');
    const src = s.source === 'oracle' ? 'Forged by the Oracle (LLM)' : s.source === 'starter' ? 'Starter spell' : 'Forged by the local lexicon';
    const rar = WF.spellRarity(s.power, s.element), R = WF.RARITIES[rar];
    let sparks = '';
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 140;
      sparks += `<i style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d * 0.7).toFixed(0)}px;--d:${(0.15 + Math.random() * 0.2).toFixed(2)}s"></i>`;
    }
    return `<div class="card ${rar === 'legendary' || rar === 'mythic' ? 'legendary' : rar === 'rare' || rar === 'epic' ? 'rare' : ''}" style="--c:${R.color}">
      <div class="sparks">${sparks}</div>
      <div class="top">${badge || '<span></span>'}<span class="rar">${R.name}</span></div>
      <div class="nm">${WF.svgIcon(s.element, c, 22, 2.2)} ${s.name}</div>
      <div class="meta">${el} · ${WF.svgIcon(s.form, '#8f97ab', 14)} ${s.form.toUpperCase()}, ${WF.FORM_INFO[s.form].desc.toLowerCase()} · <span class="pw">${stars(s.power)}</span></div>
      <div class="fl">“${s.flavor}”</div>
      <div class="words">${s.words.map(w => w.toUpperCase()).join('  +  ')}</div>
      <div class="chips">${s.tags.map(t => `<span class="chip" title="${WF.TAG_INFO[t]}">${WF.svgIcon(WF.TAG_ICON(t), '#ffd36e', 14)} ${WF.TAG_INFO[t]}</span>`).join('')}</div>
      <div class="src">${src}</div></div>`;
  }

  function refreshTitle() {
    curse = WF.curseFor(0);
    $('tCurseName').textContent = curse.name;
    $('tCurseDesc').textContent = curse.desc;
    $('tBest').textContent = Save.data.best;
    $('tDisc').textContent = Save.discoveries();
    const today = WF.dayKey(0), yest = WF.dayKey(-1);
    $('tStreak').textContent = (Save.data.lastDay === today || Save.data.lastDay === yest) ? Save.data.streak : 0;
    const sel = $('tLoadout'); sel.innerHTML = '';
    const opts = [WF.STARTER].concat(Object.values(Save.data.grimoire).sort((a, b) => b.power - a.power));
    for (const s of opts) { const o = document.createElement('option'); o.value = s.key; o.textContent = `${s.name}  (${s.form}, ${stars(s.power)})`; sel.appendChild(o); }
    sel.value = Save.data.grimoire[Save.data.loadout] ? Save.data.loadout : '_starter';
    const b = Save.bonusRunes(), next = 5 - (Save.discoveries() % 5);
    $('tPoints').textContent = '◆ ' + (Save.data.points || 0);
    renderChallenges($('tChal'));
    $('tBonus').textContent = (b ? `+${b} bonus starting rune${b > 1 ? 's' : ''}. ` : '') + (b < 4 ? `Discover ${next} more spell${next > 1 ? 's' : ''} for another.` : '');
  }

  $('tLoadout').onchange = e => { Save.data.loadout = e.target.value; Save.save(); };
  $('bPlay').onclick = () => newRun();
  $('bHow').onclick = () => show('ovHow');
  $('bHowOk').onclick = () => { show('ovTitle'); };
  $('bGrim').onclick = () => openGrimoire();
  $('bGrimClose').onclick = () => show('ovTitle');

  // Forge
  let fSel = [], fResult = null, forging = false;
  function openForge(bonus) {
    state = 'forge'; setPlaying(false);
    Save.data.seenTutorial = true; Save.save();
    fSel = []; fResult = null;
    $('fTitle').textContent = `Wave ${run.wave} cleared — The Forge`;
    if (bonus) toast(`Wave bonus +${bonus} ◆`);
    renderForge();
    show('ovForge');
  }
  function renderForge() {
    const tiles = $('fTiles'); tiles.innerHTML = '';
    run.bag.forEach((w, i) => {
      const b = document.createElement('button');
      b.className = 'tile' + (w === '*' ? ' wild' : '') + (fSel.includes(i) ? ' on' : '');
      const el = WF.LEX[w] ? WF.LEX[w][0] : null;
      if (el) { b.style.setProperty('--c', elColor(el)); b.title = WF.ELEMENTS[el].name; }
      b.textContent = w === '*' ? '✦ wild' : w;
      b.disabled = !!fResult || forging;
      b.onclick = () => {
        if (fSel.includes(i)) fSel = fSel.filter(x => x !== i);
        else if (fSel.length < 2) fSel.push(i);
        else fSel = [fSel[1], i];
        renderForge();
      };
      tiles.appendChild(b);
    });
    if (!run.bag.length && !fResult) tiles.innerHTML = '<div class="hint">No runes left. Kill things, collect words.</div>';
    const wildSel = fSel.some(i => run.bag[i] === '*');
    $('fWild').style.display = wildSel && !fResult ? 'block' : 'none';
    const wordOf = i => run.bag[i] === '*' ? ($('fWildInput').value.trim().toLowerCase() || '✦') : run.bag[i];
    $('fA').textContent = fSel[0] !== undefined ? wordOf(fSel[0]) : '?';
    $('fB').textContent = fSel[1] !== undefined ? wordOf(fSel[1]) : '?';
    $('fA').className = 'slot' + (fSel[0] !== undefined ? ' full' : '');
    $('fB').className = 'slot' + (fSel[1] !== undefined ? ' full' : '');
    $('bForge').disabled = fSel.length !== 2 || !!fResult || forging;
    $('bForge').style.display = fResult ? 'none' : 'block';
    $('fHint').textContent = fResult ? 'Equip it to a slot, or discard.' : run.bag.length >= 2 ? 'Pick two runes to forge a spell. Same pair = same spell, forever.' : 'Need two runes to forge.';
    renderSlots();
  }
  $('fWildInput').addEventListener('input', () => { $('fWildInput').value = $('fWildInput').value.replace(/[^a-z]/gi, ''); renderForge(); });

  function renderSlots() {
    const box = $('fSlots'); box.innerHTML = ''; box.classList.toggle('armed', !!fResult);
    run.slots.forEach((s, i) => {
      const b = document.createElement('button');
      if (s) b.style.setProperty('--c', elColor(s.spell.element));
      b.innerHTML = `<b>${fResult ? 'EQUIP → SLOT ' + (i + 1) : 'SLOT ' + (i + 1)}</b>${s ? s.spell.name : '<span style="color:#4a5166">empty</span>'}`;
      b.disabled = !fResult;
      b.onclick = () => {
        if (!fResult) return;
        run.slots[i] = mkSlot(fResult);
        run.minions = run.minions.filter(m => m.slot !== i);
        fResult = null; $('fResult').innerHTML = ''; fSel = [];
        renderForge();
      };
      box.appendChild(b);
    });
    if (fResult) {
      const d = document.createElement('button');
      d.className = 'discard'; d.innerHTML = '<b>DISCARD</b>keep my current spells';
      d.onclick = () => { fResult = null; $('fResult').innerHTML = ''; fSel = []; renderForge(); };
      box.appendChild(d);
    }
  }

  $('bForge').onclick = async () => {
    if (fSel.length !== 2 || forging) return;
    const usedWild = fSel.some(i => run.bag[i] === '*');
    const words = fSel.map(i => run.bag[i] === '*' ? $('fWildInput').value.trim().toLowerCase() : run.bag[i]);
    if (!words.every(WF.isValidWord)) { toast('Wild rune needs a real word: 2–12 letters.'); return; }
    if (!words.every(WF.isClean)) { toast('That word can’t be forged. Try another.'); $('fWildInput').value = ''; renderForge(); return; }
    forging = true; WF.Audio.forge();
    const key = WF.comboKey(words[0], words[1]);
    // consume runes
    run.bag = run.bag.filter((_, i) => !fSel.includes(i));
    fSel = [];
    $('fResult').innerHTML = '<div class="spinner"><div class="anvil"></div>FORGING</div>';
    renderForge();
    let spell, badge;
    const known = Save.data.grimoire[key];
    await new Promise(r => setTimeout(r, 550)); // a beat of anticipation
    if (known) {
      spell = known; badge = '<span class="badge known">KNOWN SPELL</span>';
    } else {
      const res = await WF.forge(words[0], words[1], Save.data.name);
      spell = res.spell;
      if (res.first) { spell.first = true; Save.data.firsts++; badge = '<span class="badge first">★ WORLD FIRST DISCOVERY</span>'; }
      else badge = `<span class="badge">NEW DISCOVERY${res.discoverer ? ' · first found by ' + res.discoverer : ''}</span>`;
      spell.found = WF.dayKey(0);
      Save.data.grimoire[key] = spell; Save.save();
      run.discoveries.push(spell);
      WF.Challenges.bump('discover'); WF.Stats.add('discovered');
      if (spell.power >= 8) WF.Challenges.bump('legendary');
    }
    WF.Challenges.bump('forge'); WF.Stats.add('forged');
    if (usedWild) WF.Challenges.bump('wild');
    WF.Challenges.flush();
    WF.Audio.reveal(WF.spellRarity(spell.power, spell.element));
    forging = false;
    fResult = spell;
    $('fWildInput').value = '';
    $('fResult').innerHTML = cardHTML(spell, badge);
    renderForge();
  };
  $('bNext').onclick = () => {
    if (forging) return;
    if (fResult) { toast('Equip or discard the new spell first.'); return; }
    hideAll(); startWave(); state = 'play'; setPlaying(true); last = performance.now();
  };

  function endRun() {
    state = 'dead'; setPlaying(false);
    WF.Audio.death(); WF.Audio.duck(0.2, 600, 0.8);
    setTimeout(() => { if (state === 'dead') { WF.Audio.playTrack('menu'); WF.Audio.duck(0.8, 20000, 2); } }, 1800);
    WF.Challenges.flush(); WF.Stats.add('runs'); WF.Stats.flushRun(run);
    const lvBefore = WF.accountLevel(Save.data.xpTotal || 0);
    Save.data.xpTotal = (Save.data.xpTotal || 0) + run.xpGained;
    const lvAfter = WF.accountLevel(Save.data.xpTotal);
    if (lvAfter > lvBefore) { const reward = (lvAfter - lvBefore) * 50; Save.data.points += reward; setTimeout(() => toast(`Account level ${lvAfter}! +${reward} ◆`, 'ch'), 900); }
    Save.save();
    const newBest = Save.recordRun(run.wave);
    $('dWave').textContent = 'Wave ' + run.wave;
    $('dSub').textContent = `${run.kills} kills · ${newBest ? 'NEW BEST!' : 'Best: wave ' + Save.data.best} · ${Save.discoveries()} spells in grimoire`;
    $('dDiscs').innerHTML = run.discoveries.length ? run.discoveries.map(s => `<span class="chip" style="border-left:3px solid ${elColor(s.element)}">${s.name}</span>`).join('') : '<span class="hint">None this time. Try forging stranger pairs.</span>';
    const tm = WF.curseFor(1);
    $('dTomorrow').innerHTML = `Tomorrow's curse: <b>${tm.name}</b>. ${tm.desc}`;
    $('dPoints').textContent = `+${run.points} ◆ this run · ${Save.data.points} ◆ total` + (Save.data.points >= WF.BOX_COST ? ' · you can open a Rune Cache' : '');
    renderChallenges($('dChal'));
    setTimeout(() => show('ovDead'), 500);
  }
  $('bAgain').onclick = () => newRun();
  $('bHome').onclick = goHome;
  function goHome() { WF.Audio.setAmbience(null); run = null; state = 'title'; setPlaying(false); refreshTitle(); show('ovTitle'); WF.Audio.playTrack('menu'); WF.Audio.duck(1, 20000, 1); }

  // ---------- challenges ----------
  function renderChallenges(el) {
    el.innerHTML = WF.Challenges.today().map(c => `<div class="ch ${c.done ? 'done' : ''}">
      <span class="tx">${c.text}</span><span class="rw">${c.done ? '✓ ' : ''}+${c.reward} ◆</span>
      <span class="bar"><i style="width:${Math.round(100 * c.p / c.target)}%"></i></span></div>`).join('');
  }
  WF.Challenges.onComplete = def => {
    toast(`Challenge complete: ${def.text}  +${def.reward} ◆`, 'ch'); WF.Audio.challenge();
    if (run && state === 'play') addText(run.p.x, run.p.y - 46, 'CHALLENGE +' + def.reward, '#6fdc8c');
  };

  // ---------- pause ----------
  $('bPause').onclick = () => togglePause();
  $('bResume').onclick = () => togglePause();
  $('bQuit').onclick = () => { state = 'play'; run.p.hp = 0; hideAll(); endRun(); };
  const _show = show;
  show = function (id) {
    _show(id);
    if (id === 'ovPause') { $('pInfo').textContent = `Wave ${run.wave} · ${curBiome().name} · ${run.kills} kills · +${run.points} ◆`; renderChallenges($('pChal')); }
  };

  // ---------- sound settings ----------
  let settingsBack = 'ovTitle';
  const S = Save.data.settings;
  WF.Audio.setVolumes(S);
  if (S.amb === undefined) S.amb = 0.6;
  const sliders = [['sMaster', 'oMaster', 'master'], ['sMusic', 'oMusic', 'music'], ['sSfx', 'oSfx', 'sfx'], ['sAmb', 'oAmb', 'amb']];
  function syncSettings() {
    for (const [id, out, k] of sliders) { $(id).value = S[k]; $(out).textContent = Math.round(S[k] * 100); }
    $('sMute').checked = !!S.muted; $('sDev').checked = !!Save.data.dev;
  }
  for (const [id, out, k] of sliders) $(id).addEventListener('input', e => { S[k] = +e.target.value; $(out).textContent = Math.round(S[k] * 100); WF.Audio.setVolumes(S); Save.save(); });
  $('sSfx').addEventListener('change', () => WF.Audio.pickup(3, false));
  $('sMute').onchange = e => { S.muted = e.target.checked; WF.Audio.setVolumes(S); Save.save(); };
  function openSettings(back) { settingsBack = back; syncSettings(); show('ovSettings'); }
  $('bSettings').onclick = () => openSettings('ovTitle');
  $('bPauseSettings').onclick = () => openSettings('ovPause');
  $('bSettingsBack').onclick = () => show(settingsBack);

  // ---------- previews (skins & tomes, shared animation loop) ----------
  const previews = [];
  function previewLoop() {
    const open = ['ovWardrobe', 'ovCache', 'ovChallenges'].some(id => $(id).classList.contains('show'));
    if (open) {
      const t = performance.now() / 1000;
      for (const pv of previews) {
        if (!pv.cv.isConnected) continue;
        const g = pv.g, dpr = pv.dpr, size = pv.cv.width / dpr;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
        if (pv.kind === 'tome') WF.drawTome(g, size * 0.2, size * 0.12, size * 0.6, size * 0.76, pv.item, t + pv.off);
        else WF.drawSkin(g, size / 2, size / 2, size * 0.15, pv.item, t + pv.off, { face: t * 0.8 + pv.off });
        if (pv.locked) {
          g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(6,7,11,0.92)'; g.fillRect(0, 0, size, size); g.globalCompositeOperation = 'source-over';
          g.fillStyle = '#4a5166'; g.font = `800 ${Math.round(size * 0.24)}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', size / 2, size / 2 + 1);
        }
      }
      for (let i = previews.length - 1; i >= 0; i--) if (!previews[i].cv.isConnected) previews.splice(i, 1);
    }
    requestAnimationFrame(previewLoop);
  }
  requestAnimationFrame(previewLoop);
  function mkPreview(item, size, locked, kind = 'skin') {
    const cv = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = cv.height = size * dpr; cv.style.width = cv.style.height = size + 'px';
    previews.push({ cv, g: cv.getContext('2d'), item, locked, dpr, kind, off: Math.random() * 10 });
    return cv;
  }
  const ownedTomes = () => (Save.data.tomes = Save.data.tomes || { leather: true });
  function rewardText(kind, id) { const m = WF.Milestones.rewardFor(kind, id); return m ? 'Reward: ' + m.text : 'Challenge reward'; }

  // ---------- wardrobe (player skins | grimoire skins) ----------
  let wTab = 'skins';
  function openWardrobe() {
    const isSkins = wTab === 'skins', list = isSkins ? WF.SKINS : WF.TOMES, owned = isSkins ? Save.data.skins : ownedTomes();
    $('wTabSkins').className = isSkins ? 'on' : ''; $('wTabTomes').className = isSkins ? '' : 'on';
    $('wPoints').textContent = '◆ ' + Save.data.points;
    $('wCount').textContent = `${list.filter(s => owned[s.id]).length} of ${list.length} ${isSkins ? 'skins' : 'grimoire skins'} collected. ` + (isSkins ? 'Tap one you own to wear it.' : 'Grimoire skins restyle your spell book and the bar at the bottom of the screen.');
    const grid = $('wGrid'); grid.innerHTML = '';
    const sorted = list.slice().sort((a, b) => WF.RARITY_ORDER.indexOf(a.rarity) - WF.RARITY_ORDER.indexOf(b.rarity));
    for (const sk of sorted) {
      const has = !!owned[sk.id], R = WF.RARITIES[sk.rarity], on = isSkins ? Save.data.skin === sk.id : (Save.data.tome || 'leather') === sk.id;
      const b = document.createElement('button');
      b.className = `skin ${sk.rarity}` + (has ? '' : ' locked') + (on ? ' on' : '');
      b.style.setProperty('--rc', R.color);
      b.appendChild(mkPreview(sk, 84, !has, isSkins ? 'skin' : 'tome'));
      b.insertAdjacentHTML('beforeend', `<span class="nm">${has || sk.exclusive ? sk.name : '???'}</span><span class="rr">${R.name}</span>` + (!has && sk.exclusive ? `<span class="rw">${rewardText(isSkins ? 'skin' : 'tome', sk.id)}</span>` : ''));
      b.onclick = () => {
        if (!has) { toast(sk.exclusive ? rewardText(isSkins ? 'skin' : 'tome', sk.id) : `Locked. ${R.name} drops from Rune Caches.`); return; }
        if (isSkins) Save.data.skin = sk.id; else Save.data.tome = sk.id;
        Save.save(); WF.Audio.select(); openWardrobe();
      };
      grid.appendChild(b);
    }
    show('ovWardrobe');
  }
  $('wTabSkins').onclick = () => { wTab = 'skins'; openWardrobe(); };
  $('wTabTomes').onclick = () => { wTab = 'tomes'; openWardrobe(); };
  $('bWardrobe').onclick = openWardrobe;
  $('bWardClose').onclick = () => { refreshTitle(); show('ovTitle'); };

  // ---------- rune cache: open 1, 5 or 10 ----------
  let cacheBack = 'ovTitle', opening = false;
  const PRICES = { 1: WF.BOX_COST, 5: Math.round(WF.BOX_COST * 5 * 0.95), 10: Math.round(WF.BOX_COST * 10 * 0.9) };
  function openCache(back) {
    cacheBack = back || 'ovTitle';
    const tiers = WF.RARITY_ORDER.filter(k => WF.RARITIES[k].weight > 0), total = tiers.reduce((s, k) => s + WF.RARITIES[k].weight, 0);
    $('cOdds').innerHTML = tiers.map(k => { const R = WF.RARITIES[k], pc = 100 * R.weight / total; return `<div class="odd" style="--rc:${R.color}"><b>${R.name}</b><span>${pc < 1 ? pc.toFixed(2) : pc.toFixed(pc < 10 ? 1 : 0)}%</span></div>`; }).join('');
    resetCache();
    show('ovCache');
  }
  function resetCache() {
    const st = $('cStage'); st.className = 'stage'; st.style.removeProperty('--rc');
    $('cChest').className = 'chest'; $('cResult').innerHTML = ''; $('cMulti').innerHTML = '';
    updateOpenButtons();
  }
  function updateOpenButtons() {
    $('cPoints').textContent = '◆ ' + Save.data.points;
    for (const [n, id] of [[1, 'bOpen'], [5, 'bOpen5'], [10, 'bOpen10']]) {
      $(id).disabled = opening || Save.data.points < PRICES[n];
      $(id).textContent = `OPEN ${n} · ◆ ${PRICES[n]}`;
    }
  }
  function grant(roll) {
    const { kind, item } = roll, owned = kind === 'skin' ? Save.data.skins : ownedTomes();
    const dupe = !!owned[item.id], R = WF.RARITIES[item.rarity];
    if (dupe) Save.data.points += R.dupe; else owned[item.id] = true;
    return { kind, item, dupe, refund: dupe ? R.dupe : 0 };
  }
  function doOpen(n) {
    if (opening || Save.data.points < PRICES[n]) return;
    if ($('cStage').classList.contains('revealed')) resetCache();
    resetCache(); opening = true; updateOpenButtons();
    Save.data.points -= PRICES[n]; Save.data.boxes = (Save.data.boxes || 0) + n; WF.Stats.add('boxes', n);
    const results = Array.from({ length: n }, () => grant(WF.rollCache()));
    Save.save();
    const best = results.reduce((a, r) => WF.RARITY_ORDER.indexOf(r.item.rarity) > WF.RARITY_ORDER.indexOf(a.item.rarity) ? r : a, results[0]);
    const st = $('cStage'), chest = $('cChest');
    $('cPoints').textContent = '◆ ' + Save.data.points;
    chest.classList.add('shake');
    const tiers = WF.RARITY_ORDER.slice(0, WF.RARITY_ORDER.indexOf(best.item.rarity) + 1);
    tiers.forEach((k, i) => setTimeout(() => { st.style.setProperty('--rc', WF.RARITIES[k].color); WF.Audio.rattle(); }, 200 + i * 220));
    const tOpen = 380 + tiers.length * 220;
    setTimeout(() => { chest.classList.remove('shake'); chest.classList.add('open'); WF.Audio.boxOpen(); }, tOpen);
    setTimeout(() => {
      chest.classList.add('gone');
      st.style.setProperty('--rc', WF.RARITIES[best.item.rarity].color);
      st.classList.add('revealed');
      if (WF.RARITY_ORDER.indexOf(best.item.rarity) >= 3) st.classList.add('big');
      if (['mythic', 'light', 'dark'].includes(best.item.rarity)) st.classList.add('mythic');
      if (n === 1) {
        const r = best, R = WF.RARITIES[r.item.rarity], res = $('cResult');
        res.appendChild(mkPreview(r.item, 120, false, r.kind));
        res.insertAdjacentHTML('beforeend', `<span class="rr">${R.name} ${r.kind === 'tome' ? 'grimoire skin' : 'skin'}</span><span class="nm">${r.item.name}</span>` + (r.dupe ? `<span class="dp">Duplicate · refunded +${r.refund} ◆</span>` : `<span class="nw">NEW</span>`));
        if (!r.dupe) { if (r.kind === 'skin') Save.data.skin = r.item.id; else Save.data.tome = r.item.id; Save.save(); toast(`${r.item.name} equipped. Change it in the Wardrobe.`); }
      } else {
        st.classList.add('multi-on');
        const box = $('cMulti');
        results.forEach((r, i) => {
          const R = WF.RARITIES[r.item.rarity], d = document.createElement('div');
          d.className = 'mres ' + r.item.rarity; d.style.setProperty('--rc', R.color); d.style.animationDelay = (i * 0.08) + 's';
          d.appendChild(mkPreview(r.item, 52, false, r.kind));
          d.insertAdjacentHTML('beforeend', `<b>${r.item.name}</b><i>${R.name}</i>` + (r.dupe ? `<em class="dp">+${r.refund} ◆</em>` : '<em>NEW</em>'));
          box.appendChild(d);
        });
        const news = results.filter(r => !r.dupe).length, refunds = results.reduce((a, r) => a + r.refund, 0);
        toast(`${news} new · ${n - news} duplicates refunded +${refunds} ◆`);
      }
      WF.Audio.reveal(best.item.rarity === 'ultra' ? 'mythic' : ['light', 'dark'].includes(best.item.rarity) ? 'mythic' : best.item.rarity);
      WF.Challenges.bump('boxes', n); WF.Challenges.flush(); WF.Stats.flushRun(null);
      opening = false; updateOpenButtons();
    }, tOpen + 450);
  }
  $('bOpen').onclick = () => doOpen(1);
  $('bOpen5').onclick = () => doOpen(5);
  $('bOpen10').onclick = () => doOpen(10);
  $('bCache').onclick = () => openCache('ovTitle');
  $('bDeadCache').onclick = () => openCache('ovDead');
  $('bWardCache').onclick = () => openCache('ovWardrobe');
  $('bCacheWard').onclick = openWardrobe;
  $('bCacheClose').onclick = () => { if (opening) return; if (cacheBack === 'ovTitle') refreshTitle(); if (cacheBack === 'ovWardrobe') return openWardrobe(); if (cacheBack === 'ovDead') $('dPoints').textContent = `${Save.data.points} ◆ total`; show(cacheBack); };

  // ---------- challenges (milestones + daily) ----------
  let xTab = 'ms';
  function openChallenges() {
    $('xTabMs').className = xTab === 'ms' ? 'on' : ''; $('xTabDaily').className = xTab === 'ms' ? '' : 'on';
    $('xPoints').textContent = '◆ ' + Save.data.points;
    const body = $('xBody'); body.innerHTML = '';
    if (xTab === 'daily') { body.innerHTML = '<div class="hint" style="text-align:left">Three new challenges every day, the same for every player.</div><div class="chal" id="xDaily"></div>'; renderChallenges($('xDaily')); show('ovChallenges'); return; }
    const done = Save.data.ms || {};
    let group = '';
    for (const m of WF.MILESTONES) {
      if (m.group !== group) { group = m.group; body.insertAdjacentHTML('beforeend', `<div class="ms-group">${group}</div>`); }
      const pr = WF.Milestones.progress(m), isDone = !!done[m.id], r = m.reward;
      const d = document.createElement('div'); d.className = 'ms' + (isDone ? ' done' : '');
      d.innerHTML = `<span class="tx">${isDone ? '✓ ' : ''}${m.text}</span><span class="rw"></span><span class="bar"><i style="width:${Math.round(pr * 100)}%"></i></span><span class="pg">${WF.Milestones.label(m)}</span>`;
      const rw = d.querySelector('.rw');
      if (r.skin || r.tome) {
        const item = r.skin ? WF.skinById(r.skin) : WF.tomeById(r.tome), R = WF.RARITIES[item.rarity];
        rw.appendChild(mkPreview(item, 38, false, r.skin ? 'skin' : 'tome'));
        rw.insertAdjacentHTML('beforeend', `<span>+${r.points} ◆<br><span class="sk" style="color:${R.color}">${R.name}: ${item.name}</span></span>`);
      } else rw.textContent = `+${r.points} ◆`;
      body.appendChild(d);
    }
    show('ovChallenges');
  }
  $('bChallenges').onclick = openChallenges;
  $('xTabMs').onclick = () => { xTab = 'ms'; openChallenges(); };
  $('xTabDaily').onclick = () => { xTab = 'daily'; openChallenges(); };
  $('bChalClose').onclick = () => { refreshTitle(); show('ovTitle'); };
  WF.Milestones.onComplete = m => {
    const r = m.reward, item = r.skin ? WF.skinById(r.skin) : r.tome ? WF.tomeById(r.tome) : null;
    toast(`Milestone: ${m.text}! +${r.points} ◆` + (item ? ` · unlocked ${WF.RARITIES[item.rarity].name} ${item.name}` : ''), 'ch');
    WF.Audio.challenge(); if (item) setTimeout(() => WF.Audio.reveal(item.rarity === 'ultra' ? 'mythic' : 'legendary'), 400);
  };

  // ---------- grimoire (book) ----------
  let gFilter = 'all', gSel = null;
  function spellList() { return Object.values(Save.data.grimoire); }
  function openGrimoire() {
    { const T = WF.tomeById(Save.data.tome), b = document.querySelector('#ovGrim .book'), tt = performance.now() / 1000; b.style.background = `linear-gradient(180deg, ${T.cover[0]}, ${T.cover[1]})`; b.style.borderColor = WF.resolveCol(T.border, tt); document.querySelectorAll('#ovGrim .page').forEach((p, i) => p.style.background = `linear-gradient(90deg, ${T.page[i ? 1 : 0]}, ${T.page[i ? 0 : 1]})`); }
    const all = spellList();
    $('gPoints').textContent = '◆ ' + Save.data.points;
    const counts = {}; for (const s2 of all) { const r = WF.spellRarity(s2.power, s2.element); counts[r] = (counts[r] || 0) + 1; }
    $('gStats').innerHTML = `<span class="gstat" style="--rc:#ffe7a8">${all.length} SPELLS</span>` + WF.RARITY_ORDER.map(k => `<span class="gstat" style="--rc:${WF.RARITIES[k].color}">${counts[k] || 0} ${WF.RARITIES[k].name.toUpperCase()}</span>`).join('');
    const fbtn = (id, label) => `<button class="${gFilter === id ? 'on' : ''}" data-f="${id}">${label}</button>`;
    $('gFilters').innerHTML = fbtn('all', 'All') + WF.RARITY_ORDER.map(k => fbtn(k, `<span style="color:${WF.RARITIES[k].color}">●</span> ${WF.RARITIES[k].name}`)).join('') + WF.EL_LIST.map(el => fbtn('el:' + el, WF.svgIcon(el, elColor(el), 14))).join('');
    $('gFilters').querySelectorAll('button').forEach(b => b.onclick = () => { gFilter = b.dataset.f; openGrimoire(); });
    let list = all.filter(s2 => gFilter === 'all' || (gFilter.startsWith('el:') ? s2.element === gFilter.slice(3) : WF.spellRarity(s2.power, s2.element) === gFilter));
    list.sort((a, b) => b.power - a.power || a.name.localeCompare(b.name));
    if (!gSel || !Save.data.grimoire[gSel]) gSel = list[0] ? list[0].key : null;
    $('gGrid').innerHTML = list.length ? list.map(s2 => {
      const r = WF.spellRarity(s2.power, s2.element), R = WF.RARITIES[r], c = elColor(s2.element);
      return `<button class="gs ${r} ${gSel === s2.key ? 'on' : ''}" data-k="${s2.key}" style="--rc:${R.color};--ec:${c}"><span class="sig">${WF.svgIcon(s2.element, c, 18)}</span><b>${s2.name}</b><span class="tg">${R.name}${s2.tags.map(t => WF.svgIcon(WF.TAG_ICON(t), R.color, 11)).join('')}</span></button>`;
    }).join('') : `<div class="gempty">${all.length ? 'No spells match this filter.' : 'The pages are blank. Forge two runes after a wave to write your first spell.'}</div>`;
    $('gGrid').querySelectorAll('.gs').forEach(b => b.onclick = () => { gSel = b.dataset.k; WF.Audio.select(); openGrimoire(); });
    renderSpellDetail();
    show('ovGrim');
  }
  function renderSpellDetail() {
    const s2 = gSel && Save.data.grimoire[gSel], box = $('gDetail');
    if (!s2) { box.innerHTML = '<div class="gempty">Select a spell to read its page.</div>'; return; }
    const r = WF.spellRarity(s2.power, s2.element), R = WF.RARITIES[r], c = elColor(s2.element);
    const lvl = s2.lvl || 1, maxLvl = 5, cost = 60 * lvl, canUp = lvl < maxLvl && s2.power < 10;
    const el = WF.ELEMENTS[s2.element].name + (s2.secondary ? ' / ' + WF.ELEMENTS[s2.secondary].name : '');
    box.innerHTML = `<div class="gd">
      <div class="sigil" style="--rc:${R.color};--ec:${c}">${WF.svgIcon(s2.element, c, 56, 1.6)}</div>
      <div class="rar" style="--rc:${R.color}">${R.name}${s2.first ? ' · ★ world first' : ''}</div>
      <h3>${s2.name}</h3>
      <div class="fl">“${s2.flavor}”</div>
      <div class="words">${s2.words.map(w => w.toUpperCase()).join('  +  ')}</div>
      <div class="pips" style="--rc:${R.color}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < s2.power ? 'on' : ''}"></i>`).join('')}</div>
      <div class="facts">
        <div class="fact">${WF.svgIcon(s2.element, c, 18)}<span><b>${el}</b></span></div>
        <div class="fact">${WF.svgIcon(s2.form, '#ffd36e', 18)}<span><b>${s2.form[0].toUpperCase() + s2.form.slice(1)}</b> · ${WF.FORM_INFO[s2.form].desc.toLowerCase()}</span></div>
        ${s2.tags.map(t => `<div class="fact">${WF.svgIcon(WF.TAG_ICON(t), '#ffd36e', 18)}<span>${WF.TAG_INFO[t]}</span></div>`).join('')}
        <div class="fact">${WF.svgIcon('haste', '#ffd36e', 18)}<span>Cast speed <b>×${s2.rate}</b></span></div>
      </div>
      <div class="lv">Spell level <b>${lvl}</b> / ${maxLvl} · power ${s2.power}/10</div>
      <div class="row">
        <button class="btn ${canUp ? '' : 'ghost'}" id="gUp" ${canUp && Save.data.points >= cost ? '' : 'disabled'}>${canUp ? `UPGRADE · ◆ ${cost}` : 'FULLY EMPOWERED'}</button>
      </div>
      <div class="row"><button class="btn ghost ${Save.data.loadout === s2.key ? 'gold' : ''}" id="gLoad">${Save.data.loadout === s2.key ? 'Starting spell ✓' : 'Start runs with this spell'}</button></div>
    </div>`;
    const up = $('gUp');
    if (up) up.onclick = () => {
      if (!canUp || Save.data.points < cost) return;
      Save.data.points -= cost; s2.lvl = lvl + 1; s2.power = Math.min(10, s2.power + 1); Save.save();
      const nr = WF.spellRarity(s2.power, s2.element);
      WF.Audio.forge(); WF.Audio.reveal(nr);
      toast(nr !== r ? `${s2.name} ascended to ${WF.RARITIES[nr].name}!` : `${s2.name} empowered to level ${s2.lvl}.`, nr !== r ? 'ch' : '');
      openGrimoire();
    };
    $('gLoad').onclick = () => { Save.data.loadout = s2.key; Save.save(); WF.Audio.select(); renderSpellDetail(); };
  }
  $('bGrimClose').onclick = () => { refreshTitle(); show('ovTitle'); };

  // ---------- level up ----------
  let lvChoices = [];
  function openLevelUp() {
    state = 'level'; setPlaying(false);
    WF.Audio.duck(0.45, 1500, 0.4);
    lvChoices = WF.rollUpgrades(run.taken, 3);
    if (!lvChoices.length) { run.lvlQueue = 0; state = 'play'; setPlaying(true); return; }
    $('lvNum').textContent = run.lvl - run.lvlQueue + 1;
    $('lvCards').innerHTML = lvChoices.map((u, i) => `<button class="up" data-i="${i}"><span class="ic">${WF.svgIcon(u.icon, '#ffd36e', 28)}</span><span><b>${u.name}</b><br><span>${u.desc}</span><br><em>RANK ${(run.taken[u.id] || 0) + 1} / ${u.max}</em></span></button>`).join('');
    $('lvCards').querySelectorAll('.up').forEach(b => b.onclick = () => pickUpgrade(lvChoices[+b.dataset.i]));
    show('ovLevel');
  }
  function pickUpgrade(u) {
    u.apply(run.st, run); run.taken[u.id] = (run.taken[u.id] || 0) + 1; run.lvlQueue--;
    WF.Audio.select();
    if (run.lvlQueue > 0) { openLevelUp(); return; }
    hideAll(); state = 'play'; setPlaying(true); last = performance.now();
    WF.Audio.duck(run.ducked ? 0.3 : 1, run.ducked ? 1800 : 20000, 0.4);
  }
  addEventListener('keydown', e => { if (state === 'level' && ['1', '2', '3'].includes(e.key) && lvChoices[+e.key - 1]) pickUpgrade(lvChoices[+e.key - 1]); });

  // ---------- character (permanent upgrades) ----------
  function openChar() {
    const d = Save.data; d.perks = d.perks || {};
    $('chPoints').textContent = '◆ ' + d.points;
    const ap = WF.accountProgress(d.xpTotal || 0);
    $('chAcct').innerHTML = `<span class="lvl">${ap.level}</span><b>Account level ${ap.level}</b><span><span class="bar"><i style="width:${Math.round(ap.frac * 100)}%"></i></span><small>${ap.next} XP to level ${ap.level + 1} · each level pays 50 ◆</small></span>`;
    $('chPerks').innerHTML = WF.PERKS.map(pk => {
      const rank = d.perks[pk.id] || 0, max = rank >= pk.ranks, cost = WF.perkCost(rank);
      return `<div class="perk"><span class="ic">${WF.svgIcon(pk.icon, '#ffd36e', 22)}</span><b>${pk.name}</b><small>${pk.per} per rank</small>
        <span class="rk">${Array.from({ length: pk.ranks }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</span>
        <button data-p="${pk.id}" ${max || d.points < cost ? 'disabled' : ''}>${max ? 'MAXED' : `RANK ${rank + 1} · ◆ ${cost}`}</button></div>`;
    }).join('');
    $('chPerks').querySelectorAll('button[data-p]').forEach(b => b.onclick = () => {
      const pk = WF.PERKS.find(x => x.id === b.dataset.p), rank = d.perks[pk.id] || 0, cost = WF.perkCost(rank);
      if (rank >= pk.ranks || d.points < cost) return;
      d.points -= cost; d.perks[pk.id] = rank + 1; Save.save(); WF.Audio.levelUp(); openChar();
    });
    show('ovChar');
  }
  $('bChar').onclick = openChar;
  $('bCharClose').onclick = () => { refreshTitle(); show('ovTitle'); };

  // ---------- developer tools ----------
  const devActions = [
    ['+1000 ◆', () => { Save.data.points += 1000; Save.save(); refreshTitle(); }],
    ['All skins', () => { WF.SKINS.forEach(k => Save.data.skins[k.id] = true); WF.TOMES.forEach(k => ownedTomes()[k.id] = true); Save.save(); }],
    ['Max stats', () => { Object.assign(WF.Stats.d, { kills: 100000, forged: 1000, discovered: 100, distance: 100000, bosses: 10, majors: 1, waveMax: 30, bestW30: 1400, boxes: 50 }); WF.Stats.flushRun(null); }],
    ['God mode', () => { DEV.god = !DEV.god; }, () => DEV.god],
    ['Speed ×3', () => { DEV.speed = DEV.speed === 1 ? 3 : 1; }, () => DEV.speed > 1],
    ['Hitboxes', () => { DEV.hitboxes = !DEV.hitboxes; }, () => DEV.hitboxes],
    ['Level up', () => { if (run) gainXP(run.xpNext - run.xp); }],
    ['Skip wave', () => { if (run) { run.quota = 0; run.eliteSpawned = true; run.bossPending = 0; for (const e of run.enemies) e.dead = true; run.boss = null; } }],
    ['Kill all', () => { if (run) for (const e of run.enemies) if (!e.dead) kill(e, null); }],
    ['Spawn elite', () => { if (run) spawnEnemy('elite'); }],
    ['Spawn boss', () => { if (run && !run.boss) spawnBoss(); }],
    ['8 runes', () => { if (run) { run.bag = Array.from({ length: 8 }, () => pick(WF.RUNE_POOL)); } }],
    ['Wild runes', () => { if (run) { run.bag = run.bag.slice(0, 5).concat(['*', '*', '*']); } }],
    ['Legend spells', () => { if (run) run.slots = [0, 1, 2].map(() => { let sp; for (let k = 0; k < 400; k++) { sp = WF.forgeLocal(pick(WF.RUNE_POOL), pick(WF.RUNE_POOL)); if (sp.power >= 8) break; } return mkSlot(sp); }); }],
    ['Full heal', () => { if (run) run.p.hp = run.p.maxHp; }],
    ['Do challenges', () => { const d = Save.data; WF.Challenges.today(); d.ch.items.forEach(it => { if (!it.done) { const def = WF.CHALLENGES.find(c => c.id === it.id); it.p = def.target; it.done = true; d.points += def.reward; } }); Save.save(); refreshTitle(); }],
    ['Reset save', function () { if (this._armed) { localStorage.removeItem(Save.KEY); location.reload(); } else { this._armed = true; toast('Press Reset save again to wipe everything.'); } }],
  ];
  function renderDev() {
    $('devGrid').innerHTML = '';
    devActions.forEach(([label, fn, on]) => {
      const b = document.createElement('button'); b.textContent = label; if (on && on()) b.className = 'on';
      b.onclick = () => { fn.call(b); renderDev(); };
      $('devGrid').appendChild(b);
    });
  }
  function setDev(on) { Save.data.dev = on; Save.save(); $('dev').hidden = !on; if (on) renderDev(); }
  $('sDev').onchange = e => setDev(e.target.checked);
  $('devClose').onclick = () => setDev(false);
  $('devGo').onclick = () => {
    const w = Math.max(1, Math.min(99, parseInt($('devWave').value, 10) || 1));
    if (!run) newRun();
    hideAll(); for (const e of run.enemies) e.dead = true; run.enemies = []; run.boss = null; run.bossPending = 0;
    run.wave = w - 1; startWave(); state = 'play'; setPlaying(true); last = performance.now();
  };
  addEventListener('keydown', e => { if (e.key === '`') setDev($('dev').hidden); });
  if (Save.data.dev) setDev(true);

  // ---------- menu sounds ----------
  document.addEventListener('click', e => { if (e.target.closest('button, .tile')) WF.Audio.click(); }, true);
  document.addEventListener('change', e => { if (e.target.matches('select')) WF.Audio.select(); });
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && e.target.closest('button:not(:disabled)')) WF.Audio.hover(); });

  WF.Audio.playTrack('menu');
  refreshTitle();

  // debug/testing hook
  window.__wf = { get run() { return run; }, get state() { return state; }, set state(v) { state = v; }, newRun, openForge, Save, step: dt => update(dt), keys, startWave };
})();
