/* encounters.js — how fights start, and how their results get home.

   Battles run in battle.html, a separate window. Two consequences shape this
   file:

   1. window.open() from a TIMER is blocked by popup blockers. A random
      encounter therefore never opens a window itself — it raises a prompt, and
      the player's tap on "Fight!" is the user gesture that opens it.

   2. This window autosaves its whole in-memory state every 5 seconds. If the
      battle tab wrote coins and XP straight into petpal.v4, that autosave
      would overwrite them. So battle.html appends results to a separate
      one-shot key and drainBattleResults() applies and clears them here. */

import { state, save, LOCATIONS } from './state.js';
import { toast, speak, chirp } from './ui.js';
import { grantXp } from './rpg.js';
import { openModal, closeModal } from './journal.js';
import { monstersForZone, bossForZone, scaleMonster, byId, MONSTERS } from './monsters.js';
import { startBattle, battleOpen } from './battleui.js';
import { level as petLevel } from './rpg.js';

const HANDOFF = "petpal.battle.result";

/* Fights run on the pet's own stage now (battleui.js) rather than in a second
   window, so the location backdrop stays behind them and rewards apply
   directly to `state`. battle.html still works standalone if opened by hand;
   drainBattleResults() below stays so anything it left behind is still
   honoured. */
export function openBattle(kind, zone, monsterId) {
    const mon = monsterId ? byId(monsterId) : null;
    const spec = mon || pickFor(kind, zone);
    if (!spec) { toast("Nothing to fight here"); return; }
    startBattle(spec, kind);
}

function pickFor(kind, zone) {
    const z = zone || state.scene || "home";
    if (kind === "boss") return bossForZone(z);
    if (kind === "daily") {
        // deterministic per calendar day
        const day = Math.floor(Date.now() / 86400000);
        const pool = MONSTERS.filter(m => m.tier >= 2);
        return pool[day % pool.length] || MONSTERS[0];
    }
    const pool = monstersForZone(z);
    return pool[Math.floor(Math.random() * pool.length)];
}

/** Apply anything battle.html left for us. Safe to call repeatedly. */
export function drainBattleResults() {
    let queue;
    try { queue = JSON.parse(localStorage.getItem(HANDOFF) || "[]"); } catch (e) { queue = []; }
    if (!Array.isArray(queue) || !queue.length) return 0;
    localStorage.removeItem(HANDOFF);

    let xp = 0, coins = 0, wins = 0;
    for (const r of queue) {
        if (!r || typeof r !== "object") continue;
        xp += Math.max(0, r.xp | 0);
        coins += Math.max(0, r.coins | 0);
        state.huntStats = state.huntStats || { caught: 0, total: 0 };
        state.huntStats.total++;
        if (r.won) {
            wins++;
            state.huntStats.caught++;          // this is what unlocks Space
            if (r.boss && r.monsterId) {
                state.bossesCleared = state.bossesCleared || [];
                if (!state.bossesCleared.includes(r.monsterId)) state.bossesCleared.push(r.monsterId);
            }
        }
        if (r.kind === "daily" && r.won) state.lastDailyBattle = new Date().toDateString();
    }
    if (coins) { state.coins = (state.coins || 0) + coins; state.totalCoinsEarned = (state.totalCoinsEarned || 0) + coins; }
    save();
    if (xp) grantXp(xp, "battle");
    if (coins || xp) {
        toast(`Battle spoils: +${xp} XP  +${coins} 💰`, "coin");
        chirp(wins ? "level" : "sad");
    }
    if (wins) speak(queue.length > 1 ? "We won our fights!" : "We won!", 3500);
    return queue.length;
}

/* ── the Hunt action ──
   Hunt used to be a tap-the-emoji minigame that nothing in the UI linked to.
   It is now "go find a monster and fight it", which also makes the Space
   unlock (5+ hunt catches) reachable for the first time. */
export function huntFight() {
    if (battleOpen()) return;
    if (state.sleeping) { speak("... zzz"); return; }
    if (state.energy < 15) { speak("Too tired to hunt..."); return; }
    const zone = state.scene || "home";
    const pool = monstersForZone(zone);
    const mon = pool[Math.floor(Math.random() * pool.length)];
    promptFight(mon, "random", zone, `You track down a ${mon.name}!`);
}

export function bossFight() {
    const zone = state.scene || "home";
    const boss = bossForZone(zone);
    if (!boss) {
        const where = LOCATIONS.filter(l => bossForZone(l.id)).map(l => l.label).join(", ");
        toast("No boss here.");
        speak(`Bosses live at: ${where}`, 5000);
        return;
    }
    const cleared = (state.bossesCleared || []).includes(boss.id);
    promptFight(boss, "boss", zone,
        `${boss.name} blocks the way!${cleared ? " (already cleared)" : " First clear pays double."}`);
}

export function dailyFight() {
    if (state.lastDailyBattle === new Date().toDateString()) {
        toast("Daily challenge already done today");
        return;
    }
    promptFight(null, "daily", state.scene || "home", "Today's challenger is waiting!");
}

/** The prompt is what makes the popup survive a blocker: the button click is a
 *  real user gesture, a setTimeout is not. */
export function promptFight(mon, kind, zone, line) {
    const L = petLevel();
    const preview = mon ? scaleMonster(mon, L) : null;
    openModal(kind === "boss" ? "★ Boss" : kind === "daily" ? "🗓 Daily challenge" : "⚔️ Encounter!", `
      <p style="font-size:13px; margin-bottom:6px;">${line}</p>
      ${preview ? `<p style="font-size:12px; color:#888;">
         Lv ${preview.level} · ❤️ ${preview.maxHp} · ⚔️ ${preview.atk} · 🛡 ${preview.def}<br>
         <em>${mon.quip || ""}</em></p>` : ""}
      <div class="modal-actions">
        <button class="btn-secondary" id="enc-skip">Not now</button>
        <button class="btn-primary" id="enc-go">Fight!</button>
      </div>`);
    setTimeout(() => {
        const go = document.getElementById("enc-go");
        const skip = document.getElementById("enc-skip");
        if (go) go.onclick = () => { closeModal(); openBattle(kind, zone, mon ? mon.id : null); };
        if (skip) skip.onclick = () => closeModal();
    }, 50);
}

/* ── random encounters while exploring ──
   Only away from home, only while actually awake and idle, and never twice in
   quick succession. Deliberately rare: this is a care game with fights in it,
   not a game about being interrupted. */
let lastEncounter = 0;
const MIN_GAP_MS = 3 * 60 * 1000;

export function maybeRandomEncounter() {
    if (state.sleeping || !state.encountersOn || battleOpen()) return;
    const zone = state.scene || "home";
    if (zone === "home" || zone === "bath" || zone === "night") return;
    if (Date.now() - lastEncounter < MIN_GAP_MS) return;
    const modal = document.getElementById("modal-bg");
    if (modal && modal.classList.contains("show")) return;
    if (document.hidden) return;
    if (state.energy < 20) return;

    if (Math.random() < 0.012) {                 // ~1.2% per tick, so ~1 per 80s outside
        lastEncounter = Date.now();
        const pool = monstersForZone(zone);
        const mon = pool[Math.floor(Math.random() * pool.length)];
        chirp("beep");
        promptFight(mon, "random", zone, `A wild ${mon.name} appears!`);
    }
}
