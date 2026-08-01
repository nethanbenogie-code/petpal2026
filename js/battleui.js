/* battleui.js — fights that happen on the pet's own stage.

   The battle used to open battle.html in a second window. In place is better:
   the location backdrop, weather and decor stay on screen, so you fight in the
   park while it's raining rather than in a neutral box. It also deletes a whole
   class of problem — same window means rewards apply directly to `state`, with
   no cross-tab handoff and no lost-update race against the 5-second autosave.

   Combat rules live in battle.js and are shared untouched; this module is only
   presentation plus the arena. */

import * as THREE from '../vendor/three.module.js';
import { state, save, getStage } from './state.js';
import { stats as petStatsOf } from './rpg.js';
import { grantXp } from './rpg.js';
import { buildMonster, scaleMonster } from './monsters.js';
import { createBattle, playerAction, rewards, skillOf } from './battle.js';
import { buildPetModel } from './pet3d.js';
import { equippedWeapon, buildWeapon } from './weapons.js';
import { toast, speak, chirp, log as chatLog } from './ui.js';

let B = null;                 // active battle, or null
let renderer, scene, camera, petG, monG, frameId = 0;
let lungePet = 0, lungeMon = 0, shake = 0, ended = false;
let onDone = null;

export function battleActive() { return !!B && !B.over; }
export function battleOpen() { return !!B; }
/** How many transient effect meshes are alive right now — for debugging a
 *  ranged skill or a leak, nothing calls this in normal play. */
export function activeFxCount() { return fx.length; }

const $ = id => document.getElementById(id);

/* ── framing ──
   Positions are derived from what the camera can actually see, not hardcoded.
   The standalone battle.html put the two models at ±2.7 world units while the
   camera only showed ~6.3 across at that aspect, so a third of each body sat
   outside the canvas. Anything fixed here breaks the moment the stage is a
   different shape — which it is on every phone. */
/** Real half-width of a model, measured once at build time before it is moved
 *  or scaled. Guessing this is what cropped the combatants: Nebula Eater's ring
 *  is 2.0 units across the axis where a slime is 1.1, so any single assumed
 *  size clips one or floats the other. */
function measureHalfWidth(g) {
    const box = new THREE.Box3().setFromObject(g);
    return Math.max(Math.abs(box.min.x), Math.abs(box.max.x)) || 1;
}

function frameCombatants() {
    if (!camera || !petG || !monG) return;
    const visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI / 180) / 2);
    const visW = visH * camera.aspect;

    // one half of the view each, minus a margin, then scaled to whichever
    // model actually needs the most room
    const slot = visW / 4;
    const margin = visW * 0.05;
    const widest = Math.max(petG.userData.halfW || 1, monG.userData.halfW || 1);
    const s = Math.min(1, Math.max(0.28, (slot - margin) / widest));

    petG.scale.setScalar(0.95 * s);
    monG.scale.setScalar((B && B.mon.boss ? 1.05 : 0.92) * s);
    petG.position.x = -slot;
    monG.position.x = slot;
}

function initArena(monsterSpec) {
    const canvas = $("arena-canvas");
    if (!canvas) return false;
    if (!renderer) {
        try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
        catch (e) { renderer = null; return false; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 1.1, 9.0);
        camera.lookAt(0, -0.1, 0);
        scene.add(new THREE.AmbientLight(0xffffff, 1.45));
        const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(3, 6, 5); scene.add(key);
        const rim = new THREE.DirectionalLight(0x99bbff, 0.9); rim.position.set(-4, 2, -3); scene.add(rim);
        window.addEventListener("resize", resize);
    }
    if (petG) scene.remove(petG);
    if (monG) scene.remove(monG);

    petG = buildPetModel(state.color || { body: "#c9e8b5", cheek: "#f4a8b3", outline: "#2d4a1f" }).group;
    petG.position.set(0, 0, 0);
    petG.rotation.y = 0.8;

    // the weapon rides in the pet's right hand
    const wep = equippedWeapon(state);
    if (wep) {
        const wg = buildWeapon(THREE, wep);
        wg.position.set(1.05, 0.05, 0.25);
        wg.rotation.set(0.1, 0, -0.35);
        petG.add(wg);
    }
    /* Measured WITH the weapon attached: a Warhammer adds real width to the
       silhouette, and sizing off the bare pet would hang the head of it
       outside the canvas. */
    petG.userData.halfW = measureHalfWidth(petG);
    scene.add(petG);

    monG = buildMonster(THREE, monsterSpec);
    monG.userData.halfW = measureHalfWidth(monG);
    monG.position.set(2, 0, 0.1);
    monG.rotation.y = -0.7;
    scene.add(monG);

    resize();
    if (!frameId) frameId = requestAnimationFrame(loop);
    return true;
}

