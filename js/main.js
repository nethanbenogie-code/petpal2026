/* main.js — UI refresh, the one-second tick, event bindings, boot.
   Split out of index.html's single script block; logic unchanged. */

import { bath, feed, medicine, park, pet, play, sleep, spawnHearts, wakeUp, water } from './actions.js';
import { generateSpontaneous, handleUserMessage } from './chat.js';
import { checkAchievements, checkDailyLogin, earnCoins } from './economy.js';
import { closeModal, deleteAppt, deleteContact, deleteJournal, deleteNote, openJournal, openModal, sendNotification } from './journal.js';
import { clearPhotos, deletePhoto, openGallery, startHunt, takePhoto } from './media.js';
import { openMenu } from './menu.js';
import { openGames, playCatch, playMemory } from './minigames.js';
import { buyPlaymate, changeLocation, initDraggable } from './petmove.js';
import { drawPet, updateScene, updateWeather } from './scene.js';
import { launchShooter, shooter } from './shooter.js';
import { openShop } from './shop.js';
import { DRAIN, STAT_KEYS, STAT_LABELS, STORAGE_KEY, ageInHours, getMood, getStage, getTimeOfDay, load, save, state } from './state.js';
import { startTraining } from './tricks.js';
import { chirp, initAudio, initTTS, isBubbleShowing, log, speak, toast, toggleListen } from './ui.js';
import { start as start3d, stop as stop3d, is3dActive } from './pet3d.js';
import { renderLevel } from './rpg.js';
import { drainBattleResults, huntFight, bossFight, dailyFight, maybeRandomEncounter, openBattle } from './encounters.js';

/* Switches the pet between the three.js canvas and the SVG. The `three` class
   on #pet-wrap is the single source of truth: CSS shows the right element and
   applyPetTransform() reads it to decide whether to mirror for facing. If
   WebGL can't start, we stay on the SVG and say so rather than showing an
   empty box. */
function applyRenderMode() {
    const wrap = document.getElementById("pet-wrap");
    if (!wrap) return;
    if (state.render3d) {
        const ok = start3d();
        wrap.classList.toggle("three", ok);
        if (!ok) {
            state.render3d = false;
            save();
            toast("3D unavailable here — using classic pet");
        }
    } else {
        if (is3dActive()) stop3d();
        wrap.classList.remove("three");
    }
    drawPet(true);
}
/* ─── UI UPDATE ─── */
function updateUI() {
    document.getElementById("pet-name").textContent = state.name;
    const stage = getStage();
    document.getElementById("pet-age").textContent = stage.name;
    document.getElementById("stage-tag").textContent = stage.name;
    document.getElementById("mood-tag").textContent = state.sleeping ? "asleep" : getMood();
    document.getElementById("coin-count").textContent = state.coins;
    renderLevel();

    const statsEl = document.getElementById("stats");
    statsEl.innerHTML = STAT_KEYS.map(k => {
        const v = Math.round(state[k]);
        let cls = "";
        if (v < 25) cls = "low";
        else if (v < 50) cls = "mid";
        return `<div class="stat">
      <div class="stat-label"><span>${STAT_LABELS[k]}</span><span>${v}</span></div>
      <div class="stat-bar"><div class="stat-fill ${cls}" style="width:${v}%"></div></div>
    </div>`;
    }).join("");

    drawPet();

    /* .sleeping / .happy / .sad were styled but never applied — the
       sleep-breathing and sad-sway animations had no way to fire.
       The walk/run rules sit after these in the stylesheet, so a
       moving pet still gets its gait. */
    const wrap = document.getElementById("pet-wrap");
    const mood = state.sleeping ? "asleep" : getMood();
    wrap.classList.toggle("sleeping", !!state.sleeping);
    wrap.classList.toggle("happy", mood === "happy" || mood === "loved" || mood === "excited");
    wrap.classList.toggle("sad", mood === "sad" || mood === "sick");

    document.getElementById("sleep-label").textContent = state.sleeping ? "Wake" : "Sleep";
    updateScene();
}

