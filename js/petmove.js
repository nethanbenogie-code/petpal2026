/* petmove.js — Wander/run/hop loop, travel between locations, dragging, playmates.
   Split out of index.html's single script block; logic unchanged. */

import { bath, pet } from './actions.js';
import { grantXp, XP } from './rpg.js';
import { battleOpen } from './battleui.js';
import { checkAchievements, spendCoins } from './economy.js';
import { closeModal } from './journal.js';
import { updateUI } from './main.js';
import { updateScene } from './scene.js';
import { openShop } from './shop.js';
import { DEFAULT_STATE, LOCATIONS, PLAYMATES, clamp, getStage, load, rand, save, setMoodOverride, state } from './state.js';
import { chirp, sayShort, speak, toast } from './ui.js';
/* ─── PET MOVEMENT ───────────────────────────────────────────────
   mv.x / mv.y are the pet's CENTRE, in % of the stage. The old code
   stored the top-left corner but only applied the centring transform
   on the first-ever load — and DEFAULT_STATE ships petX:50, so that
   branch never ran and the pet sat half a body down-and-right of where
   the drag clamp thought it was. One convention now: centre + a
   permanent translate(-50%,-50%) in applyPetTransform().

   The pet is symmetric, so a bare scaleX flip reads as nothing. What
   sells direction is the lean, which is why the transform carries
   both. Order matters: scale() before rotate() so the lean mirrors
   with the facing and always tips forward. */
const FLOOR_TOP = 50,
    FLOOR_BOT = 76; // % of stage — the band the pet walks in
const WALK_SPEED = 9, // % of stage width per second
    RUN_SPEED = 27;

const mv = {
    x: 50,
    y: 64,
    tx: 50,
    ty: 64,
    mode: "idle", // idle | walk | run | jump
    facing: 1,
    until: 0,
    nextDecision: 0,
    traveling: false,
    dragging: false,
};

function petWrapEl() { return document.getElementById("pet-wrap"); }

function depthScale() {
    const t = clamp((mv.y - FLOOR_TOP) / (FLOOR_BOT - FLOOR_TOP), 0, 1);
    return 0.86 + t * 0.24;
}

function applyPetTransform() {
    const wrap = petWrapEl();
    if (!wrap) return;
    const d = depthScale();
    const lean = mv.traveling || mv.mode === "run" ? 9 : mv.mode === "walk" ? 5 : 0;
    /* In 3D the model turns to face its direction of travel, so mirroring the
       wrapper on X as well would cancel that out and flip the lighting. The
       SVG still needs the flip — it has no other way to show facing. */
    const flip = wrap.classList.contains("three") ? 1 : mv.facing;
    wrap.style.left = mv.x + "%";
    wrap.style.top = mv.y + "%";
    wrap.style.transform =
        `translate(-50%, -50%) scale(${(flip * d).toFixed(3)}, ${d.toFixed(3)}) rotate(${lean}deg)`;
    wrap.style.zIndex = 10 + Math.round(mv.y);
}

let _stageRect = null,
    _stageRectAt = 0;

function stageRect() {
    const now = performance.now();
    if (!_stageRect || now - _stageRectAt > 500) {
        _stageRect = document.getElementById("pet-stage").getBoundingClientRect();
        _stageRectAt = now;
    }
    return _stageRect;
}
window.addEventListener("resize", () => { _stageRect = null; });

/* Anything that owns the pet's body for the moment. Wandering off
   mid-bath or mid-modal looks like a bug, not a personality. */
function petBusy() {
    const wrap = petWrapEl();
    if (!wrap) return true;
    if (state.sleeping || mv.dragging || document.hidden) return true;
    if (battleOpen()) return true;   // the pet is in the arena, not on the stage
    if (getStage().name === "Egg") return true;
    const modal = document.getElementById("modal-bg");
    if (modal && modal.classList.contains("show")) return true;
    return ["eating", "bathing", "playing", "spin", "dance", "jump"]
        .some(c => wrap.classList.contains(c));
}

/* Derived, not hardcoded: #pet-wrap is 55% of the stage capped at
   180px, so its share of the width changes a lot between a phone and a
   desktop. The arms reach 35% of the box half-width past centre
   (cx 60 + rx 10 of a 200-unit viewBox), which is what has to stay
   on screen — the body alone is only 27.5%. */
function walkMarginX() {
    const r = stageRect();
    const w = petWrapEl().offsetWidth;
    if (!r.width || !w) return 18;
    return clamp((w * 0.35 / r.width) * 100, 8, 30);
}

