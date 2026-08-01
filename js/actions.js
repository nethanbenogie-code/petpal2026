/* actions.js — Feed, water, bath, play, park, pet, medicine, sleep.
   Split out of index.html's single script block; logic unchanged. */

import { earnCoins } from './economy.js';
import { grantXp, XP } from './rpg.js';
import { updateUI } from './main.js';
import { mv, travelTo } from './petmove.js';
import { updateScene } from './scene.js';
import { SHOP_FOODS, pickReply, save, setMoodOverride, state } from './state.js';
import { chirp, log, sayShort, speak } from './ui.js';
/* ─── ACTIONS ─── */
function feed(foodId) {
    if (state.sleeping) return sayShort("... zzz");
    const food = foodId ? SHOP_FOODS.find(f => f.id === foodId) : SHOP_FOODS.find(f => f.id === "apple");
    const useInventory = food && state.inventory[food.id] > 0;
    if (!useInventory) {
        if (state.hunger > 92) { speak("I'm too full!"); state.fun = Math.max(0, state.fun - 3); return; }
        if (!state.inventory.apple) state.inventory.apple = 1;
        return feed("apple");
    }
    state.inventory[food.id]--;
    if (state.inventory[food.id] <= 0) delete state.inventory[food.id];
    for (const [k, v] of Object.entries(food.effects)) {
        state[k] = Math.min(100, state[k] + v);
    }
    state.traits.affectionate = Math.min(100, state.traits.affectionate + 0.5);
    // Scene left alone on purpose: snapping back to Home from wherever
    // the pet walked to undoes the travel animation for no reason.
    document.getElementById("pet-wrap").classList.add("eating");
    setTimeout(() => document.getElementById("pet-wrap").classList.remove("eating"), 1500);
    speak(pickReply(["Yum!", "Mmm tasty", "Thank you!", "Nom nom nom"]));
    chirp("eat");
    earnCoins(2, true);
    grantXp(XP.feed);
    log("system", `Ate ${food.name}`);
    save();
    updateUI();
}

function water() {
    if (state.sleeping) return sayShort("... zzz");
    if (state.thirst > 92) { speak("Not thirsty!"); return; }
    state.thirst = Math.min(100, state.thirst + 40);
    document.getElementById("pet-wrap").classList.add("eating");
    setTimeout(() => document.getElementById("pet-wrap").classList.remove("eating"), 1500);
    speak(pickReply(["Slurp!", "Ahhh refreshing", "Water is good"]));
    chirp("eat");
    earnCoins(2, true);
    grantXp(XP.water);
    save();
    updateUI();
}

function bath() {
    if (state.sleeping) return sayShort("... zzz");
    if (mv.traveling) return;
    const backTo = state.scene === "bath" ? "home" : state.scene;
    state.scene = "bath";
    state.clean = 100;
    state.energy = Math.max(0, state.energy - 5);
    document.getElementById("pet-wrap").classList.add("bathing");
    setTimeout(() => {
        document.getElementById("pet-wrap").classList.remove("bathing");
        // Back to wherever the pet was, not unconditionally Home.
        if (state.scene === "bath") state.scene = backTo;
        updateScene();
        save();
    }, 3500);
    updateScene();
    speak(pickReply(["Splash!", "So clean!", "Bubbles are fun"]));
    chirp("happy");
    earnCoins(3, true);
    grantXp(XP.bath);
    save();
    updateUI();
}

function play() {
    if (state.sleeping) return sayShort("... zzz");
    if (state.energy < 15) { speak("So tired... later?"); return; }
    state.fun = Math.min(100, state.fun + 25);
    state.energy = Math.max(0, state.energy - 10);
    state.hunger = Math.max(0, state.hunger - 5);
    state.traits.playful = Math.min(100, state.traits.playful + 1);
    document.getElementById("pet-wrap").classList.add("playing");
    setTimeout(() => document.getElementById("pet-wrap").classList.remove("playing"), 2000);
    spawnHearts(3);
    speak(pickReply(["Wheee!", "This is fun!", "Again again!", "I love playing!"]));
    chirp("happy");
    earnCoins(2, true);
    grantXp(XP.play);
    save();
    updateUI();
}

