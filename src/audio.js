// Wordforge — audio. Everything is synthesized with WebAudio (no files to load).
//  - Per-element spell sounds, hits, kills, pickups, UI clicks.
//  - Procedural music: one track per area plus a menu track, with intensity layers,
//    crossfades between tracks, and a duck/muffle used when a wave is ending and in the forge.
window.WF = window.WF || {};

WF.Audio = (function () {
  let ac = null, master, comp, musicBus, musicDuck, musicFilter, sfxBus, uiBus, ambBus, verb, verbSend, noiseBuf;
  const vol = { master: 0.9, music: 0.55, sfx: 0.75, amb: 0.6, muted: false };
  const last = {}; // throttle timestamps

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const now = () => ac.currentTime;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicFilter = ac.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 20000;
    musicDuck = ac.createGain();
    musicBus.connect(musicFilter); musicFilter.connect(musicDuck); musicDuck.connect(master);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    uiBus = ac.createGain(); uiBus.connect(master);
    ambBus = ac.createGain(); ambBus.connect(master);
    // cheap reverb
    verb = ac.createConvolver();
    const len = ac.sampleRate * 2.2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir; verbSend = ac.createGain(); verbSend.gain.value = 0.35; verbSend.connect(verb); verb.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    applyVolumes();
    setInterval(schedule, 25);
    setInterval(ambTick, 60);
  }

  function applyVolumes() {
    if (!ac) return;
    const m = vol.muted ? 0 : vol.master;
    master.gain.setTargetAtTime(m, now(), 0.05);
    musicBus.gain.setTargetAtTime(vol.music * 0.5, now(), 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx, now(), 0.05);
    uiBus.gain.setTargetAtTime(Math.max(0.15, vol.sfx) * 0.6, now(), 0.05);
    ambBus.gain.setTargetAtTime((vol.amb ?? 0.6) * 0.8, now(), 0.05);
  }
  function setVolumes(v) { Object.assign(vol, v); applyVolumes(); }

  // ---------- primitives ----------
  function tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, v = 0.2, a = 0.004, at = 0, dest = sfxBus, detune = 0, wet = 0, filter = null }) {
    const t0 = now() + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (filter) { const fl = ac.createBiquadFilter(); fl.type = filter.type || 'lowpass'; fl.frequency.value = filter.f; fl.Q.value = filter.q || 0.7; o.connect(fl); node = fl; }
    node.connect(g); g.connect(dest);
    if (wet) { const s = ac.createGain(); s.gain.value = wet; g.connect(s); s.connect(verbSend); }
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise({ dur = 0.1, v = 0.2, type = 'bandpass', f = 1000, f2 = null, q = 1, at = 0, dest = sfxBus, a = 0.003, wet = 0 }) {
    const t0 = now() + at;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(dest);
    if (wet) { const w = ac.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbSend); }
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  function throttle(key, ms) {
    const t = performance.now();
    if (last[key] && t - last[key] < ms) return false;
    last[key] = t; return true;
  }

  // ---------- spell casts by element ----------
  const CAST = {
    fire:   k => { noise({ dur: 0.22 * k, v: 0.22, type: 'lowpass', f: 2600, f2: 300, q: 0.8 }); tone({ f: 140, f2: 70, type: 'sine', dur: 0.14 * k, v: 0.18 }); },
    ice:    k => { tone({ f: 1760, type: 'sine', dur: 0.25 * k, v: 0.09, wet: 0.5 }); tone({ f: 2637, type: 'sine', dur: 0.18 * k, v: 0.06, at: 0.02, wet: 0.5 }); noise({ dur: 0.05, v: 0.06, type: 'highpass', f: 6000 }); },
    storm:  k => { tone({ f: 1200, f2: 180, type: 'sawtooth', dur: 0.09 * k, v: 0.08, filter: { f: 3000 } }); for (let i = 0; i < 3; i++) noise({ dur: 0.025, v: 0.12, type: 'highpass', f: 3500, at: i * 0.03 }); },
    earth:  k => { tone({ f: 120, f2: 48, type: 'sine', dur: 0.2 * k, v: 0.32 }); noise({ dur: 0.12 * k, v: 0.12, type: 'lowpass', f: 600 }); },
    poison: k => { [420, 560, 380].forEach((f, i) => tone({ f, f2: f * 1.5, type: 'triangle', dur: 0.06, v: 0.07, at: i * 0.045 })); noise({ dur: 0.1, v: 0.04, type: 'bandpass', f: 900, q: 6 }); },
    void:   k => { tone({ f: 220, f2: 90, type: 'sawtooth', dur: 0.3 * k, v: 0.07, detune: -12, filter: { f: 900 }, wet: 0.6 }); tone({ f: 222, f2: 92, type: 'sawtooth', dur: 0.3 * k, v: 0.07, detune: 12, filter: { f: 900 } }); },
    light:  k => { tone({ f: 1318, type: 'sine', dur: 0.35 * k, v: 0.08, wet: 0.7 }); tone({ f: 1975, type: 'sine', dur: 0.3 * k, v: 0.05, at: 0.03, wet: 0.7 }); },
    dark:   k => { tone({ f: 90, f2: 260, type: 'sawtooth', dur: 0.26 * k, v: 0.07, a: 0.2 * k, filter: { f: 700 }, wet: 0.5 }); noise({ dur: 0.2 * k, v: 0.06, type: 'bandpass', f: 500, f2: 1500, q: 3, a: 0.15 }); },
    life:   k => { tone({ f: 523, type: 'triangle', dur: 0.22 * k, v: 0.07, wet: 0.4 }); tone({ f: 659, type: 'triangle', dur: 0.22 * k, v: 0.06, at: 0.04, wet: 0.4 }); },
  };
  const FORM_K = { bolt: 0.8, nova: 1.7, beam: 1.5, zone: 1.2, chain: 1, summon: 1.1, orbit: 0, shield: 0 };

  function cast(element, form) {
    if (!ac || !CAST[element]) return;
    const k = FORM_K[form] ?? 1; if (!k) return;
    if (!throttle('cast_' + element + form, form === 'bolt' ? 90 : 60)) return;
    CAST[element](k);
    if (form === 'nova') tone({ f: 90, f2: 40, type: 'sine', dur: 0.35, v: 0.28 });
    if (form === 'chain' && element !== 'storm') noise({ dur: 0.08, v: 0.08, type: 'highpass', f: 4000 });
    if (form === 'summon') tone({ f: 400, f2: 800, type: 'triangle', dur: 0.15, v: 0.06 });
  }
  function hit(element) { if (!ac || !throttle('hit', 45)) return; noise({ dur: 0.03, v: 0.07, type: 'bandpass', f: element === 'earth' ? 500 : 2200, q: 2 }); }
  function kill(type) {
    if (!ac) return;
    if (type === 'elite') { tone({ f: 80, f2: 30, type: 'sine', dur: 0.8, v: 0.45 }); noise({ dur: 0.7, v: 0.25, type: 'lowpass', f: 1800, f2: 100, wet: 0.6 }); [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.4, v: 0.07, at: 0.15 + i * 0.07, wet: 0.5 })); return; }
    if (!throttle('kill', 35)) return;
    const big = type === 'brute';
    tone({ f: big ? 300 : 700 + Math.random() * 200, f2: big ? 80 : 200, type: 'square', dur: big ? 0.16 : 0.06, v: big ? 0.08 : 0.05, filter: { f: 2500 } });
    if (big) noise({ dur: 0.15, v: 0.12, type: 'lowpass', f: 900 });
  }
  function hurt() { if (!ac || !throttle('hurt', 120)) return; tone({ f: 220, f2: 90, type: 'square', dur: 0.18, v: 0.12, filter: { f: 1400 } }); noise({ dur: 0.12, v: 0.1, type: 'lowpass', f: 700 }); }
  function pickup(n, wild) {
    if (!ac || !throttle('pick', 40)) return;
    const base = wild ? 72 : 76 + (n % 8);
    tone({ f: mtof(base), type: 'triangle', dur: 0.12, v: 0.08, wet: 0.3 }); tone({ f: mtof(base + 7), type: 'sine', dur: 0.16, v: 0.06, at: 0.05, wet: 0.4 });
    if (wild) tone({ f: mtof(base + 12), type: 'sine', dur: 0.4, v: 0.06, at: 0.1, wet: 0.8 });
  }
  function waveStart() { if (!ac) return; tone({ f: 110, type: 'sawtooth', dur: 0.9, v: 0.08, a: 0.08, filter: { f: 700 }, wet: 0.6 }); tone({ f: 165, type: 'sawtooth', dur: 0.9, v: 0.06, a: 0.08, at: 0.12, filter: { f: 800 }, wet: 0.6 }); }
  function waveClear() { if (!ac) return; [0, 4, 7, 12].forEach((s, i) => tone({ f: mtof(67 + s), type: 'triangle', dur: 0.35, v: 0.08, at: i * 0.08, wet: 0.6 })); }
  function areaEnter() { if (!ac) return; noise({ dur: 1.4, v: 0.1, type: 'bandpass', f: 400, f2: 2400, q: 1.5, a: 0.5, wet: 0.8 }); tone({ f: 55, type: 'sine', dur: 1.6, v: 0.25, a: 0.3 }); }
  function forge() { if (!ac) return; [523, 1187, 1633, 2210].forEach((f, i) => tone({ f, type: 'sine', dur: 0.9 - i * 0.15, v: 0.09 - i * 0.015, wet: 0.5 })); noise({ dur: 0.06, v: 0.25, type: 'highpass', f: 2000 }); }
  function reveal(tier) {
    if (!ac) return;
    const steps = { common: [0, 7], uncommon: [0, 4, 7], rare: [0, 4, 7, 12], epic: [0, 3, 7, 10, 14], legendary: [0, 4, 7, 11, 14, 19], mythic: [0, 4, 7, 11, 14, 19, 23, 26] }[tier] || [0, 7];
    steps.forEach((s, i) => tone({ f: mtof(64 + s), type: i % 2 ? 'sine' : 'triangle', dur: 0.6, v: 0.07, at: i * 0.07, wet: 0.7 }));
    if (tier === 'legendary' || tier === 'mythic') noise({ dur: 1.2, v: 0.08, type: 'highpass', f: 5000, f2: 9000, wet: 0.9 });
  }
  function rattle() { if (!ac) return; for (let i = 0; i < 3; i++) noise({ dur: 0.04, v: 0.15, type: 'bandpass', f: 1200 + Math.random() * 800, q: 4, at: i * 0.06 }); }
  function boxOpen() { if (!ac) return; noise({ dur: 0.5, v: 0.2, type: 'lowpass', f: 300, f2: 6000, a: 0.2 }); tone({ f: 60, type: 'sine', dur: 0.4, v: 0.3 }); }
  function click() { if (!ac) return; tone({ f: 1100, f2: 700, type: 'triangle', dur: 0.05, v: 0.12, dest: uiBus }); noise({ dur: 0.02, v: 0.05, type: 'highpass', f: 5000, dest: uiBus }); }
  function hover() { if (!ac || !throttle('hover', 50)) return; tone({ f: 1600, type: 'sine', dur: 0.03, v: 0.025, dest: uiBus }); }
  function select() { if (!ac) return; tone({ f: 660, type: 'triangle', dur: 0.08, v: 0.08, dest: uiBus }); tone({ f: 990, type: 'triangle', dur: 0.1, v: 0.06, at: 0.04, dest: uiBus }); }
  function challenge() { if (!ac) return; [0, 4, 7, 12, 16].forEach((s, i) => tone({ f: mtof(72 + s), type: 'triangle', dur: 0.4, v: 0.07, at: i * 0.06, dest: uiBus, wet: 0.6 })); }
  function levelUp() { if (!ac) return; [0, 4, 7, 11, 12, 16].forEach((s, i) => tone({ f: mtof(67 + s), type: 'triangle', dur: 0.5, v: 0.08, at: i * 0.05, wet: 0.7 })); noise({ dur: 0.8, v: 0.05, type: 'highpass', f: 6000, f2: 10000, wet: 0.8 }); }
  function bossRoar(major) { if (!ac) return; tone({ f: major ? 55 : 70, f2: major ? 30 : 40, type: 'sawtooth', dur: 1.6, v: 0.18, a: 0.2, filter: { f: 500 }, wet: 0.8 }); noise({ dur: 1.4, v: 0.18, type: 'lowpass', f: 600, f2: 120, a: 0.2, wet: 0.6 }); if (major) tone({ f: 41, type: 'sine', dur: 2.5, v: 0.3, a: 0.4 }); }
  function bossBoom() { if (!ac || !throttle('bboom', 60)) return; tone({ f: 100, f2: 35, type: 'sine', dur: 0.35, v: 0.3 }); noise({ dur: 0.3, v: 0.15, type: 'lowpass', f: 1500, f2: 200 }); }
  function bossSfx(n) {
    if (!ac) return;
    if (n === 'ring') { tone({ f: 330, f2: 660, type: 'square', dur: 0.2, v: 0.05, filter: { f: 2000 } }); noise({ dur: 0.15, v: 0.08, type: 'bandpass', f: 1500 }); }
    if (n === 'aimed') tone({ f: 880, f2: 440, type: 'sawtooth', dur: 0.12, v: 0.05, filter: { f: 3000 } });
    if (n === 'tele') { tone({ f: 600, type: 'square', dur: 0.12, v: 0.04 }); tone({ f: 600, type: 'square', dur: 0.12, v: 0.04, at: 0.2 }); }
    if (n === 'charge') noise({ dur: 0.5, v: 0.2, type: 'bandpass', f: 300, f2: 1800, q: 1 });
    if (n === 'slam') bossBoom();
    if (n === 'summon') tone({ f: 110, f2: 220, type: 'sawtooth', dur: 0.6, v: 0.08, filter: { f: 900 }, wet: 0.7 });
  }
  function thunder() { if (!ac) return; noise({ dur: 2.4, v: 0.22, type: 'lowpass', f: 900, f2: 60, a: 0.02, dest: ambBus, wet: 0.5 }); noise({ dur: 0.15, v: 0.2, type: 'highpass', f: 2000, dest: ambBus }); }
  function death() { if (!ac) return; tone({ f: 220, f2: 55, type: 'sawtooth', dur: 1.6, v: 0.12, filter: { f: 800 }, wet: 0.8 }); noise({ dur: 1.2, v: 0.12, type: 'lowpass', f: 800, f2: 80 }); }

  // ---------- music ----------
  // Each track: tempo, root (midi), mode, 4-bar chord degrees, and which layers it uses.
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11],
  };
  const TRACKS = {
    menu:  { bpm: 70,  root: 50, scale: 'dorian',   prog: [0, 3, 5, 4], pad: 'triangle', padF: 1400, arp: [0, 2, 4, 2, 1, 2, 4, 6], arpType: 'sine', arpOct: 2, drums: 'none', bass: 'long' },
    crypt: { bpm: 84,  root: 50, scale: 'minor',    prog: [0, 5, 6, 4], pad: 'sawtooth', padF: 700,  arp: [0, 2, 4, 2, 0, 4, 2, 4], arpType: 'triangle', arpOct: 1, drums: 'war',   bass: 'pulse' },
    frost: { bpm: 76,  root: 52, scale: 'dorian',   prog: [0, 3, 4, 0], pad: 'sine',     padF: 2400, arp: [4, 2, 0, 2, 6, 4, 2, 4], arpType: 'sine', arpOct: 2, drums: 'soft',  bass: 'long' },
    storm: { bpm: 118, root: 45, scale: 'phrygian', prog: [0, 1, 0, 6], pad: 'sawtooth', padF: 1100, arp: [0, 0, 4, 0, 2, 0, 4, 1], arpType: 'square', arpOct: 1, drums: 'drive', bass: 'eighths' },
    marsh: { bpm: 92,  root: 48, scale: 'locrian',  prog: [0, 3, 1, 0], pad: 'triangle', padF: 900,  arp: [0, -1, 2, -1, 4, 2, -1, 1], arpType: 'triangle', arpOct: 1, drums: 'wood', bass: 'pulse' },
    boss:  { bpm: 132, root: 45, scale: 'harm',     prog: [0, 0, 5, 4], pad: 'sawtooth', padF: 1500, arp: [0, 2, 4, 7, 4, 2, 0, 4], arpType: 'square', arpOct: 1, drums: 'drive', bass: 'eighths' },
    major: { bpm: 140, root: 41, scale: 'phrygian', prog: [0, 1, 0, 5], pad: 'sawtooth', padF: 1800, arp: [0, 4, 7, 4, 1, 4, 7, 9], arpType: 'square', arpOct: 1, drums: 'drive', bass: 'eighths' },
    void:  { bpm: 66,  root: 54, scale: 'harm',     prog: [0, 6, 5, 3], pad: 'sawtooth', padF: 600,  arp: [6, -1, 4, -1, 2, -1, 0, -1], arpType: 'sine', arpOct: 2, drums: 'heart', bass: 'long' },
  };
  let cur = null, curGain = null, step = 0, nextT = 0, intensity = 0, wantTrack = null;

  function playTrack(name) {
    if (!ac) { wantTrack = name; return; }
    if (cur === name) return;
    if (curGain) { const g = curGain; g.gain.setTargetAtTime(0.0001, now(), 0.6); setTimeout(() => g.disconnect(), 4000); }
    cur = name; curGain = ac.createGain(); curGain.gain.setValueAtTime(0.0001, now()); curGain.gain.setTargetAtTime(1, now() + 0.1, 0.8);
    curGain.connect(musicBus);
    step = 0; nextT = now() + 0.1;
  }
  function setIntensity(v) { intensity = v; }
  // Duck + muffle: used when a wave is nearly over, in the forge, on death.
  function duck(level, muffleHz = 20000, time = 0.6) {
    if (!ac) return;
    musicDuck.gain.setTargetAtTime(level, now(), time / 3);
    musicFilter.frequency.setTargetAtTime(muffleHz, now(), time / 3);
  }

  function degree(tr, d, oct = 0) {
    if (d < 0) return null;
    const sc = SCALES[tr.scale]; const o = Math.floor(d / sc.length);
    return tr.root + sc[d % sc.length] + 12 * (o + oct);
  }
  function mnote(m, dur, type, v, t, filterF, wet = 0.3) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = type; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = filterF;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.3, dur * 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(curGain);
    if (wet) { const s = ac.createGain(); s.gain.value = wet; g.connect(s); s.connect(verbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(kind, t) {
    const out = curGain;
    const mk = (fn) => fn();
    if (kind === 'kick') mk(() => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35); });
    if (kind === 'tom') mk(() => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.25); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35); });
    const nz = (dur, v, type, f, q = 1) => { const s = ac.createBufferSource(); s.buffer = noiseBuf; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.02); };
    if (kind === 'snare') { nz(0.18, 0.18, 'bandpass', 1800, 0.8); }
    if (kind === 'hat') { nz(0.04, 0.07, 'highpass', 8000); }
    if (kind === 'shaker') { nz(0.06, 0.04, 'highpass', 6000); }
    if (kind === 'wood') { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = 800 + Math.random() * 300; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08); }
  }
  const DRUMS = {
    none: {},
    war:   { kick: [0, 8, 10], tom: [14], snare: [], hat: [] },
    soft:  { kick: [0], shaker: [4, 12], hat: [] },
    drive: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
    wood:  { kick: [0, 10], wood: [3, 6, 11, 14] },
    heart: { kick: [0, 3] },
  };

  function schedule() {
    if (!ac || !cur || ac.state !== 'running') return;
    const tr = TRACKS[cur], s16 = 60 / tr.bpm / 4;
    while (nextT < now() + 0.15) {
      const t = nextT, st = step % 16, bar = Math.floor(step / 16) % 4;
      const ch = tr.prog[bar];
      // L0: pad + bass (always)
      if (st === 0) {
        const dur = s16 * 16 * 1.05;
        [0, 2, 4].forEach(k => mnote(degree(tr, ch + k, 0), dur, tr.pad, 0.05, t, tr.padF, 0.6));
        if (tr.bass === 'long') mnote(degree(tr, ch, -1), dur, 'sine', 0.16, t, 400, 0);
      }
      if (tr.bass === 'pulse' && (st === 0 || st === 8)) mnote(degree(tr, ch, -1), s16 * 7, 'triangle', 0.16, t, 500, 0);
      if (tr.bass === 'eighths' && st % 2 === 0) mnote(degree(tr, ch, -1), s16 * 1.8, 'square', 0.07, t, 600, 0);
      // L1: arpeggio
      if (intensity >= 1 && st % 2 === 0) {
        const d = tr.arp[(st / 2) % tr.arp.length];
        if (d >= 0) mnote(degree(tr, ch + d, tr.arpOct), s16 * 3, tr.arpType, tr.arpType === 'square' ? 0.025 : 0.05, t, tr.arpType === 'square' ? 2400 : 5000, 0.4);
      }
      // L2: drums
      if (intensity >= 2) {
        const D = DRUMS[tr.drums] || {};
        for (const k in D) if (D[k].includes(st)) drum(k, t);
      }
      // L3: extra hats / octave lead
      if (intensity >= 3) {
        if (st % 2 === 1) drum('hat', t);
        if (st === 0 || st === 6 || st === 12) mnote(degree(tr, ch + 4, tr.arpOct + 1), s16 * 4, 'sine', 0.03, t, 6000, 0.6);
      }
      nextT += s16; step++;
    }
  }

  // ---------- ambience: continuous beds + random events per area ----------
  let ambGroup = null, ambId = null, ambNext = 0, wantAmb = null;
  function bed(g, { type = 'lowpass', f = 400, q = 0.7, v = 0.1, lfo = 0, lfoF = 0.08 }) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = ac.createGain(); gn.gain.value = v;
    s.connect(fl); fl.connect(gn); gn.connect(g);
    if (lfo) { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = lfoF; og.gain.value = lfo; o.connect(og); og.connect(fl.frequency); o.start(); }
    s.start(0, Math.random());
  }
  function drone(g, f, v, type = 'sine') { const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.value = f; gn.gain.value = v; o.connect(gn); gn.connect(g); o.start(); }
  function setAmbience(id) {
    if (!ac) { wantAmb = id; return; }
    if (id === ambId) return;
    if (ambGroup) { const g = ambGroup; g.gain.setTargetAtTime(0.0001, now(), 0.5); setTimeout(() => g.disconnect(), 3000); }
    ambId = id; ambGroup = null;
    if (!id) return;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, now()); g.gain.setTargetAtTime(1, now(), 1); g.connect(ambBus); ambGroup = g;
    if (id === 'crypt') { bed(g, { f: 140, v: 0.14 }); bed(g, { type: 'bandpass', f: 900, q: 0.5, v: 0.02 }); }
    if (id === 'frost') { bed(g, { type: 'bandpass', f: 700, q: 0.8, v: 0.07, lfo: 450, lfoF: 0.06 }); }
    if (id === 'storm') { bed(g, { type: 'bandpass', f: 1600, q: 0.4, v: 0.018 }); bed(g, { f: 260, v: 0.08 }); } // rain kept very soft: it used to be a loud hiss
    if (id === 'marsh') { bed(g, { f: 220, v: 0.08 }); const o = ac.createOscillator(), gg = ac.createGain(), am = ac.createOscillator(), amg = ac.createGain(); o.frequency.value = 4600; gg.gain.value = 0.004; am.frequency.value = 23; amg.gain.value = 0.004; am.connect(amg); amg.connect(gg.gain); o.connect(gg); gg.connect(g); o.start(); am.start(); }
    if (id === 'void') { drone(g, 55, 0.05); drone(g, 55.6, 0.05); drone(g, 82.4, 0.025, 'triangle'); bed(g, { type: 'bandpass', f: 400, q: 4, v: 0.04, lfo: 250, lfoF: 0.05 }); }
    ambNext = 0;
  }
  function ambTick() {
    if (!ac || !ambGroup || ac.state !== 'running') return;
    const t = now(); if (t < ambNext) return;
    const g = ambGroup, R = Math.random;
    switch (ambId) {
      case 'crypt': // crackling fire
        for (let i = 0; i < 1 + (R() * 3 | 0); i++) noise({ dur: 0.01 + R() * 0.03, v: 0.04 + R() * 0.08, type: 'highpass', f: 1500 + R() * 3000, at: R() * 0.1, dest: g });
        ambNext = t + 0.05 + R() * 0.35; break;
      case 'frost': // distant ice chimes
        if (R() < 0.5) [0, 1, 2].forEach(i => tone({ f: mtof(84 + [0, 3, 7, 10, 12][R() * 5 | 0]), type: 'sine', dur: 1.6, v: 0.025, at: i * 0.18, dest: g, wet: 0.9 }));
        ambNext = t + 3 + R() * 4; break;
      case 'storm': // gusts
        noise({ dur: 1.5 + R(), v: 0.025, type: 'bandpass', f: 400 + R() * 400, f2: 900 + R() * 600, q: 1.2, a: 0.6, dest: g });
        ambNext = t + 2 + R() * 3; break;
      case 'marsh': // bubbles + frogs
        if (R() < 0.7) tone({ f: 180 + R() * 120, f2: 500 + R() * 400, type: 'sine', dur: 0.08, v: 0.05, dest: g });
        if (R() < 0.12) { const f = 90 + R() * 40; for (let i = 0; i < 3; i++) tone({ f, f2: f * 0.8, type: 'square', dur: 0.09, v: 0.03, at: i * 0.11, dest: g, filter: { f: 600 } }); }
        ambNext = t + 0.25 + R() * 0.9; break;
      case 'void': // whispers
        noise({ dur: 1 + R() * 1.2, v: 0.05, type: 'bandpass', f: 800 + R() * 1500, f2: 400 + R() * 2000, q: 9, a: 0.4, dest: g, wet: 0.9 });
        ambNext = t + 2.5 + R() * 3.5; break;
      default: ambNext = t + 1;
    }
  }

  function unlock() { init(); if (wantTrack) { const w = wantTrack; wantTrack = null; playTrack(w); } if (wantAmb !== null) { const a = wantAmb; wantAmb = null; setAmbience(a); } }

  return { init: unlock, setVolumes, get vol() { return vol; }, cast, hit, kill, hurt, pickup, waveStart, waveClear, areaEnter, forge, reveal, rattle, boxOpen, click, hover, select, challenge, death, levelUp, bossRoar, bossBoom, bossSfx, thunder, setAmbience, playTrack, setIntensity, duck, get ready() { return !!ac; } };
})();