function pickWanderTarget(reach) {
    const m = walkMarginX();
    const curious = ((state.traits && state.traits.curious) || 20) / 100;
    const spread = (20 + curious * 45) * (reach || 1);
    let tx = mv.x + (Math.random() * 2 - 1) * spread;
    if (tx < m || tx > 100 - m) tx = 50 + (Math.random() * 2 - 1) * 28;
    mv.tx = clamp(tx, m, 100 - m);
    mv.ty = clamp(mv.y + (Math.random() * 2 - 1) * 14, FLOOR_TOP, FLOOR_BOT);
}

function decideNextAction(now) {
    const traits = state.traits || {};
    const playful = (traits.playful || 20) / 100;
    const independent = (traits.independent || 30) / 100;

    if (state.energy < 15) { // too tired to do much but stand there
        mv.mode = "idle";
        mv.nextDecision = now + rand(5000, 11000);
        return;
    }

    const jumpChance = state.fun < 40 ? 0.05 : 0.06 + playful * 0.08;
    const runChance = state.energy > 55 ? 0.15 + playful * 0.22 : 0.04;
    const stayChance = 0.30 - independent * 0.15;
    const roll = Math.random();

    if (roll < jumpChance) {
        /* No setTimeout to take the class off again: the loop owns the
           hop's lifetime via mv.until, so a throttled timer can't leave
           the pet stuck mid-air. */
        mv.mode = "hop";
        mv.until = now + 820;
        petWrapEl().classList.add("hop");
    } else if (roll < jumpChance + runChance) {
        pickWanderTarget(1.9);
        mv.mode = "run";
    } else if (roll < jumpChance + runChance + stayChance) {
        mv.mode = "idle";
        mv.nextDecision = now + rand(3000, 8000);
    } else {
        pickWanderTarget(1);
        mv.mode = "walk";
    }
}

/* One step toward (tx, ty). Y is converted through the stage aspect so
   a diagonal walk covers ground at the same rate as a flat one —
   without it the pet crawls sideways and darts vertically. */
function stepToward(dt, speedPct) {
    const r = stageRect();
    const aspect = r.height > 0 ? r.width / r.height : 1;
    const dx = mv.tx - mv.x;
    const dy = (mv.ty - mv.y) / aspect;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) { mv.x = mv.tx; mv.y = mv.ty; return true; }
    if (Math.abs(dx) > 0.4) mv.facing = dx > 0 ? 1 : -1;
    const step = speedPct * dt;
    if (step >= dist) { mv.x = mv.tx; mv.y = mv.ty; return true; }
    mv.x += (dx / dist) * step;
    mv.y += (dy / dist) * step * aspect;
    return false;
}

function setGaitClass() {
    const wrap = petWrapEl();
    const running = mv.traveling || mv.mode === "run";
    wrap.classList.toggle("running", running);
    wrap.classList.toggle("walking", !running && mv.mode === "walk");
}

let _lastFrame = 0;

function movementFrame(ts) {
    requestAnimationFrame(movementFrame);
    const dt = Math.min(0.05, (ts - _lastFrame) / 1000);
    _lastFrame = ts;
    if (dt <= 0) return;
    if (!petWrapEl()) return;

    if (mv.traveling) {
        stepToward(dt, RUN_SPEED * 1.2);
        setGaitClass();
        applyPetTransform();
        positionPlaymates();
        return;
    }

    if (petBusy()) {
        if (mv.mode !== "idle") {
            mv.mode = "idle";
            petWrapEl().classList.remove("hop");
            mv.nextDecision = ts + rand(600, 1800);
        }
        setGaitClass();
        return;
    }

    const now = ts;

    if (mv.mode === "hop") {
        if (now >= mv.until) {
            petWrapEl().classList.remove("hop");
            mv.mode = "idle";
            mv.nextDecision = now + rand(1200, 4000);
        }
    } else if (mv.mode === "walk" || mv.mode === "run") {
        const arrived = stepToward(dt, mv.mode === "run" ? RUN_SPEED : WALK_SPEED);
        if (mv.mode === "run") state.energy = Math.max(0, state.energy - dt * 0.35);
        if (arrived) {
            mv.mode = "idle";
            mv.nextDecision = now + rand(900, 3500);
        }
    } else if (now >= mv.nextDecision) {
        decideNextAction(now);
    }

    setGaitClass();
    applyPetTransform();
    positionPlaymates();
}

/* ─── TRAVEL BETWEEN LOCATIONS ───
   Walk out the nearer edge, hold a tinted veil over the swap, walk in
   from the other side. The pet is allowed outside 0–100 here; the
   stage is overflow:hidden so it simply clips. */
function waitMs(ms) { return new Promise(r => setTimeout(r, ms)); }

