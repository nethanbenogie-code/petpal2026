/* battle.js — turn-based combat. Pure logic: no DOM, no three.js, no globals.

   Kept deliberately free of rendering so it can be exercised head-less. The
   battle screen drives it by calling playerAction() and reading the returned
   log of events; nothing here knows a canvas exists.

   Rewards are NOT written to the save file here. battle.html hands them back
   through a one-shot key that the main window drains — the main app autosaves
   its whole state every 5s and would otherwise clobber anything written
   underneath it. */

import { scaleMonster } from './monsters.js';
import { WEAPON_SKILLS } from './weapons.js';

/* Skills are earned, not bought: each maps to a trick the pet already knows,
   so training has a combat payoff. Everyone always has Attack. */
export const SKILLS = {
    spin:  { name: "Spin Attack", emoji: "🌀", mult: 1.6, cd: 3, kind: "damage",
             text: n => `${n} whirls into a spinning strike!` },
    jump:  { name: "Slam",        emoji: "⬆",  mult: 1.9, cd: 4, kind: "damage",
             text: n => `${n} leaps and slams down!` },
    dance: { name: "Dazzle",      emoji: "💃", mult: 0.6, cd: 3, kind: "debuff", debuff: 0.7,
             text: n => `${n} dances — the enemy is dazzled!` },
    sing:  { name: "Lullaby",     emoji: "🎵", mult: 0,   cd: 4, kind: "heal", heal: 0.16,
             text: n => `${n} sings and feels restored.` },
    hug:   { name: "Brace",       emoji: "🤗", mult: 0,   cd: 3, kind: "buff", buff: 1.6,
             text: n => `${n} braces — defence up!` },
    wave:  { name: "Taunt",       emoji: "👋", mult: 0.4, cd: 2, kind: "weaken", weaken: 0.75,
             text: n => `${n} taunts — the enemy's attack falters!` },
    sit:   { name: "Focus",       emoji: "🪑", mult: 0,   cd: 3, kind: "focus",
             text: n => `${n} focuses. Next hit will land hard.` },
};

const rnd = (a, b) => a + Math.random() * (b - a);

/* Damage: attack scaled by skill, softened by defence, ±12% variance.
   Defence divides rather than subtracts, so it never reduces a hit to zero.

   The softening constant SCALES WITH THE DEFENDER'S LEVEL, and that is load
   bearing. With a fixed constant, defence barely mattered at level 1 (18/22 =
   82% of damage got through) and smothered everything by level 100 (18/141 =
   13%). Since the pet and the monsters carry different defence profiles, the
   two drifted apart at different rates and the same monster measured 19% win
   at level 10 and 100% at level 50. Tying it to level keeps the ratio roughly
   constant, which is what makes one set of tier profiles valid at every
   level. */
export function damage(atk, def, mult, focused, defenderLevel) {
    const K = 6 + 0.9 * Math.max(1, defenderLevel || 1);
    const raw = atk * (mult || 1) * (focused ? 1.8 : 1);
    const dealt = raw * (K / (K + Math.max(0, def)));
    return Math.max(1, Math.round(dealt * rnd(0.88, 1.12)));
}

/**
 * @param petStats  from rpg.stats() — { level, maxHp, atk, def, spd }
 * @param monsterBase  an entry from monsters.js
 * @param opts  { tricks: {word:{action}}, items: [{id,name,icon,heal}] }
 */
export function createBattle(petStats, monsterBase, opts = {}) {
    const mon = scaleMonster(monsterBase, petStats.level);
    const known = new Set();
    for (const t of Object.values(opts.tricks || {})) {
        if (t && SKILLS[t.action]) known.add(t.action);
    }
    // the equipped weapon's signature move, available only while it is held
    if (opts.weapon && opts.weapon.skill && WEAPON_SKILLS[opts.weapon.skill]) {
        known.add(opts.weapon.skill);
    }
    return {
        pet: { ...petStats, hp: petStats.maxHp, defBuff: 1, focused: false },
        mon,
        skills: [...known],
        cooldowns: {},
        items: (opts.items || []).slice(0, 6),
        turn: 0,
        over: false,
        won: false,
        fled: false,
        log: [],
    };
}

function push(b, text, kind) { b.log.push({ text, kind: kind || "info", turn: b.turn }); }

function monsterTurn(b) {
    if (b.over) return;
    const m = b.mon;
    /* Stunned monsters lose the turn entirely. Cleared here rather than at the
       top of the player's turn so a stun always costs exactly one enemy
       action — chaining two zaps can't silently drop one. */
    if (m.stunned) {
        m.stunned = false;
        b.pet.defBuff = 1;
        m.atkMod = 1;
        push(b, `${m.name} is stunned and can't move!`, "skill");
        return;
    }
    // A cornered monster hits harder — gives late fights a shape.
    const desperate = m.hp / m.maxHp < 0.3;
    const mult = (desperate ? 1.35 : 1) * (m.atkMod || 1);
    const dmg = damage(m.atk, b.pet.def * b.pet.defBuff, mult, false, b.pet.level);
    b.pet.hp = Math.max(0, b.pet.hp - dmg);
    push(b, `${m.name} strikes for ${dmg}!${desperate ? " It's furious!" : ""}`, "hit-pet");
    // buffs and debuffs last exactly one enemy turn
    b.pet.defBuff = 1;
    m.atkMod = 1;
    if (b.pet.hp <= 0) {
        b.over = true; b.won = false;
        push(b, `${b.pet.name || "Your pet"} is worn out...`, "lose");
    }
}

