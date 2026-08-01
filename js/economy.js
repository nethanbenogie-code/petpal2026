/* economy.js — Coins, achievements, daily login streak.
   Split out of index.html's single script block; logic unchanged. */

import { updateUI } from './main.js';
import { grantXp, XP } from './rpg.js';
import { ACHIEVEMENTS, getStage, save, state } from './state.js';
import { chirp, log, toast } from './ui.js';
/* ─── COINS ─── */
function earnCoins(n, silent) {
    state.coins += n;
    state.totalCoinsEarned += n;
    if (!silent) {
        toast(`+${n} 💰`, "coin");
        chirp("coin");
    }
    checkAchievements();
    save();
    updateUI();
}

function spendCoins(n) {
    if (state.coins < n) { toast("Not enough coins!"); chirp("error"); return false; }
    state.coins -= n;
    save();
    updateUI();
    return true;
}

/* ─── ACHIEVEMENTS ─── */
function checkAchievements() {
    const a = state.achievements;
    const totalCoins = state.totalCoinsEarned || 0;
    const stage = getStage().name;
    const pmCount = state.playmates.length;
    const photoCount = state.photos.length;
    const huntCaught = state.huntStats.caught || 0;
    const msgs = state.totalMessages || 0;
    const tricks = Object.keys(state.tricks).length;
    const noteCount = state.notes.length;
    const journalCount = state.journal.length;
    const shooterScore = state.shooterHighScore || 0;

    const checks = {
        first_pet: () => true,
        level_2: () => ["Baby", "Kid", "Teen", "Adult"].includes(stage),
        level_3: () => ["Kid", "Teen", "Adult"].includes(stage),
        level_4: () => ["Teen", "Adult"].includes(stage),
        level_5: () => stage === "Adult",
        coins_100: () => totalCoins >= 100,
        coins_500: () => totalCoins >= 500,
        playmate_1: () => pmCount >= 1,
        playmate_3: () => pmCount >= 3,
        playmate_5: () => pmCount >= 5,
        photos_5: () => photoCount >= 5,
        photos_20: () => photoCount >= 20,
        hunt_10: () => huntCaught >= 10,
        hunt_50: () => huntCaught >= 50,
        chat_50: () => msgs >= 50,
        chat_200: () => msgs >= 200,
        tricks_3: () => tricks >= 3,
        tricks_6: () => tricks >= 6,
        notes_5: () => noteCount >= 5,
        journal_5: () => journalCount >= 5,
        shooter_score_100: () => shooterScore >= 100,
        shooter_score_300: () => shooterScore >= 300,
    };

    for (const [key, fn] of Object.entries(checks)) {
        if (!a[key] && fn()) {
            a[key] = Date.now();
            const info = ACHIEVEMENTS[key];
            if (info) {
                toast(`${info.icon} Achievement: ${info.label}!`, "achievement");
                chirp("level");
                earnCoins(10, true);
                grantXp(XP.achievement, info.label);
                log("system", `🏆 ${info.label} — ${info.desc}`);
            }
        }
    }
    save();
}

/* ─── DAILY LOGIN ─── */
function checkDailyLogin() {
    const today = new Date().toDateString();
    const last = state.dailyLogin.last ? new Date(state.dailyLogin.last).toDateString() : "";
    if (today !== last) {
        const streak = (new Date(state.dailyLogin.last).getTime() + 86400000 > Date.now()) ?
            state.dailyLogin.streak + 1 : 1;
        state.dailyLogin.streak = streak;
        state.dailyLogin.last = Date.now();
        state.dailyLogin.claimed = false;
        const bonus = Math.min(20 + streak * 2, 100);
        toast(`🌅 Day ${streak}! Claim ${bonus} coins!`, "coin");
        log("system", `Daily login day ${streak}`);
        if (!state.dailyLogin.claimed) {
            state.dailyLogin.claimed = true;
            earnCoins(bonus, true);
            grantXp(XP.daily * Math.min(streak, 5), `day ${streak} streak`);
            toast(`+${bonus} daily bonus!`, "coin");
        }
        save();
    }
    updateUI();
}

export {
    checkAchievements,
    checkDailyLogin,
    earnCoins,
    spendCoins
};
