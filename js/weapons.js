/* weapons.js — equippable weapons, built from primitives like everything else.

   No downloaded art. A sword is a box blade, a box guard and a cylinder grip;
   it inherits the arena's lighting, recolours per rarity for free, and adds
   nothing to the download. The same `parts` spec the bestiary uses is reused
   here so there is one assembly routine to understand, not two.

   A weapon is more than +ATK: each carries a signature skill that is available
   in battle only while it is equipped, so switching weapons changes how you
   fight rather than just how hard you hit. */

export const RARITY = {
    common: { label: "Common", colour: "#b9c2cc" },
    fine: { label: "Fine", colour: "#7bc47f" },
    rare: { label: "Rare", colour: "#6bb6ff" },
    epic: { label: "Epic", colour: "#c98fe0" },
    legendary: { label: "Legendary", colour: "#f7d774" },
};

/* Bonuses are PERCENTAGES of the pet's own stats, never flat numbers.

   The first pass used flat values and it broke the curve exactly the way the
   monsters did before they were re-anchored: +18 attack is enormous next to a
   level-25 pet's 43 and trivial next to a level-100 pet's 155, so the same
   Warhammer measured 82% against a boss at L25 and 62% at L60. A percentage
   means one balance pass holds at every level.

   Signature skills are SIDEGRADES, not upgrades — comparable in throughput to
   a trained trick, differing in shape (burst, multi-hit, armour-piercing).
   Shape matches SKILLS in battle.js, which merges them in when equipped, so
   the combat engine needs no weapon concept at all. */
export const WEAPON_SKILLS = {
    w_slash: {
        name: "Slash", emoji: "🗡", mult: 1.45, cd: 3, kind: "damage",
        text: n => `${n} slashes clean through!`,
    },
    w_rend: {
        name: "Rend", emoji: "🐾", mult: 0.58, cd: 4, kind: "multi", hits: 3,
        text: n => `${n} rakes with a flurry of claws!`,
    },
    w_break: {
        name: "Guard Break", emoji: "🪄", mult: 1.05, cd: 3, kind: "sunder", sunder: 0.55,
        text: n => `${n} shatters the enemy's guard!`,
    },
    w_quake: {
        name: "Quake", emoji: "🔨", mult: 2.3, cd: 6, kind: "damage",
        text: n => `${n} brings the hammer down — the ground shakes!`,
    },
    w_starfall: {
        name: "Starfall", emoji: "✨", mult: 1.05, cd: 4, kind: "multi", hits: 2,
        text: n => `${n} calls down a rain of stars!`,
    },
    /* Zap trades raw damage for tempo: a stun costs the monster a whole turn,
       which is worth more the longer the fight runs — so it shines on bosses
       and is nearly wasted on a slime that dies in four turns anyway. */
    w_zap: {
        name: "Zap", emoji: "⚡", mult: 1.15, cd: 4, kind: "shock", stun: 0.5,
        text: n => `${n} looses a crackling arc of electricity!`,
    },
    /* The beam ignores defence completely. Deliberately modest on paper —
       against a Paper Golem or Summit Titan, ignoring armour is worth far more
       than the multiplier suggests, and against a squishy target it is worth
       almost nothing. */
    w_beam: {
        name: "Beam", emoji: "🔆", mult: 1.25, cd: 4, kind: "pierce",
        text: n => `${n} fires a searing beam straight through!`,
    },
};

const W = (id, name, cfg) => ({ id, name, slot: "weapon", ...cfg });

