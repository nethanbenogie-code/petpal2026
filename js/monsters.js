/* monsters.js — the bestiary, and the recipe for building each one in 3D.

   No sprite sheets. Every monster is declared as a list of primitive parts and
   assembled at runtime by buildMonster(), exactly like the pet in pet3d.js —
   so adding a monster is a data edit, not an art pipeline.

   Parts are described in a tiny spec rather than as three.js calls so this file
   stays importable without three.js (the combat engine and the encounter roller
   both read the stat block and never touch geometry). */

export const TIER_NAMES = ["", "Common", "Uncommon", "Rare", "Boss"];

/* geo: sphere | box | cone | capsule | torus | cylinder | octa
   mat: body | accent | dark | eye | glow                        */
const M = (id, name, cfg) => ({ id, name, ...cfg });

export const MONSTERS = [
    // ── tier 1 ────────────────────────────────────────────────────────────
    M("slime", "Slime", {
        zones: ["forest", "park", "home"], tier: 1,
        hp: 24, atk: 6, def: 3, spd: 4, xp: 18, coins: 6,
        body: "#7bd47f", accent: "#4f9f5c", quip: "*wobbles menacingly*",
        parts: [
            { geo: "sphere", r: 1, scale: [1.1, 0.72, 1.05], pos: [0, -0.35, 0], mat: "body" },
            { geo: "sphere", r: 0.42, scale: [1, 0.8, 1], pos: [0, 0.22, 0.1], mat: "body" },
            { geo: "sphere", r: 0.13, pos: [-0.28, 0.28, 0.62], mat: "eye" },
            { geo: "sphere", r: 0.13, pos: [0.28, 0.28, 0.62], mat: "eye" },
        ],
    }),
    M("bee", "Buzzbug", {
        zones: ["park", "forest"], tier: 1,
        hp: 20, atk: 8, def: 2, spd: 9, xp: 20, coins: 7,
        body: "#f7d774", accent: "#3a2a10", quip: "bzzzzzz!",
        parts: [
            { geo: "sphere", r: 0.75, scale: [1, 0.85, 1.25], pos: [0, 0, 0], mat: "body" },
            { geo: "torus", r: 0.62, tube: 0.14, pos: [0, 0, 0.1], rot: [1.57, 0, 0], mat: "dark" },
            { geo: "torus", r: 0.58, tube: 0.14, pos: [0, 0, -0.45], rot: [1.57, 0, 0], mat: "dark" },
            { geo: "cone", r: 0.16, h: 0.4, pos: [0, 0, -1.05], rot: [-1.57, 0, 0], mat: "dark" },
            { geo: "sphere", r: 0.14, pos: [-0.28, 0.2, 0.72], mat: "eye" },
            { geo: "sphere", r: 0.14, pos: [0.28, 0.2, 0.72], mat: "eye" },
        ],
    }),
    M("germ", "Germ", {
        zones: ["hospital", "bath"], tier: 1,
        hp: 22, atk: 7, def: 2, spd: 7, xp: 19, coins: 6,
        body: "#c98fe0", accent: "#6b3f80", quip: "*sneezes on you*",
        parts: [
            { geo: "sphere", r: 0.85, pos: [0, 0, 0], mat: "body" },
            { geo: "cone", r: 0.13, h: 0.45, pos: [0, 0.95, 0], mat: "accent" },
            { geo: "cone", r: 0.13, h: 0.45, pos: [0.85, 0.35, 0], rot: [0, 0, -1.1], mat: "accent" },
            { geo: "cone", r: 0.13, h: 0.45, pos: [-0.85, 0.35, 0], rot: [0, 0, 1.1], mat: "accent" },
            { geo: "cone", r: 0.13, h: 0.45, pos: [0, -0.95, 0], rot: [3.14, 0, 0], mat: "accent" },
            { geo: "sphere", r: 0.12, pos: [-0.26, 0.14, 0.78], mat: "eye" },
            { geo: "sphere", r: 0.12, pos: [0.26, 0.14, 0.78], mat: "eye" },
        ],
    }),
    // ── tier 2 ────────────────────────────────────────────────────────────
    M("crab", "Snipcrab", {
        zones: ["beach"], tier: 2,
        hp: 40, atk: 11, def: 8, spd: 5, xp: 34, coins: 12,
        body: "#f08a5d", accent: "#a8402a", quip: "*clacks its claws*",
        parts: [
            { geo: "sphere", r: 0.95, scale: [1.25, 0.62, 0.95], pos: [0, 0, 0], mat: "body" },
            { geo: "sphere", r: 0.34, pos: [-1.35, 0.05, 0.35], mat: "accent" },
            { geo: "sphere", r: 0.34, pos: [1.35, 0.05, 0.35], mat: "accent" },
            { geo: "cylinder", r: 0.07, h: 0.5, pos: [-0.75, 0.55, 0.4], mat: "dark" },
            { geo: "cylinder", r: 0.07, h: 0.5, pos: [0.75, 0.55, 0.4], mat: "dark" },
            { geo: "sphere", r: 0.15, pos: [-0.32, 0.5, 0.5], mat: "eye" },
            { geo: "sphere", r: 0.15, pos: [0.32, 0.5, 0.5], mat: "eye" },
        ],
    }),
    M("papergolem", "Paper Golem", {
        zones: ["school"], tier: 2,
        hp: 46, atk: 10, def: 10, spd: 3, xp: 36, coins: 13,
        body: "#eae2cf", accent: "#9a8f72", quip: "*rustles ominously*",
        parts: [
            { geo: "box", w: 1.3, h: 1.6, d: 0.5, pos: [0, 0, 0], mat: "body" },
            { geo: "box", w: 0.95, h: 0.8, d: 0.45, pos: [0, 1.25, 0], mat: "body" },
            { geo: "box", w: 0.32, h: 1.0, d: 0.32, pos: [-0.9, 0.1, 0], rot: [0, 0, 0.25], mat: "accent" },
            { geo: "box", w: 0.32, h: 1.0, d: 0.32, pos: [0.9, 0.1, 0], rot: [0, 0, -0.25], mat: "accent" },
            { geo: "sphere", r: 0.11, pos: [-0.24, 1.32, 0.26], mat: "eye" },
            { geo: "sphere", r: 0.11, pos: [0.24, 1.32, 0.26], mat: "eye" },
        ],
    }),
    M("cartmimic", "Cart Mimic", {
        zones: ["mall"], tier: 2,
        hp: 44, atk: 12, def: 7, spd: 6, xp: 35, coins: 16,
        body: "#c9ccd6", accent: "#7d8391", quip: "*rattles a loose wheel*",
        parts: [
            { geo: "box", w: 1.5, h: 1.0, d: 1.0, pos: [0, 0.1, 0], mat: "body" },
            { geo: "cylinder", r: 0.2, h: 0.14, pos: [-0.55, -0.75, 0.4], rot: [0, 0, 1.57], mat: "dark" },
            { geo: "cylinder", r: 0.2, h: 0.14, pos: [0.55, -0.75, 0.4], rot: [0, 0, 1.57], mat: "dark" },
            { geo: "sphere", r: 0.16, pos: [-0.35, 0.35, 0.52], mat: "eye" },
            { geo: "sphere", r: 0.16, pos: [0.35, 0.35, 0.52], mat: "eye" },
            { geo: "box", w: 1.2, h: 0.12, d: 0.12, pos: [0, -0.15, 0.55], mat: "accent" },
        ],
    }),
    M("ratking", "Rat King", {
        zones: ["city"], tier: 2,
        hp: 42, atk: 13, def: 6, spd: 8, xp: 37, coins: 15,
        body: "#8d8d97", accent: "#f4a8b3", quip: "*squeaks a challenge*",
        parts: [
            { geo: "sphere", r: 0.9, scale: [1.15, 0.85, 1.2], pos: [0, 0, 0], mat: "body" },
            { geo: "cone", r: 0.45, h: 0.8, pos: [0, 0.05, 0.95], rot: [1.57, 0, 0], mat: "body" },
            { geo: "sphere", r: 0.26, scale: [1, 1, 0.35], pos: [-0.55, 0.6, 0.1], mat: "accent" },
            { geo: "sphere", r: 0.26, scale: [1, 1, 0.35], pos: [0.55, 0.6, 0.1], mat: "accent" },
            { geo: "sphere", r: 0.12, pos: [-0.24, 0.2, 0.95], mat: "eye" },
            { geo: "sphere", r: 0.12, pos: [0.24, 0.2, 0.95], mat: "eye" },
        ],
    }),
    // ── tier 3 ────────────────────────────────────────────────────────────
    M("mutant", "Lab Mutant", {
        zones: ["lab"], tier: 3,
        hp: 66, atk: 17, def: 11, spd: 7, xp: 60, coins: 26,
        body: "#8ce0c8", accent: "#2f7a63", quip: "*bubbles violently*",
        parts: [
            { geo: "sphere", r: 1.0, scale: [1, 1.15, 1], pos: [0, 0, 0], mat: "body" },
            { geo: "sphere", r: 0.4, pos: [-0.75, 0.85, 0.2], mat: "accent" },
            { geo: "sphere", r: 0.3, pos: [0.8, 0.7, -0.1], mat: "accent" },
            { geo: "capsule", r: 0.18, h: 0.7, pos: [-1.1, -0.2, 0.2], rot: [0, 0, 0.6], mat: "body" },
            { geo: "capsule", r: 0.18, h: 0.7, pos: [1.1, -0.2, 0.2], rot: [0, 0, -0.6], mat: "body" },
            { geo: "sphere", r: 0.2, pos: [0, 0.35, 0.92], mat: "eye" },
        ],
    }),
    M("yeti", "Frostfur", {
        zones: ["snow", "mountain"], tier: 3,
        hp: 78, atk: 18, def: 13, spd: 4, xp: 66, coins: 28,
        body: "#e8f2fb", accent: "#8fb6d6", quip: "*roars, breath steaming*",
        parts: [
            { geo: "sphere", r: 1.1, scale: [1, 1.2, 0.95], pos: [0, -0.1, 0], mat: "body" },
            { geo: "sphere", r: 0.6, pos: [0, 1.15, 0.05], mat: "body" },
            { geo: "capsule", r: 0.26, h: 0.9, pos: [-1.2, 0.05, 0], rot: [0, 0, 0.35], mat: "body" },
            { geo: "capsule", r: 0.26, h: 0.9, pos: [1.2, 0.05, 0], rot: [0, 0, -0.35], mat: "body" },
            { geo: "cone", r: 0.14, h: 0.4, pos: [-0.3, 1.6, 0.1], mat: "accent" },
            { geo: "cone", r: 0.14, h: 0.4, pos: [0.3, 1.6, 0.1], mat: "accent" },
            { geo: "sphere", r: 0.13, pos: [-0.22, 1.2, 0.55], mat: "eye" },
            { geo: "sphere", r: 0.13, pos: [0.22, 1.2, 0.55], mat: "eye" },
        ],
    }),
    M("stormcloud", "Thunderhead", {
        zones: ["rain"], tier: 3,
        hp: 62, atk: 20, def: 9, spd: 10, xp: 62, coins: 25,
        body: "#6a7a8a", accent: "#f7d774", quip: "*crackles with static*",
        parts: [
            { geo: "sphere", r: 0.8, pos: [-0.6, 0.2, 0], mat: "body" },
            { geo: "sphere", r: 0.95, pos: [0.2, 0.35, 0], mat: "body" },
            { geo: "sphere", r: 0.7, pos: [1.0, 0.05, 0], mat: "body" },
            { geo: "cone", r: 0.22, h: 0.8, pos: [0.1, -0.9, 0.2], rot: [3.14, 0, 0.2], mat: "glow" },
            { geo: "sphere", r: 0.14, pos: [-0.1, 0.4, 0.85], mat: "eye" },
            { geo: "sphere", r: 0.14, pos: [0.6, 0.4, 0.8], mat: "eye" },
        ],
    }),
    M("alien", "Voidling", {
        zones: ["space"], tier: 3,
        hp: 70, atk: 19, def: 12, spd: 11, xp: 70, coins: 30,
        body: "#a88ff0", accent: "#4de0d0", quip: "*phases in and out*",
        parts: [
            { geo: "sphere", r: 0.85, scale: [1, 1.3, 1], pos: [0, 0.2, 0], mat: "body" },
            { geo: "octa", r: 0.5, pos: [0, 1.5, 0], mat: "accent" },
            { geo: "capsule", r: 0.12, h: 0.9, pos: [-0.9, -0.3, 0], rot: [0, 0, 0.5], mat: "accent" },
            { geo: "capsule", r: 0.12, h: 0.9, pos: [0.9, -0.3, 0], rot: [0, 0, -0.5], mat: "accent" },
            { geo: "sphere", r: 0.22, scale: [1.4, 1, 0.6], pos: [0, 0.45, 0.75], mat: "eye" },
        ],
    }),
];