/* ─── TICK ─── */
function tick() {
    const now = Date.now();
    const dtSec = Math.min(60, (now - state.lastTick) / 1000);
    state.lastTick = now;
    const tod = getTimeOfDay();
    const isNight = tod === "night";

    if (state.sleeping) {
        state.energy = Math.min(100, state.energy + dtSec * 0.5);
        state.hunger = Math.max(0, state.hunger - dtSec * DRAIN.hunger * 0.3);
        state.thirst = Math.max(0, state.thirst - dtSec * DRAIN.thirst * 0.3);
        if (state.energy >= 100 && Math.random() < 0.02) wakeUp("auto");
    } else {
        for (const k of STAT_KEYS) {
            if (k === "health") continue;
            let mult = 1;
            if (k === "energy" && isNight) mult = 2;
            state[k] = Math.max(0, state[k] - dtSec * DRAIN[k] * mult);
        }
    }

    if (state.hunger < 15 || state.thirst < 10 || state.clean < 10) {
        state.health = Math.max(0, state.health - dtSec * 0.3);
    } else if (state.hunger > 60 && state.thirst > 60 && state.clean > 60) {
        state.health = Math.min(100, state.health + dtSec * 0.1);
    }

    const timeSinceLastPet = (Date.now() - (state.lastPet || state.born)) / (1000 * 60 * 60);
    if (timeSinceLastPet > 4) {
        state.traits.independent = Math.min(100, state.traits.independent + 0.01);
        state.traits.affectionate = Math.max(0, state.traits.affectionate - 0.005);
    }

    const curStage = getStage().name;
    if (curStage !== state.stageAnnounced) {
        state.stageAnnounced = curStage;
        state.coins += 50;
        toast(`${state.name} grew into a ${curStage}! +50 coins`, "coin");
        chirp("level");
        log("system", `Grew into ${curStage}`);
        checkAchievements();
    }

    const timeSinceLastChat = (Date.now() - (state.lastAutoChat || 0)) / 1000;
    const chatChance = (state.traits.talkative / 100) * 0.02;
    if (!state.sleeping && timeSinceLastChat > 20 && Math.random() < chatChance && !isBubbleShowing()) {
        speak(generateSpontaneous(), 3000);
        state.lastAutoChat = Date.now();
    }

    if (document.hidden && state.notificationsEnabled) {
        const critical = state.hunger < 20 || state.thirst < 15 || state.health < 30 || state.clean < 15;
        if (critical && Date.now() - state.lastNotifyAt > 5 * 60 * 1000) {
            sendNotification();
            state.lastNotifyAt = Date.now();
        }
    }

    updateWeather();
    maybeRandomEncounter();
    updateUI();
    save();
}

/* ─── BINDINGS ─── */
/* battle.html imports state.js, and state.js -> actions.js -> main.js drags
   this whole module in with it. Everything below wires up index.html's chrome,
   which does not exist there, so it is gated on the app shell being present.
   Without the gate the import throws on the first null element and the
   importing page renders nothing at all — silently, because a module that
   fails to evaluate logs no error of its own. */
const IS_APP_SHELL = !!document.getElementById("pet-stage");

if (IS_APP_SHELL) document.querySelectorAll(".action").forEach(btn => {
    btn.addEventListener("click", () => {
        const act = btn.dataset.act;
        if (act === "feed") feed();
        else if (act === "water") water();
        else if (act === "bath") bath();
        else if (act === "play") play();
        else if (act === "park") park();
        else if (act === "pet") pet();
        else if (act === "medicine") medicine();
        else if (act === "sleep") sleep();
        else if (act === "hunt") huntFight();
        else if (act === "game") openGames();
        else if (act === "shooter") { closeModal();
            launchShooter(); }
        updateUI();
        save();
    });
});

const chatInput = document.getElementById("chat-input");

function sendChat() {
    if (!chatInput) return;
    const v = chatInput.value.trim();
    if (!v) return;
    chatInput.value = "";
    handleUserMessage(v);
    updateUI();
    save();
}

if (IS_APP_SHELL) {
    document.getElementById("send-btn").addEventListener("click", sendChat);
    chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
    document.getElementById("mic-btn").onclick = () => { initAudio();
        toggleListen(); };
    document.getElementById("menu-btn").onclick = openMenu;
    document.getElementById("shop-btn").onclick = openShop;
    document.getElementById("camera-btn").onclick = takePhoto;
    document.getElementById("journal-btn").onclick = openJournal;
}
/* #pet is pointer-events:none, so the click listener that used to live
   here never fired — tapping the pet did nothing. Petting is now
   triggered from the drag handler's tap branch in initDraggable(),
   which can tell a tap from a drag. */

/* ─── INIT ─── */
if (IS_APP_SHELL && state.totalMessages === 0 && state.name === "Blob" && !localStorage.getItem(STORAGE_KEY)) {
    save();
    setTimeout(() => {
        openModal("🐣 Welcome!", `
      <p>Name your new pet:</p>
      <input type="text" id="init-name" maxlength="16" value="Blob" />
      <div class="modal-actions">
        <button class="btn-primary" id="init-ok" style="width:100%;">Hatch egg</button>
      </div>
    `);
        setTimeout(() => {
            const inp = document.getElementById("init-name");
            inp.focus();
            inp.select();
            document.getElementById("init-ok").onclick = () => {
                const v = inp.value.trim();
                if (v) state.name = v.slice(0, 16);
                state.locationUnlocked = ["home", "park", "bath"];
                save();
                updateUI();
                closeModal();
                setTimeout(() => {
                    speak(`Hi! I'm ${state.name}! Take care of me?`, 5000);
                    log("system", `${state.name} was born!`);
                    checkAchievements();
                }, 500);
            };
            inp.onkeydown = (e) => { if (e.key === "Enter") document.getElementById("init-ok").click(); };
        }, 50);
    }, 300);
}

