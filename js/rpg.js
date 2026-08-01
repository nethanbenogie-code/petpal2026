/* rpg.js — experience, levels 1–100, and the derived combat stats.

   Two separate progressions live in this app and they are NOT the same thing:

     STAGE  (Egg → Baby → Kid → Teen → Adult) is AGE. Pure elapsed real time,
            owned by state.js, unchanged by anything here.
     LEVEL  (1 → 100) is EXPERIENCE. Earned by doing things.

   A neglected pet still becomes an Adult; only a played-with pet gets to 100.

   Only the XP TOTAL is stored. Level, progress and every combat stat are
   derived from it, so the curve below can be retuned later without migrating
   or corrupting a single save. */

import { state, save, clamp } from './state.js';
import { toast, speak, chirp } from './ui.js';

export const MAX_LEVEL = 100;

/* Cumulative XP required to REACH level L. Quadratic: early levels land in
   seconds so the bar visibly moves on day one, level 100 sits near 50,000 —
   a couple of months of steady play rather than an afternoon. */
export function xpForLevel(L) {
    if (L <= 1) return 0;
    const n = Math.min(L, MAX_LEVEL) - 1;
    return 5 * n * n + 10 * n;
}

export function levelFromXp(xp) {
    const x = Math.max(0, xp || 0);
    // closed form inverse of 5n² + 10n, then clamped — no loop, no drift
    const n = Math.floor((-10 + Math.sqrt(100 + 20 * x)) / 10);
    return clamp(n + 1, 1, MAX_LEVEL);
}

export function level() { return levelFromXp(state.xp); }

/** Progress within the current level: { level, xp, into, need, pct, atMax } */
export function progress() {
    const L = level();
    const xp = Math.max(0, state.xp || 0);
    if (L >= MAX_LEVEL) return { level: L, xp, into: 0, need: 0, pct: 100, atMax: true };
    const base = xpForLevel(L), next = xpForLevel(L + 1);
    const into = xp - base, need = next - base;
    return { level: L, xp, into, need, pct: Math.round((into / need) * 100), atMax: false };
}

/* Combat stats. Derived, never stored — level and traits are the only inputs
   today, and equipment will multiply in at stage 6 without a save migration. */
export function stats() {
    const L = level();
    const t = state.traits || {};
    return {
        level: L,
        maxHp: Math.round(20 + L * 4 + (t.independent || 0) * 0.2),
        atk: Math.round(5 + L * 1.5 + (t.playful || 0) * 0.1),
        def: Math.round(3 + L * 1.2 + (t.affectionate || 0) * 0.1),
        spd: Math.round(4 + L * 0.8 + (t.curious || 0) * 0.1),
    };
}

/* XP per action. Kept in one table so the economy is legible and tunable in
   one place rather than scattered across a dozen call sites. */
export const XP = {
    feed: 4, water: 3, bath: 6, play: 8, park: 12, pet: 2, medicine: 5,
    wake: 10, chat: 2, trick: 6, photo: 5, travel: 15, hunt: 3,
    achievement: 30, daily: 25, contact: 4,
};

let pending = 0, pendingTimer = null;

/**
 * Award XP and handle any level-ups.
 * Bursts (a run of chat messages, a spray of hunt catches) are coalesced for
 * ~600ms so the player gets one toast rather than a stack of them.
 */
export function grantXp(amount, reason) {
    const n = Math.round(amount || 0);
    if (n <= 0) return;
    const before = level();
    state.xp = Math.max(0, (state.xp || 0) + n);
    const after = level();

    if (after > before) {
        levelUp(before, after);
    } else {
        pending += n;
        if (!pendingTimer) {
            pendingTimer = setTimeout(() => {
                const total = pending;
                pending = 0; pendingTimer = null;
                if (total > 0) toast(`+${total} XP${reason ? " · " + reason : ""}`);
            }, 600);
        }
    }
    save();
}

function levelUp(from, to) {
    pending = 0;
    if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }

    // Coins scale with the new level so late levels stay worth reaching.
    const reward = 10 + to * 5;
    state.coins = (state.coins || 0) + reward;
    state.totalCoinsEarned = (state.totalCoinsEarned || 0) + reward;
    state.levelAnnounced = to;

    const s = stats();
    toast(`⭐ Level ${to}! +${reward} 💰`, "coin");
    chirp("level");
    if (to >= MAX_LEVEL) {
        speak("I'm maxed out!! Level 100!!", 6000);
    } else {
        speak(`Level ${to}! I'm getting stronger!`, 4000);
    }
    if (typeof window !== "undefined" && window.spawnHearts) window.spawnHearts(to >= MAX_LEVEL ? 8 : 3);
    return s;
}

/** Renders the level badge and the XP bar. Safe to call every tick. */
export function renderLevel() {
    const p = progress();
    const badge = document.getElementById("pet-level");
    if (badge) badge.textContent = "Lv " + p.level;
    const fill = document.getElementById("xp-fill");
    if (fill) fill.style.width = (p.atMax ? 100 : Math.max(2, p.pct)) + "%";
    const label = document.getElementById("xp-label");
    if (label) label.textContent = p.atMax ? "MAX" : `${p.into} / ${p.need} XP`;
}

/** The "📊 Level & stats" menu panel body. */
export function levelPanelHtml() {
    const p = progress();
    const s = stats();
    const row = (k, v) => `<div style="display:flex; justify-content:space-between; padding:3px 0;
        font-size:12px; border-bottom:1px solid #f0f0f0;"><span>${k}</span><b>${v}</b></div>`;
    const nextAt = p.atMax ? "—" : xpForLevel(p.level + 1).toLocaleString();
    return `
      <div style="text-align:center; margin-bottom:8px;">
        <div style="font-size:30px; font-weight:800; color:#b58900;">Lv ${p.level}</div>
        <div style="font-size:11px; color:#888;">${p.atMax ? "Maximum level reached" :
            `${p.into} / ${p.need} XP to level ${p.level + 1}`}</div>
        <div style="height:8px; background:rgba(0,0,0,.12); border-radius:5px; overflow:hidden; margin-top:6px;">
          <div style="height:100%; width:${p.atMax ? 100 : Math.max(2, p.pct)}%;
               background:linear-gradient(90deg,#ffe58a,#f7d774);"></div>
        </div>
      </div>
      ${row("Total XP", (p.xp || 0).toLocaleString())}
      ${row("Next level at", nextAt)}
      ${row("❤️ Max HP", s.maxHp)}
      ${row("⚔️ Attack", s.atk)}
      ${row("🛡 Defence", s.def)}
      ${row("💨 Speed", s.spd)}
      <p style="font-size:11px; color:#888; margin-top:8px;">
        Level is earned by playing; Egg→Adult is just age. Combat stats also rise
        with personality — Attack follows playful, Defence follows affectionate,
        Speed follows curious, Max HP follows independent.
      </p>`;
}