/* ── bosses ──
   One per major zone, each beatable once for a first-clear bonus. Tier 4. */
export const BOSSES = [
    M("kingslime", "King Slime", {
        zones: ["forest"], tier: 4, boss: true,
        hp: 150, atk: 22, def: 14, spd: 5, xp: 240, coins: 110,
        body: "#4fbf78", accent: "#f7d774", quip: "The forest answers to me.",
        parts: [
            { geo: "sphere", r: 1.5, scale: [1.15, 0.85, 1.1], pos: [0, -0.3, 0], mat: "body" },
            { geo: "sphere", r: 0.7, pos: [0, 0.75, 0.15], mat: "body" },
            { geo: "cone", r: 0.55, h: 0.55, pos: [0, 1.55, 0], mat: "accent" },
            { geo: "sphere", r: 0.18, pos: [-0.35, 0.85, 0.72], mat: "eye" },
            { geo: "sphere", r: 0.18, pos: [0.35, 0.85, 0.72], mat: "eye" },
        ],
    }),
    M("tidewarden", "Tide Warden", {
        zones: ["beach"], tier: 4, boss: true,
        hp: 165, atk: 24, def: 16, spd: 6, xp: 255, coins: 120,
        body: "#4aa8d8", accent: "#e8f2fb", quip: "The tide takes everything.",
        parts: [
            { geo: "sphere", r: 1.3, scale: [1.3, 0.9, 1], pos: [0, 0, 0], mat: "body" },
            { geo: "cone", r: 0.35, h: 1.1, pos: [-0.8, 1.0, 0], rot: [0, 0, 0.3], mat: "accent" },
            { geo: "cone", r: 0.35, h: 1.1, pos: [0.8, 1.0, 0], rot: [0, 0, -0.3], mat: "accent" },
            { geo: "cone", r: 0.3, h: 1.3, pos: [0, 1.3, 0], mat: "accent" },
            { geo: "sphere", r: 0.19, pos: [-0.4, 0.25, 0.92], mat: "eye" },
            { geo: "sphere", r: 0.19, pos: [0.4, 0.25, 0.92], mat: "eye" },
        ],
    }),
    M("headmaster", "The Headmaster", {
        zones: ["school"], tier: 4, boss: true,
        hp: 175, atk: 25, def: 18, spd: 5, xp: 270, coins: 125,
        body: "#5c5470", accent: "#f7d774", quip: "You are LATE.",
        parts: [
            { geo: "box", w: 1.5, h: 2.0, d: 0.7, pos: [0, 0, 0], mat: "body" },
            { geo: "sphere", r: 0.55, pos: [0, 1.5, 0], mat: "accent" },
            { geo: "box", w: 1.4, h: 0.12, d: 0.9, pos: [0, 1.95, 0], mat: "body" },
            { geo: "box", w: 0.8, h: 0.8, d: 0.6, pos: [0, 2.05, 0], mat: "body" },
            { geo: "sphere", r: 0.12, pos: [-0.22, 1.55, 0.5], mat: "eye" },
            { geo: "sphere", r: 0.12, pos: [0.22, 1.55, 0.5], mat: "eye" },
        ],
    }),
    M("overclock", "Overclock", {
        zones: ["lab"], tier: 4, boss: true,
        hp: 190, atk: 27, def: 17, spd: 9, xp: 300, coins: 140,
        body: "#3fd8c8", accent: "#ff6b8a", quip: "SPECIMEN ACQUIRED.",
        parts: [
            { geo: "box", w: 1.4, h: 1.4, d: 1.4, pos: [0, 0, 0], mat: "body" },
            { geo: "octa", r: 0.75, pos: [0, 1.5, 0], mat: "accent" },
            { geo: "torus", r: 1.15, tube: 0.1, pos: [0, 0, 0], rot: [1.2, 0, 0], mat: "accent" },
            { geo: "torus", r: 1.15, tube: 0.1, pos: [0, 0, 0], rot: [1.2, 1.05, 0], mat: "accent" },
            { geo: "sphere", r: 0.2, pos: [0, 1.5, 0.7], mat: "eye" },
        ],
    }),
    M("summit", "Summit Titan", {
        zones: ["mountain"], tier: 4, boss: true,
        hp: 210, atk: 26, def: 22, spd: 3, xp: 310, coins: 145,
        body: "#8d8577", accent: "#c9e8b5", quip: "*the mountain stands up*",
        parts: [
            { geo: "box", w: 2.0, h: 1.8, d: 1.2, pos: [0, 0, 0], mat: "body" },
            { geo: "box", w: 1.0, h: 0.9, d: 0.9, pos: [0, 1.35, 0], mat: "body" },
            { geo: "cone", r: 0.5, h: 0.7, pos: [-0.7, 1.9, 0], mat: "accent" },
            { geo: "cone", r: 0.4, h: 0.55, pos: [0.7, 1.75, 0], mat: "accent" },
            { geo: "box", w: 0.5, h: 1.5, d: 0.5, pos: [-1.35, -0.1, 0], mat: "body" },
            { geo: "box", w: 0.5, h: 1.5, d: 0.5, pos: [1.35, -0.1, 0], mat: "body" },
            { geo: "sphere", r: 0.14, pos: [-0.25, 1.4, 0.5], mat: "eye" },
            { geo: "sphere", r: 0.14, pos: [0.25, 1.4, 0.5], mat: "eye" },
        ],
    }),
    M("nebula", "Nebula Eater", {
        zones: ["space"], tier: 4, boss: true,
        hp: 230, atk: 30, def: 20, spd: 12, xp: 360, coins: 170,
        body: "#6b4fd0", accent: "#ffd166", quip: "*the stars go quiet*",
        parts: [
            { geo: "sphere", r: 1.35, pos: [0, 0, 0], mat: "body" },
            { geo: "torus", r: 2.0, tube: 0.13, pos: [0, 0, 0], rot: [1.4, 0, 0], mat: "accent" },
            { geo: "torus", r: 1.7, tube: 0.09, pos: [0, 0, 0], rot: [1.0, 0.6, 0], mat: "accent" },
            { geo: "sphere", r: 0.3, scale: [1.6, 1, 0.6], pos: [0, 0.3, 1.15], mat: "eye" },
            { geo: "octa", r: 0.28, pos: [-1.5, 1.1, 0], mat: "glow" },
            { geo: "octa", r: 0.28, pos: [1.5, 1.1, 0], mat: "glow" },
        ],
    }),
];

