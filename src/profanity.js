// Wordforge — wild-rune word filter. Wild runes let players type any word, so slurs,
// profanity and sexual terms are rejected before they reach the resolver or the Oracle.
// Lists are ROT13'd so the source stays readable; they're decoded once at load.
window.WF = window.WF || {};
(function () {
  const rot = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
  // Matched anywhere inside the word (no common innocent words contain these).
  const SUB = ['nffjvcr', 'nffung', 'qhzonff', 'wnpxnff', 'fznegnff', 'sngnff', 'shpx', 'fuvg', 'ovgpu', 'phag', 'avtt', 'avtn', 'snttb', 'juber', 'fyhg', 'chffl', 'qvpxurnq', 'zbgureshpx', 'nffubyr', 'onfgneq', 'jnaxre', 'gjng', 'cravf', 'intvan', 'cbea', 'qvyqb', 'ergneq', 'anmv', 'uvgyre', 'xlf', 'fcrez', 'betnfz', 'zbyrfg', 'crqb', 'vaprfg', 'grfgvpy', 'pyvg', 'obbof', 'unaqwbo', 'oybjwbo', 'wvmm', 'fyhgf', 'genaal', 'fcnfgvp'];
  // Matched only as the whole word (they appear inside innocent words otherwise: "class", "grape", "scrap").
  const EXACT = ['xxx', 'pbpx', 'pbpxf', 'encvfg', 'encvfgf', 'nff', 'nffrf', 'snt', 'sntf', 'gvg', 'gvgf', 'gvggl', 'qvpx', 'qvpxf', 'cevpx', 'encr', 'encrq', 'encvat', 'frk', 'frkl', 'fgq', 'pbba', 'fcvp', 'puvax', 'xvxr', 'jbt', 'uber', 'ubr', 'ubrf', 'phz', 'phzf', 'tbbx', 'qlxr', 'jnax', 'ohgg', 'nefr', 'obbo', 'xvyyzr', 'ahqr', 'ahqrf', 'anmvf', 'qbat', 'nany', 'nahf', 'cvff', 'penc'];
  const sub = SUB.map(rot).filter(Boolean), exact = new Set(EXACT.map(rot));
  // Undo common evasions: repeated letters ("fuuuck") collapse to one.
  const squash = w => w.replace(/(.)\1+/g, '$1');
  WF.isClean = function (word) {
    const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return false;
    for (const v of [w, squash(w)]) {
      if (exact.has(v)) return false;
      for (const s of sub) if (v.includes(s)) return false;
    }
    return true;
  };
})();
