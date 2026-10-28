// Wordforge — word lexicon + element/form data.
// Each entry: [element, form|null, tags[], powerBonus]
window.WF = window.WF || {};

WF.ELEMENTS = {
  fire:   { color: '#ff6a3d', name: 'Fire',   tag: 'burn',      form: 'bolt'   },
  ice:    { color: '#7fd8ff', name: 'Ice',    tag: 'slow',      form: 'zone'   },
  storm:  { color: '#ffe14d', name: 'Storm',  tag: 'knockback', form: 'chain'  },
  earth:  { color: '#d2a46c', name: 'Earth',  tag: 'knockback', form: 'nova'   },
  poison: { color: '#8dff5a', name: 'Poison', tag: 'poison',    form: 'zone'   },
  void:   { color: '#b07cff', name: 'Void',   tag: 'pierce',    form: 'orbit'  },
  light:  { color: '#fff3b0', name: 'Light',  tag: 'pierce',    form: 'beam'   },
  life:   { color: '#ff7fb0', name: 'Life',   tag: 'heal',      form: 'summon' },
  dark:   { color: '#e0466e', name: 'Dark',   tag: 'weaken',    form: 'bolt'   },
};
WF.EL_LIST = Object.keys(WF.ELEMENTS);
WF.FORMS = ['bolt', 'nova', 'orbit', 'beam', 'zone', 'chain', 'summon', 'shield'];
WF.TAGS = ['burn', 'freeze', 'slow', 'poison', 'knockback', 'pierce', 'split', 'heal', 'weaken'];

WF.FORM_INFO = {
  bolt:   { names: ['Bolt', 'Dart', 'Lance'],        desc: 'Fires at the nearest enemy' },
  nova:   { names: ['Nova', 'Burst', 'Bloom'],       desc: 'Explodes around you' },
  orbit:  { names: ['Halo', 'Wheel', 'Orbit'],       desc: 'Blades circle you' },
  beam:   { names: ['Ray', 'Beam', 'Gaze'],          desc: 'Piercing line of damage' },
  zone:   { names: ['Pool', 'Field', 'Mire'],        desc: 'Lingering area on the ground' },
  chain:  { names: ['Arc', 'Chain', 'Fork'],         desc: 'Jumps between enemies' },
  summon: { names: ['Swarm', 'Familiar', 'Brood'],   desc: 'Spawns allies that hunt' },
  shield: { names: ['Ward', 'Aegis', 'Mantle'],      desc: 'Damaging aura, less damage taken' },
};

WF.TAG_INFO = {
  burn: 'Burns over time', freeze: 'Freezes briefly', slow: 'Slows enemies',
  poison: 'Stacking poison', knockback: 'Knocks back', pierce: 'Pierces / +15% dmg',
  split: 'Kills burst into shards', heal: 'Heals you on kill', weaken: 'Weakens: +25% damage taken',
};