export const ALL = [...MONSTERS, ...BOSSES];
export const byId = (id) => ALL.find(m => m.id === id) || null;

/** Regular monsters that can appear at a location. Falls back to tier 1 so
 *  every zone can produce a fight, even ones with no themed monster. */
export function monstersForZone(zone) {
    const hit = MONSTERS.filter(m => m.zones.includes(zone));
    return hit.length ? hit : MONSTERS.filter(m => m.tier === 1);
}

export function bossForZone(zone) {
    return BOSSES.find(b => b.zones.includes(zone)) || null;
}

/* ── scaling ──
   Monsters are anchored to the PET'S OWN stat curve at the same level, not
   grown from their hand-tuned numbers by a multiplier.

   The first version did the latter and the balance came out broken: monster
   attack and defence both scaled faster than the pet's linear growth, so a
   level-30 pet lost to every boss 100% of the time while still one-shotting
   tier-1s. Difficulty has to be expressed RELATIVE to the player or it can
   only be correct at one level.

   The hand-tuned numbers aren't wasted — they're normalised within each tier
   to become per-monster "flavour" (a bee stays fast and fragile, a golem slow
   and armoured), so adding a monster still just means writing sensible stats. */
/* atk sits ABOVE 1.0 on purpose. Defence divides damage by 18/(18+def), and
   the pet's defence (3+1.2L) grows fast enough to absorb ~74% of an incoming
   hit by level 40 — so a monster whose attack merely matched the pet's did
   about 8 damage a turn against 180 HP and could never win. Measured, not
   guessed: the first pass at these numbers gave a 100% win rate at every
   level from 1 to 100. */