export const WEAPONS = [
    W("twig", "Twig", {
        price: 0, rarity: "common", atk: 0.03, def: 0, spd: 0.02, skill: null,
        desc: "A stick. It is, at least, yours.",
        grip: "#8a6a45", blade: "#a3814f",
        parts: [
            { geo: "cylinder", r: 0.05, h: 1.1, pos: [0, 0.35, 0], mat: "blade" },
            { geo: "sphere", r: 0.09, pos: [0, 0.95, 0], mat: "blade" },
        ],
    }),
    W("woodsword", "Wooden Sword", {
        price: 60, rarity: "common", atk: 0.12, def: 0.03, spd: 0, skill: "w_slash",
        desc: "Blunt, but it swings properly.",
        grip: "#6b4a2f", blade: "#c9a86a",
        parts: [
            { geo: "cylinder", r: 0.07, h: 0.32, pos: [0, -0.18, 0], mat: "grip" },
            { geo: "box", w: 0.42, h: 0.09, d: 0.12, pos: [0, 0.02, 0], mat: "grip" },
            { geo: "box", w: 0.16, h: 1.05, d: 0.05, pos: [0, 0.56, 0], mat: "blade" },
        ],
    }),
    W("claws", "Iron Claws", {
        price: 180, rarity: "fine", atk: 0.18, def: 0, spd: 0.20, skill: "w_rend",
        desc: "Three quick cuts where others land one.",
        grip: "#4a4a52", blade: "#d6dbe2",
        parts: [
            { geo: "box", w: 0.34, h: 0.16, d: 0.2, pos: [0, -0.05, 0], mat: "grip" },
            { geo: "cone", r: 0.05, h: 0.5, pos: [-0.13, 0.32, 0.02], rot: [0, 0, 0.18], mat: "blade" },
            { geo: "cone", r: 0.05, h: 0.56, pos: [0, 0.36, 0.02], mat: "blade" },
            { geo: "cone", r: 0.05, h: 0.5, pos: [0.13, 0.32, 0.02], rot: [0, 0, -0.18], mat: "blade" },
        ],
    }),
    W("staff", "Battle Staff", {
        price: 240, rarity: "rare", atk: 0.16, def: 0.18, spd: 0.05, skill: "w_break",
        desc: "Keeps things at arm's length.",
        grip: "#5a4630", blade: "#6bb6ff",
        parts: [
            { geo: "cylinder", r: 0.06, h: 1.5, pos: [0, 0.3, 0], mat: "grip" },
            { geo: "octa", r: 0.17, pos: [0, 1.12, 0], mat: "blade" },
            { geo: "torus", r: 0.16, tube: 0.035, pos: [0, 1.12, 0], rot: [1.57, 0, 0], mat: "blade" },
        ],
    }),
    W("hammer", "Warhammer", {
        price: 420, rarity: "rare", atk: 0.30, def: 0.06, spd: -0.15, skill: "w_quake",
        desc: "Slow. Decisive.",
        grip: "#4b3b2a", blade: "#8f98a3",
        parts: [
            { geo: "cylinder", r: 0.07, h: 1.0, pos: [0, 0.2, 0], mat: "grip" },
            { geo: "box", w: 0.44, h: 0.36, d: 0.36, pos: [0, 0.82, 0], mat: "blade" },
            { geo: "box", w: 0.12, h: 0.42, d: 0.42, pos: [0.26, 0.82, 0], mat: "blade" },
        ],
    }),
    W("zaprod", "Zap Rod", {
        price: 320, rarity: "rare", atk: 0.20, def: 0.04, spd: 0.14, skill: "w_zap",
        desc: "Stuns as often as it strikes.",
        grip: "#3d3d4a", blade: "#7ce8ff",
        parts: [
            { geo: "cylinder", r: 0.06, h: 0.95, pos: [0, 0.18, 0], mat: "grip" },
            { geo: "torus", r: 0.13, tube: 0.035, pos: [0, 0.7, 0], rot: [1.57, 0, 0], mat: "glow" },
            { geo: "cone", r: 0.1, h: 0.34, pos: [-0.14, 0.98, 0], rot: [0, 0, 0.45], mat: "glow" },
            { geo: "cone", r: 0.1, h: 0.34, pos: [0.14, 0.98, 0], rot: [0, 0, -0.45], mat: "glow" },
            { geo: "sphere", r: 0.11, pos: [0, 1.18, 0], mat: "glow" },
        ],
    }),
    W("laser", "Laser Blaster", {
        price: 640, rarity: "epic", atk: 0.34, def: 0.08, spd: 0.10, skill: "w_beam",
        desc: "Armour is not a suggestion. It is simply irrelevant.",
        grip: "#2f3340", blade: "#ff5f6d",
        parts: [
            { geo: "box", w: 0.2, h: 0.34, d: 0.16, pos: [0, -0.16, 0], mat: "grip" },
            { geo: "box", w: 0.26, h: 0.24, d: 0.7, pos: [0, 0.1, 0.22], mat: "grip" },
            { geo: "cylinder", r: 0.09, h: 0.66, pos: [0, 0.12, 0.66], rot: [1.57, 0, 0], mat: "blade" },
            { geo: "torus", r: 0.13, tube: 0.032, pos: [0, 0.12, 0.72], rot: [0, 0, 0], mat: "glow" },
            { geo: "sphere", r: 0.07, pos: [0, 0.12, 1.0], mat: "glow" },
            { geo: "box", w: 0.1, h: 0.16, d: 0.2, pos: [0, 0.3, 0.05], mat: "glow" },
        ],
    }),
    W("starblade", "Star Blade", {
        price: 950, rarity: "legendary", atk: 0.52, def: 0.18, spd: 0.12, skill: "w_starfall",
        desc: "Hums faintly. Nobody knows where it came from.",
        grip: "#3a2f52", blade: "#ffe58a",
        parts: [
            { geo: "cylinder", r: 0.07, h: 0.34, pos: [0, -0.2, 0], mat: "grip" },
            { geo: "box", w: 0.5, h: 0.08, d: 0.14, pos: [0, 0.0, 0], mat: "blade" },
            { geo: "box", w: 0.14, h: 1.25, d: 0.045, pos: [0, 0.66, 0], mat: "glow" },
            { geo: "octa", r: 0.1, pos: [0, 1.34, 0], mat: "glow" },
        ],
    }),
];