/**
 * @param action  "attack" | "skill" | "item" | "flee"
 * @param arg     skill id, or item index
 */
export function playerAction(b, action, arg) {
    if (b.over) return b;
    b.turn++;
    const m = b.mon;

    // tick cooldowns at the top of the player's turn
    for (const k of Object.keys(b.cooldowns)) {
        if (b.cooldowns[k] > 0) b.cooldowns[k]--;
    }

    let acted = true;
    if (action === "attack") {
        const dmg = damage(b.pet.atk, m.def, 1, b.pet.focused, m.level);
        b.pet.focused = false;
        m.hp = Math.max(0, m.hp - dmg);
        push(b, `Attack hits ${m.name} for ${dmg}!`, "hit-mon");

    } else if (action === "skill") {
        const s = SKILLS[arg] || WEAPON_SKILLS[arg];
        if (!s || !b.skills.includes(arg) || b.cooldowns[arg] > 0) {
            b.turn--; return b;                       // not usable; costs nothing
        }
        b.cooldowns[arg] = s.cd;
        push(b, `${s.emoji} ${s.text(b.pet.name || "Your pet")}`, "skill");
        if (s.mult > 0) {
            /* Multi-hit weapons roll each strike separately so variance and the
               defence curve apply per hit; sunder softens defence for this
               swing only. */
            const hits = s.kind === "multi" ? (s.hits || 2) : 1;
            // pierce ignores armour outright; sunder just softens it
            const defMul = s.kind === "pierce" ? 0 : s.kind === "sunder" ? (s.sunder || 1) : 1;
            let total = 0;
            for (let i = 0; i < hits && m.hp > 0; i++) {
                const dmg = damage(b.pet.atk, m.def * defMul, s.mult, b.pet.focused, m.level);
                b.pet.focused = false;
                m.hp = Math.max(0, m.hp - dmg);
                total += dmg;
            }
            push(b, hits > 1 ? `${hits} hits — ${total} damage!` : `${m.name} takes ${total}!`, "hit-mon");
        }
        if (s.kind === "heal") {
            const healed = Math.round(b.pet.maxHp * s.heal);
            b.pet.hp = Math.min(b.pet.maxHp, b.pet.hp + healed);
            push(b, `Recovered ${healed} HP.`, "heal");
        }
        if (s.kind === "shock" && Math.random() < (s.stun || 0)) {
            m.stunned = true;
            push(b, `${m.name} is paralysed!`, "skill");
        }
        if (s.kind === "buff") b.pet.defBuff = s.buff;
        if (s.kind === "weaken") m.atkMod = s.weaken;
        if (s.kind === "debuff") m.atkMod = s.debuff;
        if (s.kind === "focus") b.pet.focused = true;

    } else if (action === "item") {
        const it = b.items[arg];
        if (!it) { b.turn--; return b; }
        b.items.splice(arg, 1);
        const healed = Math.max(6, Math.round(b.pet.maxHp * 0.22));
        b.pet.hp = Math.min(b.pet.maxHp, b.pet.hp + healed);
        push(b, `${it.icon || "🍎"} Ate ${it.name} — ${healed} HP back.`, "heal");

    } else if (action === "flee") {
        // Faster than it? Usually away. Slower? Usually not.
        const odds = Math.min(0.9, Math.max(0.15, 0.45 + (b.pet.spd - m.spd) * 0.04));
        if (m.boss) {
            push(b, "No running from this one.", "info");
        } else if (Math.random() < odds) {
            b.over = true; b.fled = true; b.won = false;
            push(b, "Got away safely.", "flee");
            return b;
        } else {
            push(b, "Couldn't get away!", "info");
        }
        acted = false;
    }

    if (m.hp <= 0) {
        b.over = true; b.won = true;
        push(b, `${m.name} is defeated!`, "win");
        return b;
    }
    if (acted || action === "flee") monsterTurn(b);
    return b;
}

/** Rewards for a finished battle. Losing still pays a consolation share —
 *  a wipe that gives nothing makes players avoid the system entirely. */
export function rewards(b, firstClear) {
    if (!b.over || b.fled) return { xp: 0, coins: 0, firstClear: false };
    const m = b.mon;
    /* Hunt is the always-available, on-demand way to get into a fight.
       Ambient encounters while exploring are rarer and pay full XP, so Hunt
       pays 70% — on every fight, win or lose — rather than being strictly
       better than just wandering around. Coins are untouched; only XP is
       cut, per how this was asked for. */
    const huntCut = b.kind === "hunt" ? 0.7 : 1;
    if (!b.won) return { xp: Math.round(m.xp * 0.25 * huntCut), coins: 0, firstClear: false };
    const bonus = firstClear && m.boss ? 2 : 1;
    return {
        xp: Math.round(m.xp * bonus * huntCut),
        coins: Math.round(m.coins * bonus),
        firstClear: !!(firstClear && m.boss),
    };
}

export function skillOf(id) { return SKILLS[id] || WEAPON_SKILLS[id] || null; }

export function skillList(b) {
    return b.skills.map(id => ({
        id, ...skillOf(id), ready: !(b.cooldowns[id] > 0), cooling: b.cooldowns[id] || 0,
    }));
}