const TIER_PROFILE = {
    1: { hp: 1.10, atk: 0.60, def: 0.40, spd: 0.90, xp: 0.35, coins: 0.30 },
    2: { hp: 1.80, atk: 0.80, def: 0.60, spd: 1.00, xp: 0.60, coins: 0.55 },
    3: { hp: 1.95, atk: 0.70, def: 0.75, spd: 1.05, xp: 1.00, coins: 0.95 },
    4: { hp: 3.20, atk: 0.72, def: 0.85, spd: 1.00, xp: 3.20, coins: 3.00 },
};

// pet stat curve, mirrored from rpg.js stats()
const petHp = L => 20 + L * 4;
const petAtk = L => 5 + L * 1.5;
const petDef = L => 3 + L * 1.2;
const petSpd = L => 4 + L * 0.8;

const _flavourCache = new Map();

function flavour(base) {
    if (_flavourCache.has(base.id)) return _flavourCache.get(base.id);
    const peers = ALL.filter(m => m.tier === base.tier);
    const mean = k => peers.reduce((s, m) => s + m[k], 0) / peers.length;
    const f = {
        hp: base.hp / mean("hp"),
        atk: base.atk / mean("atk"),
        def: base.def / mean("def"),
        spd: base.spd / mean("spd"),
        xp: base.xp / mean("xp"),
        coins: base.coins / mean("coins"),
    };
    // keep flavour a seasoning, not a second difficulty axis
    for (const k of Object.keys(f)) f[k] = Math.min(1.45, Math.max(0.65, f[k]));
    _flavourCache.set(base.id, f);
    return f;
}

