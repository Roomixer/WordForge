# Wordforge

A survivor-like where your spells are made of words. Kill the horde, collect word-runes, and forge any two into a brand-new spell. *Storm + Glass* gives you shards that chain. *Bee + Moon* gives you a swarm of void familiars. Every discovery goes into your permanent grimoire.

**Play:** open `index.html` in a browser. There's no build step and no install. Desktop uses WASD or arrow keys; mobile uses drag-to-move.

## Systems
- **Areas:** the map changes every 3 waves. There are 5 areas: Ember Crypt, Frozen Archive, Storm Spire, Rot Marsh and Void Rift. Each has its own floor, weather, enemy skins and music.
- **Points:** you earn points from kills (1/1/5/30 by enemy type), wave clears (10 × wave) and daily challenges.
- **Rune Cache:** a mystery box for player skins, costing 200 points. The six tiers are common, uncommon, rare, epic (distinct designs), legendary (glowing) and mythic (animated). Drop rates are shown in-game, and duplicates refund points. Caches are earned only through play.
- **Audio:** fully synthesized with WebAudio, so there are no files to load.
  - Every element has its own cast sound.
  - Each area has its own music, with layers that build as a wave goes on.
  - Music ducks and muffles as a wave ends and in the forge.
  - UI clicks, plus Master/Music/Effects sliders.
- **Maps:** the world is infinite, generated in 16×16-cell chunks with open streets that keep it connected. Each area generates walls in that area's style: ruins, archive shelves, a pillared plaza, marsh rocks or void shards. A BFS flow field lets enemies route around walls. There's a minimap with markers for elites and bosses.
- **Treasure rooms:** some chunks hold walled rooms with a chest (points), a rune cache or a shrine (XP and heal).
- **Boss arenas:** on boss waves an arena is stamped 2–3 screens away. A red arrow and a minimap marker guide you there, and the fight starts when you step inside.
- **Shooters:** spitter enemies (from wave 3) keep their distance and lob telegraphed shots. Their numbers are capped so it never gets overwhelming.
- **Bosses:** nine minor bosses rotate on waves 6, 11 and 16. Major bosses come on wave 20 and every 20 waves after: The Unwriter, then The Silence, alternating. Boss HP is 2.2× the original tuning. Bosses use telegraphed patterns: rings, spirals, aimed spreads, charges, strike zones, puddles and summons.
- **Levels:** XP comes from kills. Each level offers a pick of 1 of 3 upgrades (Vitality, Might, Haste, Multicast, Reach, and more). Permanent Character ranks are bought with points, and account levels pay out points.
- **Spells:** rarity is derived from power and uses the same six tiers and colors as skins. Element, form and effect symbols are drawn from one SVG/Path2D icon set. The Dark element adds a Weaken effect. Grimoire spells can be upgraded up to level 5 (+1 power each).
- **Word filter:** wild runes reject profanity, slurs and sexual terms. The same filter runs on the client and the Oracle server.
- **Developer tools:** press `, or turn them on in Sound settings. They include god mode, a speed toggle, jump-to-wave, spawn boss, unlock skins, points and a save reset.
- **Rarities:** Common → Uncommon → Rare → Epic → Legendary → Mythic, plus Light and Dark (the rarest cache drops) and Ultra Mythic (milestone rewards only). There are 47 player skins and 15 grimoire skins, which restyle the book bar and the grimoire.
- **Rune Cache:** open 1, 5 (5% off) or 10 (10% off) at once, with a results grid.
- **Milestones:** lifetime goals: kills up to 100,000, spells forged up to 1,000, distance up to 100 km, wave 30 in under 25 minutes, bosses, caches. They pay points and exclusive skins, including four Ultra Mythics.
- **Daily challenges:** three per day, the same for everyone, with point rewards.

## Structure
```
index.html          UI shell and styles
src/lexicon.js      ~110 runes → element / form / tags
src/resolver.js     local deterministic resolver + Oracle (LLM) client + balance clamps
src/meta.js         daily curses, save data, streak, grimoire
src/biomes.js       areas: floors, weather, enemy skins, music ids
src/skins.js        player skins, rarity table, skin renderer
src/challenges.js   daily challenges
src/audio.js        synthesized SFX, procedural music, area ambience
src/map.js          map generation, collision, flow field, walls, minimap
src/bosses.js       boss defs + attack patterns
src/milestones.js   lifetime stats + milestone rewards
src/progression.js  level-up cards, permanent perks, account level
src/icons.js        symbol set + spell rarity tiers
src/profanity.js    wild-rune word filter
src/config.js       set apiUrl to enable LLM forging
src/game.js         core loop, combat, forge UI
server/worker.js    Oracle: Cloudflare Worker → Claude, KV cache, world-first discoveries
```

## AI in the game (the Oracle)
- The LLM designs each **new** word combo once. The result is cached globally, so the same pair always gives the same spell for every player. That cache is what makes "World First Discovery" possible, and it bounds cost to one call per unique pair.
- The AI picks the **mechanics** (form, tags, element) and the **flavor** (name, line). The **numbers** stay inside designer-set bands: they're clamped server-side and again on the client to ±2 power of the local baseline.
- If the Oracle is off or slow (5s timeout), the local lexicon resolver takes over, so the game never blocks.

### Enable it
```bash
cd server
npx wrangler kv namespace create COMBOS     # paste id into wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```
Then set `WF.CONFIG.apiUrl` in `src/config.js` to the worker URL.

## Deploy the web build
GitHub Pages: push the repo, then go to Settings → Pages → deploy from `main` / root.