/* Polls on a timer, NOT requestAnimationFrame. rAF is suspended while
   the tab is hidden, so an rAF-driven wait could never reach its own
   timeout — backgrounding the app mid-journey left mv.traveling stuck
   true and the pet frozen off-stage for the rest of the session.
   setTimeout still fires (throttled), so the timeout always lands. */
function waitUntilArrived(timeoutMs) {
    return new Promise(resolve => {
        const t0 = performance.now();
        (function check() {
            if (Math.hypot(mv.tx - mv.x, mv.ty - mv.y) < 1.5 ||
                performance.now() - t0 > timeoutMs) return resolve();
            setTimeout(check, 32);
        })();
    });
}

async function travelTo(locId) {
    const loc = LOCATIONS.find(l => l.id === locId);
    if (!loc || mv.traveling) return false;
    if (state.scene === locId) return false;
    if (getStage().name === "Egg") { // an egg has no legs
        state.scene = locId;
        save();
        updateScene();
        return true;
    }

    const wrap = petWrapEl();
    const veil = document.getElementById("travel-veil");
    mv.traveling = true;
    mv.dragging = false;
    wrap.classList.remove("dragging", "hop");

    const exitRight = mv.x >= 50;
    mv.tx = exitRight ? 128 : -28;
    mv.ty = clamp(mv.y, FLOOR_TOP, FLOOR_BOT);
    await waitUntilArrived(2500);

    if (veil) {
        veil.style.background = loc.tint || "#ffffff";
        veil.classList.add("on");
    }
    await waitMs(370);

    state.scene = locId;
    save();
    updateScene();

    mv.x = exitRight ? -28 : 128;
    mv.facing = exitRight ? 1 : -1;
    mv.tx = rand(26, 74);
    mv.ty = rand(FLOOR_TOP + 4, FLOOR_BOT);
    applyPetTransform();
    positionPlaymates(true);

    if (veil) veil.classList.remove("on");
    await waitMs(140);
    await waitUntilArrived(3000);

    // If the walk-in timed out (hidden tab, suspended rAF), don't leave
    // the pet parked off the edge of the stage.
    if (Math.hypot(mv.tx - mv.x, mv.ty - mv.y) >= 1.5) {
        mv.x = mv.tx;
        mv.y = mv.ty;
    }
    mv.traveling = false;
    mv.mode = "idle";
    mv.nextDecision = performance.now() + rand(700, 2000);
    setGaitClass();
    applyPetTransform();
    return true;
}

/* ─── DRAGGABLE PET ─── */
function initDraggable() {
    const wrap = petWrapEl();
    const stage = document.getElementById("pet-stage");
    let downAt = 0,
        movedPx = 0,
        lastClientX = 0,
        lastClientY = 0;

    function point(e) {
        const t = e.touches && e.touches[0];
        return { x: t ? t.clientX : e.clientX, y: t ? t.clientY : e.clientY };
    }

    function onStart(e) {
        e.preventDefault();
        const p = point(e);
        downAt = Date.now();
        movedPx = 0;
        lastClientX = p.x;
        lastClientY = p.y;
        mv.dragging = true;
        mv.mode = "idle";
        wrap.classList.remove("hop");
        wrap.classList.add("dragging");
        setGaitClass();
    }

    function onMove(e) {
        if (!mv.dragging) return;
        e.preventDefault();
        const p = point(e);
        movedPx += Math.hypot(p.x - lastClientX, p.y - lastClientY);
        lastClientX = p.x;
        lastClientY = p.y;
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const halfW = (wrap.offsetWidth / 2 / rect.width) * 100;
        const halfH = (wrap.offsetHeight / 2 / rect.height) * 100;
        mv.x = clamp(((p.x - rect.left) / rect.width) * 100, halfW, 100 - halfW);
        mv.y = clamp(((p.y - rect.top) / rect.height) * 100, halfH, 100 - halfH);
        mv.tx = mv.x;
        mv.ty = mv.y;
        applyPetTransform();
        positionPlaymates();
    }

    function onEnd() {
        if (!mv.dragging) return;
        mv.dragging = false;
        wrap.classList.remove("dragging");
        // Settle back into the walkable band, then carry on wandering.
        const m = walkMarginX();
        mv.ty = clamp(mv.y, FLOOR_TOP, FLOOR_BOT);
        mv.tx = clamp(mv.x, m, 100 - m);
        mv.mode = (Math.abs(mv.ty - mv.y) > 1 || Math.abs(mv.tx - mv.x) > 1) ? "walk" : "idle";
        mv.nextDecision = performance.now() + rand(800, 2200);
        state.petX = mv.x;
        state.petY = mv.y;
        save();
        // A tap that never really moved is a pet, not a drag.
        if (movedPx < 8 && Date.now() - downAt < 600) pet();
    }

    wrap.addEventListener("mousedown", onStart);
    wrap.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);

    mv.x = clamp(typeof state.petX === "number" ? state.petX : 50, 20, 80);
    mv.y = clamp(typeof state.petY === "number" ? state.petY : 64, FLOOR_TOP, FLOOR_BOT);
    mv.tx = mv.x;
    mv.ty = mv.y;
    mv.nextDecision = performance.now() + 1200;
    applyPetTransform();
    requestAnimationFrame(movementFrame);
}

