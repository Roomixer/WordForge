// Wordforge Oracle — Cloudflare Worker.
// POST /forge {a, b, player} -> { spell, first, discoverer, count }
// - Every combo is resolved by the LLM exactly once, then cached forever in KV.
//   That makes the world shared (same words = same spell for everyone),
//   makes "world first discovery" possible, and keeps LLM cost bounded.
// - Output is schema-validated here AND clamped again on the client.

const ELEMENTS = ['fire', 'ice', 'storm', 'earth', 'poison', 'void', 'light', 'life', 'dark'];
const FORMS = ['bolt', 'nova', 'orbit', 'beam', 'zone', 'chain', 'summon', 'shield'];
const TAGS = ['burn', 'freeze', 'slow', 'poison', 'knockback', 'pierce', 'split', 'heal', 'weaken'];
// Same word filter the client uses (src/profanity.js), so a modified client can't bypass it.
let isClean;
{
const rot = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
// Matched anywhere inside the word (no common innocent words contain these).
const SUB = ['nffjvcr', 'nffung', 'qhzonff', 'wnpxnff', 'fznegnff', 'sngnff', 'shpx', 'fuvg', 'ovgpu', 'phag', 'avtt', 'avtn', 'snttb', 'juber', 'fyhg', 'chffl', 'qvpxurnq', 'zbgureshpx', 'nffubyr', 'onfgneq', 'jnaxre', 'gjng', 'cravf', 'intvan', 'cbea', 'qvyqb', 'ergneq', 'anmv', 'uvgyre', 'xlf', 'fcrez', 'betnfz', 'zbyrfg', 'crqb', 'vaprfg', 'grfgvpy', 'pyvg', 'obbof', 'unaqwbo', 'oybjwbo', 'wvmm', 'fyhgf', 'genaal', 'fcnfgvp'];
// Matched only as the whole word (they appear inside innocent words otherwise: "class", "grape", "scrap").
const EXACT = ['xxx', 'pbpx', 'pbpxf', 'encvfg', 'encvfgf', 'nff', 'nffrf', 'snt', 'sntf', 'gvg', 'gvgf', 'gvggl', 'qvpx', 'qvpxf', 'cevpx', 'encr', 'encrq', 'encvat', 'frk', 'frkl', 'fgq', 'pbba', 'fcvp', 'puvax', 'xvxr', 'jbt', 'uber', 'ubr', 'ubrf', 'phz', 'phzf', 'tbbx', 'qlxr', 'jnax', 'ohgg', 'nefr', 'obbo', 'xvyyzr', 'ahqr', 'ahqrf', 'anmvf', 'qbat', 'nany', 'nahf', 'cvff', 'penc'];
const sub = SUB.map(rot).filter(Boolean), exact = new Set(EXACT.map(rot));
// Undo common evasions: repeated letters ("fuuuck") collapse to one.
const squash = w => w.replace(/(.)\1+/g, '$1');
isClean = function (word) {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return false;
  for (const v of [w, squash(w)]) {
    if (exact.has(v)) return false;
    for (const s of sub) if (v.includes(s)) return false;
  }
  return true;
};
}

const SYSTEM = `You are the Oracle of Wordforge, a survivor-style action game.
The player combines two words into a spell. Design ONE spell that a player would agree "obviously" comes from those two words, but with a twist that makes it fun.
Return ONLY a JSON object with keys:
name (2-4 words, evocative, max 28 chars), element (one of ${ELEMENTS.join('|')}), secondary (one of those or null),
form (one of ${FORMS.join('|')}): bolt=fires at nearest enemy, nova=burst around player, orbit=blades circle player, beam=piercing line, zone=lingering ground area, chain=jumps between enemies, summon=allies that hunt, shield=damaging aura that reduces damage taken,
tags (1-2 of ${TAGS.join('|')}), power (integer 1-10; mundane words low, mythic/abstract words high),
rate (0.75-1.35; heavy things slow, light things fast), flavor (one witty sentence, max 90 chars, no quotes).
Rules: the form must follow the physical nature of the words (bee -> summon, wall -> shield, laser -> beam). Never invent new mechanics. Keep it PG.`;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' },
});

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return json({});
    const url = new URL(req.url);
    if (url.pathname !== '/forge' || req.method !== 'POST') return json({ error: 'not found' }, 404);

    let body; try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const a = String(body.a || '').toLowerCase(), b = String(body.b || '').toLowerCase();
    const player = String(body.player || 'anon').replace(/[^\w ]/g, '').slice(0, 16) || 'anon';
    if (!/^[a-z]{2,12}$/.test(a) || !/^[a-z]{2,12}$/.test(b)) return json({ error: 'invalid words' }, 400);
    if (!isClean(a) || !isClean(b)) return json({ error: 'rejected' }, 422);
    const key = 'combo:' + [a, b].sort().join('+');

    // Cache hit: someone already discovered this.
    const hit = await env.COMBOS.get(key, 'json');
    if (hit) {
      hit.count = (hit.count || 1) + 1;
      await env.COMBOS.put(key, JSON.stringify(hit));
      return json({ spell: hit.spell, first: false, discoverer: hit.discoverer, count: hit.count });
    }

    // Simple per-IP rate limit for fresh (uncached) LLM calls.
    const ip = req.headers.get('cf-connecting-ip') || 'x';
    const rlKey = 'rl:' + ip + ':' + new Date().toISOString().slice(0, 13);
    const used = parseInt(await env.COMBOS.get(rlKey) || '0', 10);
    if (used > 60) return json({ error: 'slow down' }, 429);
    await env.COMBOS.put(rlKey, String(used + 1), { expirationTtl: 3700 });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.MODEL || 'claude-haiku-5-5', max_tokens: 300, system: SYSTEM,
        messages: [{ role: 'user', content: `Words: "${a}" + "${b}"` }],
      }),
    });
    if (!res.ok) return json({ error: 'oracle failed' }, 502);
    const data = await res.json();
    const text = (data.content || []).map(c => c.text || '').join('');
    let spell;
    try { spell = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { return json({ error: 'oracle babbled' }, 502); }

    // Server-side validation (client clamps numbers again).
    if (!ELEMENTS.includes(spell.element) || !FORMS.includes(spell.form)) return json({ error: 'invalid spell' }, 502);
    spell.tags = (spell.tags || []).filter(t => TAGS.includes(t)).slice(0, 2);
    spell.power = Math.max(1, Math.min(10, Math.round(+spell.power || 5)));
    spell.rate = Math.max(0.75, Math.min(1.35, +spell.rate || 1));
    spell.name = String(spell.name || '').slice(0, 32);
    spell.flavor = String(spell.flavor || '').slice(0, 120);
    if (!(spell.name + ' ' + spell.flavor).split(/[^a-z]+/i).every(t => !t || isClean(t))) return json({ error: 'rejected' }, 422);

    // Write-if-absent (best effort; KV is eventually consistent — use a Durable Object for strict firsts).
    await env.COMBOS.put(key, JSON.stringify({ spell, discoverer: player, at: Date.now(), count: 1 }));
    return json({ spell, first: true, discoverer: player, count: 1 });
  },
};