function resize() {
    if (!renderer) return;
    const stage = $("pet-stage");
    if (!stage) return;
    const w = stage.clientWidth || 320, h = stage.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCombatants();
}

function loop(ts) {
    frameId = requestAnimationFrame(loop);
    if (!renderer || !B) return;
    const t = ts / 1000;
    const petDown = B.pet.hp <= 0, monDown = B.mon.hp <= 0;
    if (petG) {
        petG.position.y = petDown ? -0.8 : Math.sin(t * 2.2) * 0.07;
        petG.position.x = petG.position.x + (lungePet * 0.35);
        petG.rotation.z = petDown ? 1.2 : Math.sin(t * 1.6) * 0.03;
    }
    if (monG) {
        monG.position.y = monDown ? -0.8 : Math.sin(t * 1.7 + 1) * 0.09;
        monG.position.x = monG.position.x - (lungeMon * 0.35) + (shake > 0 ? (Math.random() - .5) * 0.25 : 0);
        monG.rotation.y = -0.7 + Math.sin(t * 0.9) * 0.12;
        monG.rotation.z = monDown ? -1.2 : 0;
    }
    tickFx(ts);
    lungePet *= 0.82; lungeMon *= 0.82; if (shake > 0) shake -= 0.06;
    if (Math.abs(lungePet) < 0.01 && Math.abs(lungeMon) < 0.01) frameCombatants();
    renderer.render(scene, camera);
}

/* ── ranged effects ──────────────────────────────────────────────────────
   Zap and Beam are fired ACROSS the arena rather than swung, so they get real
   geometry between the two combatants instead of the melee lunge. Both are
   short-lived meshes added straight to the scene and torn down on a timer;
   nothing persists, so a fight that ends mid-flash cleans up with the scene. */
const fx = [];

function fxFrom() {
    // muzzle: the pet's right hand, where the weapon model is parented
    return petG ? new THREE.Vector3(petG.position.x + 0.9 * petG.scale.x,
                                    petG.position.y + 0.15, 0.3) : new THREE.Vector3(-2, 0, 0);
}
function fxTo() {
    return monG ? new THREE.Vector3(monG.position.x, monG.position.y + 0.15, 0)
                : new THREE.Vector3(2, 0, 0);
}

function addFx(obj, ms) {
    scene.add(obj);
    const rec = { obj, until: performance.now() + ms };
    fx.push(rec);
}

function tickFx(now) {
    for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i];
        const left = f.until - now;
        if (left <= 0) {
            scene.remove(f.obj);
            f.obj.traverse && f.obj.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) o.material.dispose();
            });
            fx.splice(i, 1);
        } else if (f.obj.material) {
            f.obj.material.opacity = Math.min(1, left / 120);
        }
    }
}

/** Forked lightning: a polyline jittered perpendicular to the line of fire. */
function zapEffect() {
    const a = fxFrom(), b = fxTo();
    const dir = new THREE.Vector3().subVectors(b, a);
    const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
    const make = (jitter, colour, width) => {
        const pts = [];
        const steps = 9;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = new THREE.Vector3().lerpVectors(a, b, t);
            // pinned at both ends, wildest in the middle
            const wob = Math.sin(t * Math.PI) * jitter * (Math.random() - 0.5) * 2;
            p.addScaledVector(perp, wob);
            p.z += (Math.random() - 0.5) * 0.15;
            pts.push(p);
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 1, linewidth: width });
        return new THREE.Line(geo, mat);
    };
    addFx(make(0.55, 0x7ce8ff, 3), 320);
    addFx(make(0.30, 0xffffff, 2), 260);
    addFx(make(0.85, 0x3fa8ff, 1), 220);

    // impact flash
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.9 }));
    flash.position.copy(b);
    addFx(flash, 260);
}