const L = (el, form, tags, p) => [el, form || null, tags || [], p || 0];
WF.LEX = {
  // fire
  fire: L('fire'), flame: L('fire'), ember: L('fire', null, [], 0), sun: L('fire', 'nova', [], 1),
  lava: L('fire', 'zone', [], 1), dragon: L('fire', 'summon', [], 2), candle: L('fire', 'bolt'),
  ash: L('fire', 'zone', ['slow']), phoenix: L('fire', 'summon', ['heal'], 2), forge: L('fire', 'nova', [], 1),
  // ice
  ice: L('ice'), frost: L('ice', null, ['freeze']), snow: L('ice', 'zone'), glacier: L('ice', 'nova', ['freeze'], 1),
  glass: L('ice', 'bolt', ['split']), winter: L('ice', 'zone', ['freeze'], 1), crystal: L('ice', 'orbit', ['pierce']),
  hail: L('ice', 'bolt', [], 0), mirror: L('light', 'shield', ['split'], 1),
  // storm
  storm: L('storm'), thunder: L('storm', 'nova'), lightning: L('storm', 'chain', [], 1), wind: L('storm', 'bolt', ['knockback']),
  spark: L('storm', 'chain'), cloud: L('storm', 'zone'), tornado: L('storm', 'orbit', ['knockback'], 1),
  feather: L('storm', 'bolt'), bird: L('storm', 'summon'), static: L('storm', 'shield'),
  // earth
  stone: L('earth'), rock: L('earth', 'bolt'), mountain: L('earth', 'nova', [], 2), iron: L('earth', 'shield', [], 1),
  sand: L('earth', 'zone', ['slow']), quake: L('earth', 'nova', ['knockback'], 1), golem: L('earth', 'summon', [], 1),
  root: L('earth', 'zone', ['slow']), wall: L('earth', 'shield'), boulder: L('earth', 'bolt', ['knockback'], 1),
  // poison
  venom: L('poison'), snake: L('poison', 'summon'), bee: L('poison', 'summon', ['split']), rot: L('poison', 'zone'),
  spore: L('poison', 'zone', ['split']), spider: L('poison', 'summon', ['slow']), thorn: L('poison', 'orbit', ['pierce']),
  acid: L('poison', 'bolt', ['pierce']), swamp: L('poison', 'zone', ['slow'], 1), plague: L('poison', 'nova', [], 1),
  // void
  void: L('void'), shadow: L('dark', 'bolt'), ghost: L('void', 'summon', ['pierce']), moon: L('void', 'orbit', [], 1),
  hole: L('void', 'zone', ['slow'], 1), night: L('dark', 'nova'), dream: L('void', 'orbit', ['slow']),
  echo: L('void', 'bolt', ['split']), clock: L('void', 'shield', ['slow'], 1), skull: L('dark', 'nova', [], 1),
  // light
  light: L('light'), star: L('light', 'bolt', ['split'], 1), eye: L('light', 'beam'), laser: L('light', 'beam', ['pierce'], 1),
  halo: L('light', 'orbit'), crown: L('light', 'shield', [], 2), prism: L('light', 'beam', ['split'], 1),
  angel: L('light', 'summon', ['heal'], 2), dawn: L('light', 'nova', ['heal']), gold: L('light', 'shield'),
  // dark
  raven: L('dark', 'summon'), curse: L('dark', null, ['weaken'], 1), grave: L('dark', 'zone', ['slow']), eclipse: L('dark', 'nova', ['weaken'], 2),
  reaper: L('dark', 'orbit', ['heal'], 2), fang: L('dark', 'bolt', ['heal']), wraith: L('dark', 'summon', ['pierce'], 1), blight: L('dark', 'zone', ['poison']),
  // life
  heart: L('life', null, ['heal']), seed: L('life', 'bolt', ['split']), tree: L('life', 'shield', ['heal'], 1),
  rain: L('life', 'zone', ['heal']), wolf: L('life', 'summon', [], 1), flower: L('life', 'nova', ['heal']),
  blood: L('life', 'bolt', ['heal']), ocean: L('life', 'nova', ['knockback'], 1), wave: L('life', 'nova', ['knockback']),
  cat: L('life', 'summon', ['split']),
  // forms / neutral-ish nouns (element comes from the other word)
  blade: L('earth', 'orbit', ['pierce']), sword: L('earth', 'orbit', ['pierce'], 1), arrow: L('light', 'bolt', ['pierce']),
  bomb: L('fire', 'nova', [], 1), bell: L('storm', 'nova', ['slow']), wheel: L('earth', 'orbit'), ring: L('void', 'orbit'),
  needle: L('ice', 'bolt', ['pierce']), whip: L('storm', 'chain'), spiral: L('void', 'orbit'), song: L('life', 'shield', ['slow']),
  rage: L('fire', 'nova', [], 1), hunger: L('dark', 'summon', ['heal']), fist: L('earth', 'nova', ['knockback']),
};

WF.RUNE_POOL = Object.keys(WF.LEX);

WF.hash = function (str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};