export function scaleMonster(base, petLevel) {
    const L = Math.max(1, Math.min(100, petLevel || 1));
    const p = TIER_PROFILE[base.tier] || TIER_PROFILE[1];
    const f = flavour(base);
    const hp = Math.max(8, Math.round(petHp(L) * p.hp * f.hp));
    return {
        ...base,
        level: Math.max(1, Math.round(L * (0.9 + base.tier * 0.04))),
        hp, maxHp: hp,
        atk: Math.max(2, Math.round(petAtk(L) * p.atk * f.atk)),
        def: Math.max(0, Math.round(petDef(L) * p.def * f.def)),
        spd: Math.max(1, Math.round(petSpd(L) * p.spd * f.spd)),
        xp: Math.max(5, Math.round((14 + L * 2.2) * p.xp * f.xp)),
        coins: Math.max(2, Math.round((6 + L * 0.9) * p.coins * f.coins)),
    };
}

/* ── 3D assembly ──
   Takes the THREE namespace as an argument so this module stays importable
   from node and from the combat tests without pulling in a renderer. */
export function buildMonster(THREE, spec) {
    const g = new THREE.Group();
    const mats = {
        body: new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.body), roughness: 0.7 }),
        accent: new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.accent), roughness: 0.6 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.7 }),
        eye: new THREE.MeshStandardMaterial({ color: 0xfdfdff, roughness: 0.25 }),
        glow: new THREE.MeshStandardMaterial({
            color: new THREE.Color(spec.accent), emissive: new THREE.Color(spec.accent),
            emissiveIntensity: 0.7, roughness: 0.4,
        }),
    };

    for (const p of spec.parts) {
        let geo;
        switch (p.geo) {
            case "box": geo = new THREE.BoxGeometry(p.w || 1, p.h || 1, p.d || 1); break;
            case "cone": geo = new THREE.ConeGeometry(p.r || 0.5, p.h || 1, 20); break;
            case "capsule": geo = new THREE.CapsuleGeometry(p.r || 0.2, p.h || 0.6, 6, 14); break;
            case "torus": geo = new THREE.TorusGeometry(p.r || 1, p.tube || 0.12, 12, 32); break;
            case "cylinder": geo = new THREE.CylinderGeometry(p.r || 0.2, p.r || 0.2, p.h || 0.5, 18); break;
            case "octa": geo = new THREE.OctahedronGeometry(p.r || 0.5, 0); break;
            default: geo = new THREE.SphereGeometry(p.r || 0.5, 24, 18);
        }
        const mesh = new THREE.Mesh(geo, mats[p.mat] || mats.body);
        if (p.pos) mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
        if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
        if (p.scale) mesh.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        g.add(mesh);
    }

    // pupils, so every eye reads as an eye without declaring two parts each
    for (const p of spec.parts.filter(x => x.mat === "eye")) {
        const pupil = new THREE.Mesh(new THREE.SphereGeometry((p.r || 0.15) * 0.55, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.3 }));
        pupil.position.set(p.pos[0] * 1.04, p.pos[1], p.pos[2] + (p.r || 0.15) * 0.6);
        g.add(pupil);
    }

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 28),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.35;
    g.add(shadow);

    return g;
}