if (IS_APP_SHELL) {
    checkDailyLogin();
    initTTS();
    updateScene();
    updateUI();
    initDraggable();
    applyRenderMode();

    /* Battle results are written by battle.html into a separate key. Drain them
       on boot, whenever this window regains focus, and on the storage event
       that fires when the other tab writes — whichever happens first. */
    drainBattleResults();
    window.addEventListener("focus", drainBattleResults);
    window.addEventListener("storage", (e) => {
        if (e.key === "petpal.battle.result" && e.newValue) drainBattleResults();
    });
}

if (IS_APP_SHELL) setTimeout(() => {
    // Migration: saves made before these places existed keep their old
    // unlock list, so the always-available ones are backfilled here.
    ["home", "park", "bath", "hospital"].forEach(id => {
        if (!state.locationUnlocked.includes(id)) { state.locationUnlocked.push(id);
            save(); }
    });
    if (state.totalMessages > 10 && !state.locationUnlocked.includes("school")) { state.locationUnlocked.push(
            "school");
        save(); }
    if (state.totalCoinsEarned > 60 && !state.locationUnlocked.includes("mall")) { state.locationUnlocked.push(
            "mall");
        save(); }
    if (state.tricksLearned > 2 && !state.locationUnlocked.includes("lab")) { state.locationUnlocked.push("lab");
        save(); }
    if (ageInHours() > 5 && !state.locationUnlocked.includes("beach")) { state.locationUnlocked.push("beach");
        save(); }
    if (ageInHours() > 12 && !state.locationUnlocked.includes("forest")) { state.locationUnlocked.push("forest");
        save(); }
    if (state.totalMessages > 30 && !state.locationUnlocked.includes("city")) { state.locationUnlocked.push("city");
        save(); }
    if (state.totalCoinsEarned > 100 && !state.locationUnlocked.includes("mountain")) { state.locationUnlocked.push(
            "mountain");
        save(); }
    if (state.huntStats.caught > 5 && !state.locationUnlocked.includes("space")) { state.locationUnlocked.push(
            "space");
        save(); }
    if (state.photos.length > 3 && !state.locationUnlocked.includes("snow")) { state.locationUnlocked.push("snow");
        save(); }
    if (state.playmates.length > 2 && !state.locationUnlocked.includes("rain")) { state.locationUnlocked.push("rain");
        save(); }
}, 1000);

if (IS_APP_SHELL) {
    setInterval(tick, 1000);
    setInterval(drawPet, 500);
    setInterval(save, 5000);
}

if (IS_APP_SHELL) document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { tick();
        updateUI(); }
});

if (IS_APP_SHELL && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => {});
    });
}

// Expose for inline
window.feed = feed;
window.water = water;
window.bath = bath;
window.play = play;
window.park = park;
window.pet = pet;
window.medicine = medicine;
window.sleep = sleep;
window.startHunt = startHunt;
window.openGames = openGames;
window.openShop = openShop;
window.openMenu = openMenu;
window.takePhoto = takePhoto;
window.openGallery = openGallery;
window.clearPhotos = clearPhotos;
window.deletePhoto = deletePhoto;
window.startTraining = startTraining;
window.closeModal = closeModal;
window.openModal = openModal;
window.changeLocation = changeLocation;
window.toast = toast;
window.speak = speak;
window.spawnHearts = spawnHearts;
window.earnCoins = earnCoins;
window.buyPlaymate = buyPlaymate;
window.checkAchievements = checkAchievements;
window.playCatch = playCatch;
window.playMemory = playMemory;
window.launchShooter = launchShooter;
window.openJournal = openJournal;
window.save = save;
window.deleteNote = deleteNote;
window.deleteAppt = deleteAppt;
window.deleteContact = deleteContact;
window.deleteJournal = deleteJournal;

/* Gated, and not merely for tidiness: these were the ONLY statements in this
   module that read `state` during evaluation, and that made the import cycle
   state.js -> actions.js -> main.js -> state.js fatal for any entry point
   other than main.js. battle.html imports state.js first, so main.js ran while
   state.js was still part-way through its own body and `state` was in the
   temporal dead zone — "Cannot access 'state' before initialization", which
   surfaced only as a blank page. ES modules tolerate cycles perfectly well as
   long as nothing touches another module's bindings *while it is evaluating*;
   function bodies are fine because they run later. Keep it that way. */
if (IS_APP_SHELL) {
    console.log("🐾 PetPal v4 loaded! Journal, Notes, Contacts, Appointments + Twin-Bee Shooter");
    console.log(`💰 ${state.coins} coins | 📸 ${state.photos.length} photos | 📓 ${state.notes.length} notes`);
    console.log(`🚀 High score: ${state.shooterHighScore}`);
}

window.applyRenderMode = applyRenderMode;
window.huntFight = huntFight;
window.bossFight = bossFight;
window.dailyFight = dailyFight;
window.openBattle = openBattle;

export {
    applyRenderMode,
    chatInput,
    sendChat,
    tick,
    updateUI
};
