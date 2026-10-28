// Wordforge — spell resolver.
// Local resolver: deterministic, offline, lexicon-driven (also the fallback).
// Oracle resolver: LLM via WF.CONFIG.apiUrl (see /server), clamped to designer bands.
window.WF = window.WF || {};
WF.CONFIG = WF.CONFIG || { apiUrl: '', timeoutMs: 5000 };

(function () {
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function traitsOf(word) {
    const w = word.toLowerCase();
    const e = WF.LEX[w];
    if (e) return { word: w, el: e[0], form: e[1], tags: e[2].slice(), p: e[3], known: true };
    // Unknown word (wild rune): derive stable traits from its hash.
    const h = WF.hash(w);
    return {
      word: w,
      el: WF.EL_LIST[h % WF.EL_LIST.length],
      form: ((h >>> 3) % 3 === 0) ? WF.FORMS[(h >>> 5) % WF.FORMS.length] : null,
      tags: [WF.TAGS[(h >>> 8) % WF.TAGS.length]],
      p: 1 + ((h >>> 11) % 2),
      known: false,
    };
  }

  WF.comboKey = (a, b) => [a.toLowerCase(), b.toLowerCase()].sort().join('+');

  WF.forgeLocal = function (a, b) {
    let [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
    let A = traitsOf(x), B = traitsOf(y);
    // The word that carries a form is the "noun"; the other is the modifier.
    if (A.form && !B.form) { [A, B] = [B, A]; }
    const h = WF.hash(x + '|' + y);
    const twin = A.word === B.word;

    const element = A.el;                    // modifier sets the element
    const secondary = B.el !== A.el ? B.el : null;
    const form = B.form || A.form || WF.ELEMENTS[element].form;

    const tags = [];
    const push = t => { if (t && !tags.includes(t) && tags.length < 2) tags.push(t); };
    A.tags.forEach(push); B.tags.forEach(push);
    if (secondary) push(WF.ELEMENTS[secondary].tag);
    push(WF.ELEMENTS[element].tag);

    let power = 3 + A.p + B.p + (secondary ? 0 : 1) + (h % 3) + (twin ? 1 : 0);
    power = Math.max(1, Math.min(10, power));
    const rate = 0.85 + ((h >>> 4) % 40) / 100;  // 0.85..1.24

    const formName = WF.FORM_INFO[form].names[(h >>> 7) % 3];
    const joined = (A.word + B.word).length <= 10 ? `${cap(A.word)}${B.word}` : `${cap(A.word)}-${cap(B.word)}`;
    const name = twin ? `Twin ${cap(A.word)} ${formName}` : `${joined} ${formName}`;

    const flavors = {
      bolt:   [`Throws ${B.word} at the problem until it stops moving.`, `A ${A.word}-tipped dart with opinions.`, `Aim is optional. ${cap(B.word)} finds a way.`],
      nova:   [`Everything nearby learns what ${A.word} feels like.`, `A ring of ${B.word}, expanding with bad intentions.`, `Personal space, enforced with ${A.word}.`],
      orbit:  [`${cap(B.word)} that refuses to leave your side.`, `Circles you like a loyal ${A.word}-storm.`, `Spin to win. The ${B.word} insists.`],
      beam:   [`A straight line of pure ${A.word}.`, `It doesn't miss. It just keeps going.`, `The ${B.word} stares back, and burns.`],
      zone:   [`The ground remembers the ${A.word}.`, `Stand here. Actually, don't.`, `A puddle of ${B.word} with a grudge.`],
      chain:  [`Jumps from foe to foe like gossip.`, `${cap(A.word)} that won't stop at one.`, `It goes through them. And the next one.`],
      summon: [`Small ${B.word}-things. Hungry ones.`, `They hunt so you don't have to.`, `You didn't make friends. You made ${B.word}.`],
      shield: [`A ${A.word} coat that bites back.`, `Come closer. Please.`, `${cap(B.word)} wrapped around you like armor.`],
    };
    const flavor = flavors[form][(h >>> 9) % 3];

    return { key: WF.comboKey(a, b), words: [x, y], name, element, secondary, form, tags, power, rate: +rate.toFixed(2), flavor, source: 'local' };
  };

  // Validate + clamp whatever the LLM returns so AI picks flavor & mechanics,
  // but numbers stay inside designer-set bands.
  WF.sanitize = function (raw, a, b) {
    const base = WF.forgeLocal(a, b);
    if (!raw || typeof raw !== 'object') return base;
    const s = Object.assign({}, base);
    if (typeof raw.name === 'string' && raw.name.length >= 3 && raw.name.length <= 32) s.name = raw.name.replace(/[^\w '\-]/g, '');
    if (WF.ELEMENTS[raw.element]) s.element = raw.element;
    s.secondary = WF.ELEMENTS[raw.secondary] && raw.secondary !== s.element ? raw.secondary : null;
    if (WF.FORMS.includes(raw.form)) s.form = raw.form;
    if (Array.isArray(raw.tags)) {
      const t = raw.tags.filter(x => WF.TAGS.includes(x)).slice(0, 2);
      if (t.length) s.tags = t;
    }
    if (Number.isFinite(raw.power)) s.power = Math.max(base.power - 2, Math.min(base.power + 2, Math.round(raw.power)), 1);
    s.power = Math.min(10, s.power);
    if (Number.isFinite(raw.rate)) s.rate = +Math.max(0.75, Math.min(1.35, raw.rate)).toFixed(2);
    if (typeof raw.flavor === 'string' && raw.flavor.length <= 120) s.flavor = raw.flavor;
    s.source = 'oracle';
    return s;
  };

  // Returns { spell, first: bool|null, discoverer?, forgedBy? }
  WF.forge = async function (a, b, playerName) {
    if (!WF.CONFIG.apiUrl) return { spell: WF.forgeLocal(a, b), first: null };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), WF.CONFIG.timeoutMs);
    try {
      const res = await fetch(WF.CONFIG.apiUrl.replace(/\/$/, '') + '/forge', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ a, b, player: playerName || 'anon' }), signal: ctrl.signal,
      });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      return { spell: WF.sanitize(data.spell, a, b), first: !!data.first, discoverer: data.discoverer || null, forgedBy: data.count || null };
    } catch (e) {
      console.warn('Oracle unavailable, using local resolver', e);
      return { spell: WF.forgeLocal(a, b), first: null };
    } finally { clearTimeout(t); }
  };

  WF.isValidWord = w => /^[a-z]{2,12}$/i.test(w || '');
})();