export const weaponById = id => WEAPONS.find(w => w.id === id) || null;

/** The weapon currently equipped, or null. Twig included — it is a real item. */
export function equippedWeapon(state) {
    const id = state && state.equipped && state.equipped.weapon;
    return id ? weaponById(id) : null;
}

/** Multipliers from the equipped weapon: 0.12 means +12%. Zero when bare. */
export function weaponBonus(state) {
    const w = equippedWeapon(state);
    return w ? { atk: w.atk || 0, def: w.def || 0, spd: w.spd || 0 }
             : { atk: 0, def: 0, spd: 0 };
}

/** "+12% atk · +3% def" — for the shop card and the stats panel. */
export function weaponBlurb(w) {
    if (!w) return "";
    const pct = v => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
    const bits = [];
    if (w.atk) bits.push(`${pct(w.atk)} atk`);
    if (w.def) bits.push(`${pct(w.def)} def`);
    if (w.spd) bits.push(`${pct(w.spd)} spd`);
    return bits.join(" · ");
}

/** Build the 3D weapon. Same part spec as monsters.js, kept separate only so
 *  weapons can carry grip/blade/glow materials of their own. */
export function buildWeapon(THREE, spec) {
    const g = new THREE.Group();
    const mats = {
        grip: new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.grip), roughness: 0.85 }),
        blade: new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.blade), roughness: 0.3, metalness: 0.35 }),
        glow: new THREE.MeshStandardMaterial({
            color: new THREE.Color(spec.blade), emissive: new THREE.Color(spec.blade),
            emissiveIntensity: 0.75, roughness: 0.25, metalness: 0.3,
        }),
    };
    for (const p of spec.parts) {
        let geo;
        switch (p.geo) {
            case "box": geo = new THREE.BoxGeometry(p.w || 0.2, p.h || 0.2, p.d || 0.2); break;
            case "cone": geo = new THREE.ConeGeometry(p.r || 0.1, p.h || 0.4, 14); break;
            case "cylinder": geo = new THREE.CylinderGeometry(p.r || 0.07, p.r || 0.07, p.h || 0.5, 14); break;
            case "torus": geo = new THREE.TorusGeometry(p.r || 0.2, p.tube || 0.04, 10, 24); break;
            case "octa": geo = new THREE.OctahedronGeometry(p.r || 0.15, 0); break;
            default: geo = new THREE.SphereGeometry(p.r || 0.1, 16, 12);
        }
        const m = new THREE.Mesh(geo, mats[p.mat] || mats.blade);
        if (p.pos) m.position.set(p.pos[0], p.pos[1], p.pos[2]);
        if (p.rot) m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
        if (p.scale) m.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        g.add(m);
    }
    return g;
}
