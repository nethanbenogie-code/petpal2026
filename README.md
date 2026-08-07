# PetPal 🐣

A Tamagotchi-style virtual pet that lives in your browser. It grows, gets hungry,
wanders around on its own, learns words from your chat, and remembers things for
you. No accounts, no server, no tracking — everything stays in your browser's
local storage.

No build step and no npm install — the only dependency is three.js, vendored in
`vendor/` so the app still works with no network at all.

---

## Features

**The pet**
- Five life stages — Egg → Baby → Kid → Teen → Adult — reached by real elapsed time
- **Levels 1–100** earned by playing, with combat stats that grow alongside —
  see [Levels](#levels)
- **Turn-based battles** against 32 monsters and bosses, all modelled in 3D —
  see [Battles](#battles)
- **Equippable weapons** with signature battle skills, including two ranged
  ones — see [Weapons](#weapons)
- Six needs that drain continuously: Full, Hydration, Clean, Rest, Fun, Health.
  Rest (`energy`) drains at half its original rate — a full bar now lasts
  ~67 minutes awake, ~33 at night, twice the original pace
- Moods driven by those stats, with matching faces and animations
- Personality traits (playful, affectionate, talkative, curious, independent) that
  shift based on how you treat it
- Walks, runs, hops and wanders the screen by itself; drag it anywhere, tap to pet it
- Travels between locations — walks off one side of the screen and arrives from the other
- **3D pet** rendered with three.js — turns to face where it's walking, swings its
  limbs in depth, and squints, pouts or sleeps with its mood. Toggle it in
  **⚙ Menu → 🧊 3D pet**; the original SVG pet is still there and is used
  automatically wherever WebGL isn't available

**Care & play**
- Feed, water, bathe, play, heal, sleep
- 17 locations, each with its own backdrop and scenery
- Shop for food, hats, glasses, scarves and animal playmates that follow the pet
- Weather system: clear, cloudy, rain, snow, storm, fog
- Automatic day/night cycle tied to your real clock
- Teach it tricks with your own command words
- Achievements, daily login streaks, coins

**Chat**
- Talk to it and it learns your vocabulary, then works your words into its own chatter
- Optional speech synthesis (it talks back) and voice input (speech recognition)
- Save and recall contacts by chatting — see [Contacts by chat](#contacts-by-chat)
- Schedule events and get reminded by chatting — see [Calendar by chat](#calendar-by-chat)
- Do arithmetic by chatting, in digits, words, or a mix — see [Calculator by chat](#calculator-by-chat)

**Extras**
- Journal with notes, appointments, contacts and diary entries
- Camera that snapshots the pet and its scene into a gallery
- Built-in arcade: Tetris, Galactica and Snake, all played with one shared
  on-screen joystick — see [Arcade controls](#arcade-controls)
- Installable as a PWA and fully playable offline
- Backup and restore the whole save as a file — see [Your data](#your-data)
- Inspirational quotes, filtered to keep out politics and anything
  rebellion-adjacent — see [Inspirational quotes](#inspirational-quotes)

---

## Running it

It must be served over HTTP. The app is built from ES modules, and browsers
block those on `file://` — double-clicking `index.html` will load the page shell
and nothing else. Service workers don't register on `file://` either, so this is
also what the PWA install and offline caching need.

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. Any static host works — GitHub Pages, Netlify,
a Raspberry Pi on your LAN.

Designed portrait-first for phones; the layout adapts down to 375px wide.

---

## Contacts by chat

The pet can hold onto a name, number and address, and give them back later. These
go into the same store as **Journal → 📇 Contacts**, so you can browse and delete
them there too.

**Saving**

```
remember Ana's number is 0917 123 4567
Ana's address is 12 Mabini St, Cebu City
remember my mom's number is 09998887777
remember the address of Ben is 99 New Street
my number is 0905 111 2222
save contact: Ben Cruz | ben@mail.com | 0922 555 1212 | 7 Bonifacio Rd
```

The leading verb (`remember` / `save` / `note` / `store` / `keep`) is optional
except in the last form. Field words are flexible — *number, phone, mobile, cell,
cp, contact number, tel, address, addy, location, email, notes*. Anything phrased
with **my** is filed under a contact called "Me". In `save contact:` the pieces are
identified by what they look like, so order doesn't matter.

**Reading back**

```
what is Ana's number
Ana's address?
what's the number of Ana
what's my address
who is Ana
list contacts
forget Ana
```

Unknown names get *"I don't know anyone called Carlo yet"*; a known person missing
that field gets *"I know Ana, but I don't have their address."* It never invents a
value.

Contact text deliberately **skips the vocabulary learner**. Ordinary chat feeds
`state.vocab`, and the pet blurts learned words out at random — without this, a
phone number told twice could end up in its idle chatter.

---

## Calendar by chat

Schedule an event and the pet reminds you when it's due, even if the app was
closed right through the moment — you get a "you missed" catch-up ping the
next time it's open, once, ever. Reuses `state.appointments`, the same store
**Journal → 📅 Appts** reads, so anything scheduled by chat shows up
there too, and anything added through that form gets a reminder if it has a
time.

**Creating**

```
remind me to walk the dog tomorrow at 6pm
remind me about the dentist on friday at 3pm
remember to buy milk today
schedule team sync on 8/5 at 14:30
book a haircut for aug 10
don't let me forget mom's birthday on september 3
add event: Concert | 2026-12-24 | 8pm | Arena
remind me to call grandma in 3 days
```

Dates understood: today/tomorrow, weekday names (with "this" or "next"),
month-day ("aug 10", "10 august"), numeric (`8/5`, `2026-08-05`), and relative
("in 3 days", "in a week"). Times: `6pm`, `3:30pm`, `14:30`, noon, midnight.

Creation is gated behind **both** a recognisable opener (remind me to/about,
remember to/that, schedule, book, don't let me forget, or the explicit
`add event:` form) **and** a date the parser can actually resolve — a bare
hour with no am/pm ("at 9") is genuinely ambiguous and is left unresolved
rather than guessed, and the event is still created from the date alone.

Two openers that felt natural at first — bare "i have ..." and "there's ..."
— were cut before shipping: "i have a headache today" and "there's a bug in
the shooter today" both start with those words and both contain "today",
and would have silently become calendar entries. Verified with a battery of
20 phrasings, split evenly between things that must create an event, things
with a trigger but no date (must reply but create nothing), and ordinary
sentences with no trigger at all (must be completely silent) — all 20 landed
correctly.

**Reading back and cancelling**

```
what's on my calendar
what do i have tomorrow
next appointment
cancel team sync
```

`cancel`/`delete`/`remove` reply only when something actually matches —
unlike contacts' `forget`, these are common words in ordinary chat, so a
miss stays silent instead of announcing "I don't have anything called that"
to a sentence that was never about the calendar.

**Reminders** fire once per appointment, checked every second: exactly on
time if the app is open, or as a "you missed" catch-up the moment it's
reopened if it wasn't. Only appointments with a time ping — a date alone is a
day marker, not an alarm. If **⚙ Menu → 🔔 Notifications** is on, a real
system notification fires too, so it reaches you even in another tab.

## Calculator by chat

```
1+1
one + 1
1 plus 1
one plus one
1 plus one
five minus two
4 times 3          seven times eight
10 / 2             ten divided by 2          9 over 3
what is 5 + 5      calculate 12 times 12
one hundred and twenty three plus 1
```

Understands `+ - * x × / ÷` and their word forms (plus, minus, times,
divided by, over, multiplied by, subtracted by, added to), number words up
to millions ("one hundred and twenty three"), decimals, and an optional
leading "what is" / "calculate" / "how much is". Dividing by zero gets a
reply instead of `Infinity`; `0.1 + 0.2` correctly shows `0.3`, not floating-
point noise.

The whole trimmed message has to be exactly `number operator number` — a
number or operator word inside a longer sentence never triggers it, so
"I have 2 dogs and 1 cat" stays a sentence, not `2 + 1`.

The trickiest part was the hyphen: it's both the joiner in "twenty-one" and
the minus sign in "5-3", and a tight `number-number` also matches a phone
number. Hyphens are only treated as a word-joiner when they sit between an
actual tens-word and ones-word (built straight from that vocabulary, so a
digit can never trigger it); a *tight, unspaced* hyphen-minus is refused
outright when either side is 1000 or more, which blocks `555-1234` and
`2024-08-07` while still allowing `100-50`. Verified against 11 realistic
false-positive phrasings — phone numbers, dates, page ranges, "she is 25
years old", "the score was 2-1" — all correctly ignored.

Calculator text skips the vocabulary learner, same as contacts and calendar
text — "plus" becoming something the pet says back at random would be odd.

## Levels

Two progressions run side by side and they are **not** the same thing:

- **Stage** (Egg → Baby → Kid → Teen → Adult) is *age* — pure elapsed real time.
  A neglected pet still becomes an Adult.
- **Level** (1 → 100) is *experience* — earned only by doing things.

XP comes from care actions, chatting, tricks, photos, exploring new locations,
hunting and achievements. Each level pays out `10 + level × 5` coins, so late
levels stay worth reaching. Progress shows as a bar under the top bar and a
`Lv n` badge by the pet's name; **⚙ Menu → 📊 Level & stats** has the details.

The curve is `5n² + 10n` cumulative — level 2 at 15 XP, level 10 at 495, level
50 at 12,495, level 100 at 49,995. Deliberately fast at the start so the bar
visibly moves on day one, and a couple of months of steady play to cap out.

Only the XP **total** is stored. Level, progress and every combat stat are
derived from it at read time, so the curve can be retuned later without
migrating or corrupting a single save.

Combat stats (Max HP, Attack, Defence, Speed) rise with level and are nudged by
personality — Attack follows *playful*, Defence *affectionate*, Speed *curious*,
Max HP *independent*. Nothing consumes them yet; they're the foundation for
battles.

## Battles

Fights happen **on the pet's own stage**, so the location backdrop, weather and
decor stay visible behind them — your actual pet model facing an actual monster
model, in the park, in the rain, in space.

**Starting a fight**
- **⚔️ Hunt** — seek out a monster themed to wherever you are, on demand.
  Pays **70% of the usual XP**, win or lose — it's the reliable button-press
  option, so it's deliberately worth less than the next one
- **Random encounters** while exploring away from home (roughly one per couple
  of minutes outdoors, never twice within three minutes) — full XP, since
  these are rarer and unplanned
- **⚙ Menu → ★ Zone boss** — one boss per zone; first clear pays double
- **⚙ Menu → 🗓 Daily challenge** — one escalating fight a day, the same monster
  for everyone on a given date

**Fighting** — Attack, plus a skill for every trick your pet knows. Spin and
Slam hit hard, Lullaby heals, Brace raises defence, Taunt weakens the enemy,
Dazzle blunts its next hit, Focus loads the next strike. Food from your
inventory heals mid-fight. Bosses can't be fled.

**24 monsters and 8 bosses**, none of them sprites — each is a list of
primitive shapes assembled at runtime, same as the pet. Adding one is a data
edit, not an art job.

Monsters are scaled to **your** level, not grown from fixed numbers, so a fight
means the same thing at level 5 and level 95. Measured across levels 1→100:
tier 1 wins ~100% of the time leaving ~69% HP in about 5 turns; tiers 2 and 3
are real fights ending near 28% HP; bosses sit around 30% and run 15+ turns. A
pet that has learned no tricks wins only ~12% against tier 2 — training is
supposed to matter.

Losing costs nothing but pride and pays a quarter of the XP (also cut to 70%
for Hunt). Fleeing pays nothing.

## Weapons

Eight weapons in **🛍 Shop → 🗡 Arms**, each with a signature battle skill that
exists only while it is equipped — Slash, Rend, Guard Break, Quake, Zap, Beam,
Starfall. Two carry mechanics nothing else has: **⚡ Zap** has a 50% chance to
stun, costing the monster its whole turn, and **🔆 Beam** ignores armour
completely — measured at 2.79x damage against the most armoured monster in the
game versus 1.78x against the softest.

Zap and Beam are the two **ranged** weapons — real geometry fired across the
arena instead of a melee lunge. Zap forks three jittered lightning strands at
the monster and flashes on impact; Beam swings a solid cylinder onto the line
of fire with a muzzle flare and an impact burst. Effects are timed meshes
added straight to the battle scene and torn down on their own clock, so a
fight that ends mid-flash cleans up with it — verified with nothing left
behind even when the battle is closed abruptly while a bolt is still in the
air. They are built from primitives like everything else and are held in the
pet's hand in the arena.

Bonuses are **percentages of the pet's own stats, never flat numbers**. Flat
values were tried first and broke exactly as the monsters did before they were
re-anchored: +18 attack is enormous beside a level-25 pet's 43 and trivial
beside a level-100 pet's 155, so the same Warhammer measured 82% against a boss
at L25 and 62% at L60. Percentages make one balance pass hold at every level.

Measured win rates, flat from level 10 to 100:

| | tier 1 | tier 2 | tier 3 | boss |
| --- | --- | --- | --- | --- |
| bare hands | 100% | 80% | 45% | 7% |
| Wooden Sword | 100% | 97% | 86% | 15% |
| Iron Claws | 100% | 99% | 100% | 18% |
| Warhammer | 100% | 100% | 100% | 50% |
| Zap Rod | 100% | 99% | 97% | 27% |
| Laser Blaster | 100% | 100% | 100% | 64% |
| Star Blade | 100% | 100% | 100% | 81% |

(Table is for regular monster tiers and bosses at full ambient/random XP —
the win-rate mechanics are identical when fighting via Hunt, only the XP
payout differs.)

## Arcade controls

Tetris, Galactica and Snake share one round joystick — drag the knob or tap
the glowing chevrons, both work. Tetris also fires on a **centre tap** for a
hard drop, so the whole game plays from one control. `js/joystick.js` is a
small reusable widget (Pointer Events, so a drag survives your thumb sliding
off the knob) that any future game in the arcade can reuse.

## Inspirational quotes

**⚙ Menu → 💭 Inspiration** shows a quote, with an "Another" button to cycle
and a "Say it" button that has the pet speak it aloud (if voice is on). 18
quotes are bundled into the app itself, so this works from first launch with
zero network calls — **🔄 Get more quotes** is the one and only place in the
whole app that reaches out to the internet, and only when you tap it.

It pulls a public, MIT-licensed [quotes dataset](https://github.com/dwyl/quotes)
from `raw.githubusercontent.com` — chosen after checking two more
"official-sounding" quote APIs first and finding neither actually usable:
`api.quotable.io` no longer resolves at all, and `zenquotes.io` sends no
`Access-Control-Allow-Origin` header, so a browser `fetch()` from this app
would be silently blocked by CORS even though the API itself is up. GitHub's
raw file host sends permissive CORS unconditionally, confirmed before writing
any code against it.

Every quote — bundled or fetched — passes through the same two-layer filter
before it can ever be shown or cached:

- an **author blocklist** (Trump, Obama, Gandhi, MLK, Churchill, Thomas
  Paine, Napoleon, and around two dozen more historical and political
  figures) — because a quote's political charge often comes from *who* said
  it, not the specific words. "Freedom is what you do with what's been done
  to you" reads as completely generic, but it's Jean-Paul Sartre; "The most
  formidable weapon against errors of every kind is reason" is Thomas
  Paine — both pass on text alone and are only caught because the author is
  checked as its own, independent signal
- a **word-boundary keyword filter** over the quote text for politics/war/
  rebellion vocabulary (government, revolution, uprising, regime, protest,
  army, weapon, tyranny, and similar)

Verified against the real, live 1,655-quote dataset before shipping, not
just reasoned about: a first-draft version of the keyword filter matched
substrings rather than words, so "king" fired inside "thinking" and "nation"
fired inside "imagination" — fixed with proper `\b` word boundaries.
1,523 of 1,655 quotes (92%) pass; every quote by a blocklisted author is
correctly rejected even on lines with no flagged words at all, and the
control quotes used to check for over-filtering came through clean.

Fetched quotes are capped at 250 cached (oldest dropped first) to keep
`localStorage` bounded, deduplicated against what's already saved, and nothing
that fails the filter is ever written to state — the filtering happens once,
at fetch time, on the raw response.

## Locations

Reached from **⚙ Menu → 📍 Locations**. Park also has its own button in the action bar.

| Place | Unlocks at |
| --- | --- |
| 🏠 Home · 🌳 Park · 🛁 Bath · 🏥 Hospital | available from the start |
| 🏫 School | more than 10 chat messages |
| 🏖 Beach | pet older than 5 hours |
| 🛍 Mall | 60+ coins earned (lifetime) |
| 🔬 Lab | 3+ successful tricks performed |
| 🌲 Forest | pet older than 12 hours |
| 🏙 City | more than 30 chat messages |
| ⛰ Mountain | 100+ coins earned |
| 🚀 Space | more than 5 creatures caught in Hunt |
| ❄️ Snow | more than 3 photos taken |
| 🌧 Rain | more than 2 playmates owned |

🌅 Dusk, 🌄 Dawn and 🌙 Night appear automatically with the day/night cycle and
while the pet sleeps.

---

## Your data

Everything lives in `localStorage` under the key `petpal.v4`, on your device only.
Nothing is ever uploaded. The app makes **one** kind of outbound network request,
and only when you explicitly trigger it: tapping **🔄 Get more quotes** in
[Inspirational quotes](#inspirational-quotes) fetches a public quotes file from
GitHub. Every other asset, three.js included, is served from this folder, and
nothing else in the app ever calls out to the network.

Worth knowing: once you start saving contacts, that key holds real personal
information in plain text. It rides along in any browser profile backup, and
clearing site data for the page erases the pet along with it. **⚙ Menu → 🗑 Reset
pet** wipes it deliberately.

If voice is enabled, retrieved phone numbers are read aloud by speech synthesis.

**⚙ Menu → 💾 Backup data** downloads the entire save as a `.json` file —
everything: stats, level, XP, coins, contacts, appointments, tricks, gear,
photos, journal. **⚙ Menu → 📂 Restore backup** loads one back, after showing
which pet is in the file (name, XP, coins, when it was backed up) and an
explicit confirm, since it replaces whatever is currently loaded. A file that
isn't valid JSON, or is valid but clearly isn't a PetPal save, is rejected
with a plain message rather than silently doing something with it.

Restore goes through the exact same `localStorage` write + full page reload
that **Reset pet** already used, rather than patching the running `state`
object in place — a reload re-runs every module's own setup from scratch, so
there's nothing left over from the pet you had a moment ago (cached redraw
signatures, the wander loop's target, the 3D model) still assuming the old
one's shape.

---

## Project layout

```
index.html        markup + CSS; loads js/main.js as a module
js/
  state.js        constants, the save file, shared helpers
  ui.js           toast, chat log, bubble, sound, voice in/out
  economy.js      coins, achievements, daily streak
  scene.js        weather, the pet's SVG artwork, location backdrops
  petmove.js      wander/run/hop loop, travel, dragging, playmates
  media.js        camera and gallery, Hunt
  actions.js      feed, water, bath, play, park, pet, heal, sleep
  chat.js         messages, vocabulary, replies, contacts-by-chat
  calendar.js     events/reminders by chat, and the notifications that fire
  calc.js         the chat calculator — digits, number-words, mixed forms
  backup.js       export the save to a file, and restore from one
  quotes.js       bundled + fetched inspirational quotes, and the content filter
  tricks.js       teaching and performing tricks
  shop.js         food, accessories, playmates, weapons
  minigames.js    Catch, arcade launcher
  journal.js      notifications, modals, notes/appts/contacts/diary
  shooter.js      in-app Twin-Bee style shooter
  joystick.js     reusable round D-pad widget, used by games.html
  menu.js         settings menu
  pet3d.js        three.js pet model, animation and face
  rpg.js          XP curve, levels 1–100, derived combat stats
  monsters.js     bestiary + the primitive-part recipe for each 3D model
  weapons.js      equippable weapons, their skills and 3D models
  battleui.js     the in-stage 3D arena and battle HUD
  battle.js       turn-based combat engine (pure logic, no DOM)
  encounters.js   how fights start, and how rewards get home
  main.js         UI refresh, one-second tick, bindings, boot
vendor/
  three.module.js three.js r185 (ESM entry, re-exports the core)
  three.core.js   its sibling — three.module.js is useless without it
battle.html       standalone battle screen, its own window — superseded by
                  in-stage battles (battleui.js) but still works if opened
                  directly; kept for compatibility, precached, no live link
                  to it from the main UI
games.html        standalone arcade (Tetris, Galactica, Snake)
sw.js             service worker, cache-first for offline play
manifest.json     PWA manifest
icon.svg          source icon
icon-192.png      PWA icons
icon-512.png
```

The pet itself is drawn as inline SVG generated in JavaScript, so it recolours and
changes shape per life stage and mood without any image assets.

The working folder also contains `files.zip` and a `New folder/` holding an older
copy of the app. Neither is used at runtime — delete them or add them to
`.gitignore` before publishing.

---

## Development notes

There's no toolchain, so a few things are easy to get wrong:

- **Never read another module's bindings at import time.** `state.js` sits at
  the root of the graph but imports `actions.js`, which imports `main.js`, which
  imports `state.js` — a cycle. Cycles are fine in ES modules *provided* no
  module touches another's exports while it is still evaluating. Two top-level
  `console.log`s reading `state` broke `battle.html` with "Cannot access 'state'
  before initialization" and a blank page, because that entry point evaluates
  the cycle in a different order than `index.html` does. Function bodies are
  safe; module top level is not.
- **Anything imported by `battle.html` must tolerate a page without the app
  shell.** `main.js` gates all its wiring and boot on `IS_APP_SHELL`, and
  `journal.js` null-checks its modal handlers, for exactly this reason. A module
  that throws during evaluation logs nothing of its own — the page just renders
  empty.
- **Bump `CACHE` in `sw.js` whenever you add or rename a file.** Fetches are
  cache-first and `activate` only clears caches with a *different* name, so
  forgetting this pins the old build on every existing install — they'll never
  fetch your new files at all.
- **Only what `main.js` puts on `window` is reachable from inline HTML handlers.**
  Module scope isn't global. If you add an `onclick="foo()"` to a template string,
  add `window.foo = foo` in `main.js` too or it throws at click time.
- **Animation lives in CSS, not in the redraw.** `drawPet()` rebuilds the SVG via
  `innerHTML`, which restarts every CSS animation inside it. It is guarded by a
  signature so it only rebuilds when something visual actually changed — if you add
  a new visual input, add it to that signature or the pet will stop updating for it.
- **`updateScene()` and `applyWeather()` are guarded the same way** and for the
  same reason. Rebuilding scenery every tick restarts the rain and the stars.
- **Never call `classList.remove("")`.** It throws `SyntaxError`, and the Home
  location's `bgClass` is an empty string. This exact mistake once aborted the whole
  startup script.
- **Pet position is centre-based**, in percent of the stage, with a permanent
  `translate(-50%, -50%)`. Don't mix in top-left coordinates.
- After editing, hard-reload (Ctrl+F5). The service worker caches aggressively, and
  `games.html` opens in a separate window with its own cache.

---

## Known issues

- **Unlocks are only checked on page load.** Cross a threshold mid-session and the
  new location stays locked until you reload.
- **Catch is unreachable from the UI.** It's fully implemented and exposed on
  `window`, but nothing links to it (`playCatch()` from the console). Hunt used
  to have the same problem — it is now the ⚔️ Hunt button and starts a battle,
  which also makes 🚀 Space reachable, since that unlock counts hunt wins.
- **Dusk, Dawn and Night can't be chosen manually.** They appear in the location
  picker but no rule ever unlocks them, so they stay at 🔒. They still show up on
  their own via the day/night cycle.
- The Photo feature checks for `html2canvas` but the library isn't bundled, so
  snapshots always use the built-in canvas fallback.

---

## Browser support

Needs a reasonably current browser — it uses CSS `transform-box: fill-box` on SVG,
`aspect-ratio`, optional chaining and Unicode regex property escapes. Chrome, Edge,
Firefox and Safari 15+ are fine. Speech synthesis and voice input are optional and
degrade quietly where unsupported.

---

## License

Not yet specified — add one before publishing if you want others to reuse it.