async function park() {
    if (state.sleeping) return sayShort("... zzz");
    if (state.energy < 25) { speak("Too sleepy for outside..."); return; }
    if (mv.traveling) return;
    state.fun = Math.min(100, state.fun + 35);
    state.energy = Math.max(0, state.energy - 20);
    state.clean = Math.max(0, state.clean - 15);
    state.hunger = Math.max(0, state.hunger - 10);
    state.thirst = Math.max(0, state.thirst - 15);
    state.traits.curious = Math.min(100, state.traits.curious + 2);
    state.memories.unshift({ desc: "visited the park", when: Date.now() });
    if (state.memories.length > 20) state.memories.pop();
    speak(pickReply(["The park!!", "I love outside!", "So many smells!"]));
    chirp("love");
    earnCoins(5, true);
    grantXp(XP.park);
    save();
    updateUI();

    await travelTo("park");
    setMoodOverride("excited", 4000);
    spawnHearts(5);
    // Head home on its own — unless it was sent somewhere else meanwhile.
    setTimeout(() => {
        if (state.scene === "park" && !mv.traveling && !state.sleeping) travelTo("home");
    }, 9000);
}

function pet() {
    if (state.sleeping) { speak("... mmm ...");
        state.fun = Math.min(100, state.fun + 3); return; }
    state.fun = Math.min(100, state.fun + 8);
    state.traits.affectionate = Math.min(100, state.traits.affectionate + 1);
    state.lastPet = Date.now();
    spawnHearts(2);
    setMoodOverride("loved", 2500);
    speak(pickReply(["<3", "So warm!", "I love you!", "*happy noises*", "You're the best"]));
    chirp("love");
    grantXp(XP.pet);
    save();
    updateUI();
}

function medicine() {
    if (state.health > 70) { speak("I feel fine!"); return; }
    state.health = Math.min(100, state.health + 40);
    state.energy = Math.max(0, state.energy - 5);
    speak(pickReply(["Ugh medicine...", "Feeling better...", "Yuck but thanks"]));
    chirp("eat");
    earnCoins(3, true);
    grantXp(XP.medicine);
    save();
    updateUI();
}

function sleep() {
    if (state.sleeping) { wakeUp("manual"); return; }
    state.sleeping = true;
    state.scene = "night";
    updateScene();
    speak("Goodnight...");
    chirp("sad");
    document.getElementById("sleep-label").textContent = "Wake";
    save();
    updateUI();
}

function wakeUp(reason) {
    state.sleeping = false;
    state.scene = "home";
    // A full night counts for more than a nap the player interrupted.
    grantXp(reason === "auto" ? XP.wake : Math.round(XP.wake / 2));
    updateScene();
    document.getElementById("sleep-label").textContent = "Sleep";
    if (reason === "auto") {
        speak(pickReply(["Yaaawn! Good morning!", "I feel great!", "*stretches*"]));
        chirp("happy");
    } else {
        if (state.energy < 40) { speak("But I'm still sleepy...");
            setMoodOverride("sad", 2000); } else { speak("Good morning!");
            chirp("happy"); }
    }
    save();
    updateUI();
}

function spawnHearts(n) {
    const c = document.getElementById("hearts");
    for (let i = 0; i < n; i++) {
        setTimeout(() => {
            const h = document.createElement("div");
            h.className = "heart";
            h.textContent = ["❤", "💕", "✨", "💖", "🌟"][Math.floor(Math.random() * 5)];
            h.style.left = (30 + Math.random() * 40) + "%";
            h.style.top = (40 + Math.random() * 20) + "%";
            c.appendChild(h);
            setTimeout(() => h.remove(), 1500);
        }, i * 200);
    }
}

export {
    bath,
    feed,
    medicine,
    park,
    pet,
    play,
    sleep,
    spawnHearts,
    wakeUp,
    water
};