/** A solid beam: a cylinder rotated onto the line of fire, plus a core. */
function beamEffect() {
    const a = fxFrom(), b = fxTo();
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

    const tube = (r, colour, opacity) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14),
            new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity }));
        m.position.copy(mid);
        // cylinders point up the Y axis; swing that onto the firing direction
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return m;
    };
    addFx(tube(0.16, 0xff5f6d, 0.55), 300);
    addFx(tube(0.06, 0xffe9ec, 0.95), 300);

    const burst = new THREE.Mesh(new THREE.SphereGeometry(0.6, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0xff8a95, transparent: true, opacity: 0.85 }));
    burst.position.copy(b);
    addFx(burst, 300);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd7da, transparent: true, opacity: 0.9 }));
    muzzle.position.copy(a);
    addFx(muzzle, 200);
}

const RANGED = { w_zap: zapEffect, w_beam: beamEffect };

function floatText(txt, side, colour) {
    const host = $("battle-layer");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "bfloat";
    el.textContent = txt;
    el.style.color = colour;
    el.style.left = (side === "mon" ? 70 : 24) + "%";
    host.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

/* ── public entry ── */
export function startBattle(monsterSpec, kind, done) {
    if (B) return false;
    const ps = petStatsOf();
    ps.name = state.name || "Your pet";
    const items = [];
    for (const [id, n] of Object.entries(state.inventory || {})) {
        for (let i = 0; i < Math.min(n, 3); i++) items.push({ id, name: id, icon: "🍎" });
    }
    B = createBattle(ps, monsterSpec, { tricks: state.tricks || {}, items, weapon: equippedWeapon(state) });
    B.kind = kind || "random";
    ended = false;
    onDone = done || null;

    const layer = $("battle-layer");
    const stage = $("pet-stage");
    if (!layer || !stage) { B = null; return false; }

    if (!initArena(monsterSpec)) {
        // no WebGL — refuse rather than showing an empty stage
        B = null;
        toast("3D unavailable — can't battle here");
        return false;
    }
    stage.classList.add("battling");
    layer.classList.add("show");
    $("battle-kind").textContent =
        B.kind === "daily" ? "DAILY CHALLENGE" : monsterSpec.boss ? "★ BOSS ★" : "ENCOUNTER";
    $("blog").innerHTML = "";
    shownLog = 0;
    chirp("beep");
    render();
    return true;
}

let shownLog = 0;

function render() {
    if (!B) return;
    $("bmon-name").textContent = B.mon.name;
    $("bmon-lv").textContent = "Lv " + B.mon.level;
    $("bpet-name").textContent = B.pet.name;
    $("bpet-lv").textContent = "Lv " + B.pet.level;
    setBar("bmon-hp", B.mon.hp, B.mon.maxHp);
    setBar("bpet-hp", B.pet.hp, B.pet.maxHp);
    $("bmon-num").textContent = `${B.mon.hp}/${B.mon.maxHp}`;
    $("bpet-num").textContent = `${B.pet.hp}/${B.pet.maxHp}`;

    const logEl = $("blog");
    for (; shownLog < B.log.length; shownLog++) {
        const e = B.log[shownLog];
        const d = document.createElement("div");
        d.className = e.kind;
        d.textContent = e.text;
        logEl.appendChild(d);
    }
    logEl.scrollTop = logEl.scrollHeight;
    renderActions();
}

function setBar(id, cur, max) {
    const pct = Math.max(0, Math.round((cur / max) * 100));
    const el = $(id);
    el.style.width = pct + "%";
    el.classList.toggle("low", pct <= 25);
}

function renderActions() {
    const el = $("bactions");
    el.innerHTML = "";
    const add = (ico, label, sub, disabled, primary, fn) => {
        const b = document.createElement("button");
        if (primary) b.className = "primary";
        b.innerHTML = `<span class="bi">${ico}</span><span>${label}</span>` +
                      (sub ? `<span class="bs">${sub}</span>` : "");
        b.disabled = !!disabled || B.over;
        b.onclick = fn;
        el.appendChild(b);
    };
    add("⚔️", "Attack", "", false, true, () => act("attack"));
    for (const id of B.skills) {
        const s = skillOf(id), cd = B.cooldowns[id] || 0;
        add(s.emoji, s.name, cd ? `${cd}` : "", cd > 0, false, () => act("skill", id));
    }
    add("🍎", "Item", B.items.length ? `x${B.items.length}` : "—", !B.items.length, false, () => act("item", 0));
    add("🏃", "Flee", B.mon.boss ? "no" : "", !!B.mon.boss, false, () => act("flee"));
}

function act(action, arg) {
    if (!B || B.over) return;
    const pBefore = B.pet.hp, mBefore = B.mon.hp;
    playerAction(B, action, arg);
    const mLost = mBefore - B.mon.hp, pLost = pBefore - B.pet.hp;

    /* Ranged weapons fire across the arena instead of lunging — charging at
       something you just shot from a distance looks wrong. */
    const ranged = action === "skill" && RANGED[arg];
    if (ranged && renderer) ranged();

    if (mLost > 0) { floatText("-" + mLost, "mon", "#ffd7d7"); if (!ranged) lungePet = 1; shake = 0.35; }
    if (pLost > 0) { floatText("-" + pLost, "pet", "#ffb3a7"); lungeMon = 1; }
    if (pLost < 0) floatText("+" + (-pLost), "pet", "#9ce0ff");
    render();
    if (B.over && !ended) { ended = true; setTimeout(finish, 800); }
}

/* Rewards land straight on `state` — same window, so there is nothing to hand
   off and nothing that can race the autosave. */
function finish() {
    const boss = !!B.mon.boss;
    const firstClear = boss && !(state.bossesCleared || []).includes(B.mon.id);
    const r = rewards(B, firstClear);

    state.huntStats = state.huntStats || { caught: 0, total: 0 };
    state.huntStats.total++;
    if (B.won) {
        state.huntStats.caught++;                 // this is what unlocks Space
        if (boss) {
            state.bossesCleared = state.bossesCleared || [];
            if (!state.bossesCleared.includes(B.mon.id)) state.bossesCleared.push(B.mon.id);
        }
        if (B.kind === "daily") state.lastDailyBattle = new Date().toDateString();
    }
    // Fighting is tiring, and a loss costs more than a win.
    state.energy = Math.max(0, state.energy - (B.won ? 8 : 14));
    state.fun = Math.min(100, state.fun + (B.won ? 12 : 2));
    if (r.coins) {
        state.coins += r.coins;
        state.totalCoinsEarned += r.coins;
    }
    save();
    if (r.xp) grantXp(r.xp, "battle");

    $("bresult-title").textContent =
        B.fled ? "Got away" : B.won ? (boss ? "BOSS DEFEATED!" : "Victory!") : "Defeated…";
    $("bresult-reward").textContent =
        (r.xp || r.coins) ? `+${r.xp} XP   +${r.coins} 💰` : "No rewards";
    $("bresult-sub").textContent =
        r.firstClear ? "First clear bonus — doubled!" :
        B.fled ? "No rewards for running." :
        B.won ? "" : "Still learned something.";
    $("bresult").classList.add("show");
    chatLog("system", `${B.won ? "Beat" : "Lost to"} ${B.mon.name}`);
    chirp(B.won ? "level" : "sad");
    if (B.won) speak(boss ? "We beat the boss!!" : "We won!", 3500);
}

export function closeBattle() {
    const stage = $("pet-stage"), layer = $("battle-layer");
    if (stage) stage.classList.remove("battling");
    if (layer) layer.classList.remove("show");
    const res = $("bresult");
    if (res) res.classList.remove("show");
    if (frameId) { cancelAnimationFrame(frameId); frameId = 0; }
    for (const f of fx) { if (scene) scene.remove(f.obj); }
    fx.length = 0;
    if (petG && scene) scene.remove(petG);
    if (monG && scene) scene.remove(monG);
    petG = monG = null;
    B = null;
    if (onDone) { const f = onDone; onDone = null; f(); }
}

/** Preview line for the encounter prompt. */
export function previewOf(monsterSpec, petLvl) {
    const m = scaleMonster(monsterSpec, petLvl);
    return `Lv ${m.level} · ❤️ ${m.maxHp} · ⚔️ ${m.atk} · 🛡 ${m.def}`;
}