/* ─── PLAYMATES ─── */
/* Split in two: renderPlaymates() rebuilds the DOM only when the roster
   changes, positionPlaymates() just moves them. Rebuilding every frame
   to follow a walking pet would restart floatMate on all of them. */
let _playmateSig = "";

function renderPlaymates(force) {
    const scene = document.getElementById("scene");
    const sig = state.playmates.map(p => p.id).join(",");
    const nodes = scene.querySelectorAll(".playmate");
    if (!force && sig === _playmateSig && nodes.length === state.playmates.length) {
        positionPlaymates(true);
        return;
    }
    _playmateSig = sig;
    nodes.forEach(el => el.remove());
    state.playmates.forEach((pm, idx) => {
        const div = document.createElement("div");
        div.className = "playmate" + (idx === 0 ? " follow" : "");
        div.textContent = pm.icon;
        const label = document.createElement("span");
        label.className = "mate-label";
        label.textContent = pm.name;
        div.appendChild(label);
        div.style.fontSize = Math.max(20, 34 - idx * 2) + "px";
        div.style.zIndex = 5 - idx;
        scene.appendChild(div);
    });
    positionPlaymates(true);
}

let _pmLastX = -999,
    _pmLastY = -999;

function positionPlaymates(force) {
    if (!force && Math.abs(mv.x - _pmLastX) < 1.2 && Math.abs(mv.y - _pmLastY) < 1.2) return;
    _pmLastX = mv.x;
    _pmLastY = mv.y;
    const nodes = document.querySelectorAll(".playmate");
    const n = Math.max(1, nodes.length);
    nodes.forEach((div, idx) => {
        const angle = (idx / n) * Math.PI * 2 - Math.PI / 2;
        const dist = 60 + idx * 8;
        div.style.left = `calc(${mv.x}% + ${(Math.cos(angle) * dist).toFixed(1)}px)`;
        div.style.top = `calc(${mv.y}% + ${(Math.sin(angle) * dist).toFixed(1)}px)`;
    });
}

function buyPlaymate(id) {
    const pm = PLAYMATES.find(p => p.id === id);
    if (!pm) return;
    if (state.playmates.some(p => p.id === id)) { toast("Already have this playmate!"); return; }
    if (!spendCoins(pm.price)) return;
    state.playmates.push({ id: pm.id, name: pm.name, icon: pm.icon, color: pm.color, x: 0, y: 0 });
    save();
    toast(`🐾 ${pm.name} joined!`, "coin");
    chirp("love");
    checkAchievements();
    updateUI();
    renderPlaymates();
    openShop();
}

async function changeLocation(locId) {
    if (!state.locationUnlocked.includes(locId)) { toast("🔒 Locked! Keep playing."); return; }
    if (state.sleeping) { sayShort("... zzz"); return; }
    if (mv.traveling) { toast("Already on the way!"); return; }
    const label = LOCATIONS.find(l => l.id === locId)?.label || locId;
    if (state.scene === locId) { toast(`Already at ${label}`); closeModal(); return; }
    closeModal();
    speak(`Let's go to ${label}!`);
    chirp("happy");
    await travelTo(locId);
    setMoodOverride("excited", 3000);
    state.fun = Math.min(100, state.fun + 6);
    state.traits.curious = Math.min(100, state.traits.curious + 1);
    state.memories.unshift({ desc: `went to ${label}`, when: Date.now() });
    if (state.memories.length > 20) state.memories.pop();
    grantXp(XP.travel, "explored " + label);
    save();
    updateUI();
}

export {
    FLOOR_BOT,
    FLOOR_TOP,
    RUN_SPEED,
    WALK_SPEED,
    _lastFrame,
    _playmateSig,
    _pmLastX,
    _pmLastY,
    _stageRect,
    _stageRectAt,
    applyPetTransform,
    buyPlaymate,
    changeLocation,
    decideNextAction,
    depthScale,
    initDraggable,
    movementFrame,
    mv,
    petBusy,
    petWrapEl,
    pickWanderTarget,
    positionPlaymates,
    renderPlaymates,
    setGaitClass,
    stageRect,
    stepToward,
    travelTo,
    waitMs,
    waitUntilArrived,
    walkMarginX
};
