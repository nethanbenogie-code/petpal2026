/* pet3d.js — the pet rendered as a real 3D model with three.js.

   Sits INSIDE #pet-wrap alongside the SVG rather than replacing the stage, so
   every existing system keeps working untouched: the wander loop still moves
   #pet-wrap in percent, travel still walks it off the edge, dragging still
   drags it, and the depth scale still applies. Only the artwork changes.

   The payoff over the SVG is turning. The SVG pet is bilaterally symmetric, so
   the scaleX(-1) facing flip was very nearly invisible; here the model actually
   rotates to face where it is walking, and the limbs swing in depth.

   Falls back silently to the SVG if WebGL is unavailable — see start(). */

import * as THREE from '../vendor/three.module.js';
import { state, getStage, getMood } from './state.js';
import { mv } from './petmove.js';

let renderer = null, scene = null, camera = null;
let root = null, parts = null, frameId = 0;
let failed = false;
let lastSig = "";

export function is3dActive() { return !!renderer; }
export function has3dFailed() { return failed; }

/* ── model ───────────────────────────────────────────────────────────────
   Built from primitives so it recolours per pet exactly like the SVG does,
   with no asset files to ship.

   Exported as buildPetModel so the battle screen can put the very same pet in
   its arena rather than keeping a second, drifting copy of the model. */
export function buildPetModel(colors) { return buildPet(colors); }

function buildPet(colors) {
    const g = new THREE.Group();
    const body = new THREE.Color(colors.body);
    const outline = new THREE.Color(colors.outline);
    const cheek = new THREE.Color(colors.cheek);

    const skin = new THREE.MeshStandardMaterial({ color: body, roughness: 0.75, metalness: 0.0 });
    const dark = new THREE.MeshStandardMaterial({ color: outline, roughness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const blush = new THREE.MeshStandardMaterial({ color: cheek, roughness: 0.9, transparent: true, opacity: 0.85 });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 30), skin);
    torso.scale.set(1, 0.95, 0.9);
    g.add(torso);

    // belly highlight — the SVG's white ellipse, given volume
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, transparent: true, opacity: 0.35 }));
    shine.position.set(-0.36, 0.34, 0.72);
    shine.scale.set(1, 0.6, 0.4);
    g.add(shine);

    const eyeL = new THREE.Group(), eyeR = new THREE.Group();
    for (const [grp, sx] of [[eyeL, -1], [eyeR, 1]]) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), white);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), dark);
        pupil.position.z = 0.11;
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), white);
        spark.position.set(0.04, 0.05, 0.2);
        grp.add(ball, pupil, spark);
        grp.position.set(sx * 0.32, 0.18, 0.82);
        g.add(grp);
    }

    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12),
        new THREE.MeshStandardMaterial({ color: 0x5a1830, roughness: 0.8 }));
    mouth.position.set(0, -0.16, 0.88);
    mouth.scale.set(1, 0.55, 0.4);
    g.add(mouth);

    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), blush);
    cheekL.position.set(-0.62, -0.04, 0.62); cheekL.scale.set(1, 0.62, 0.35);
    const cheekR = cheekL.clone(); cheekR.position.x = 0.62;
    g.add(cheekL, cheekR);

    const limb = new THREE.CapsuleGeometry(0.15, 0.22, 6, 14);
    const armL = new THREE.Mesh(limb, skin), armR = new THREE.Mesh(limb, skin);
    armL.position.set(-1.0, 0.02, 0); armR.position.set(1.0, 0.02, 0);
    armL.rotation.z = 0.5; armR.rotation.z = -0.5;
    g.add(armL, armR);

    const legGeo = new THREE.CapsuleGeometry(0.19, 0.16, 6, 14);
    const legL = new THREE.Mesh(legGeo, dark), legR = new THREE.Mesh(legGeo, dark);
    legL.position.set(-0.38, -0.95, 0.05); legR.position.set(0.38, -0.95, 0.05);
    g.add(legL, legR);

    let antenna = null;
    if (getStage().name === "Adult") {
        antenna = new THREE.Group();
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), dark);
        stalk.position.y = 0.21;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), blush);
        bulb.position.y = 0.46;
        antenna.add(stalk, bulb);
        antenna.position.y = 0.92;
        g.add(antenna);
    }

    // equipped hat / glasses / neckwear
    for (const slot of ["hat", "eyes", "neck"]) {
        const spec = ACC3D[state.equipped && state.equipped[slot]];
        if (spec) g.add(buildAccessory(spec));
    }

    // contact shadow — a flat disc, keeps the pet from floating
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.22;
    g.add(shadow);

    return { group: g, torso, eyeL, eyeR, mouth, armL, armR, legL, legR, antenna, shadow };
}

/* ── accessories in 3D ────────────────────────────────────────────────────
   These existed only as SVG, so with the 3D pet on — which is the default —
   buying and equipping a hat changed absolutely nothing on screen. Mount
   points are read off the model above: the head crests at y≈0.95, the eyes sit
   at (±0.32, 0.18, 0.82) and bulge to z≈1.0, the body's base is near y=-0.9. */
const ACC3D = {
    tophat: { parts: [
        { geo: "cylinder", r: 0.62, h: 0.07, pos: [0, 0.95, 0], col: 0x1a1a1a },
        { geo: "cylinder", r: 0.4, h: 0.62, pos: [0, 1.29, 0], col: 0x1a1a1a },
        { geo: "cylinder", r: 0.41, h: 0.12, pos: [0, 1.06, 0], col: 0xd64545 },
    ] },
    crown: { parts: [
        { geo: "cylinder", r: 0.44, h: 0.16, pos: [0, 1.0, 0], col: 0xf7d774 },
        { geo: "cone", r: 0.12, h: 0.34, pos: [0, 1.25, 0], col: 0xf7d774 },
        { geo: "cone", r: 0.11, h: 0.28, pos: [-0.31, 1.2, 0], col: 0xf7d774 },
        { geo: "cone", r: 0.11, h: 0.28, pos: [0.31, 1.2, 0], col: 0xf7d774 },
        { geo: "sphere", r: 0.08, pos: [0, 1.45, 0], col: 0xd64545 },
    ] },
    gradcap: { parts: [
        { geo: "cylinder", r: 0.36, h: 0.2, pos: [0, 1.02, 0], col: 0x1a1a1a },
        { geo: "box", w: 1.0, h: 0.06, d: 1.0, pos: [0, 1.15, 0], rot: [0, 0.4, 0], col: 0x1a1a1a },
        { geo: "sphere", r: 0.07, pos: [0.42, 0.98, 0.28], col: 0xf7d774 },
    ] },
    cap: { parts: [
        { geo: "sphere", r: 0.45, scale: [1, 0.62, 1], pos: [0, 0.94, 0], col: 0xd64545 },
        { geo: "box", w: 0.55, h: 0.06, d: 0.42, pos: [0, 0.88, 0.5], col: 0xd64545 },
    ] },
    flower: { parts: [
        { geo: "sphere", r: 0.13, pos: [-0.34, 1.0, 0.22], col: 0xff8fa6 },
        { geo: "sphere", r: 0.13, pos: [-0.1, 1.05, 0.3], col: 0xff8fa6 },
        { geo: "sphere", r: 0.13, pos: [-0.22, 0.88, 0.36], col: 0xff8fa6 },
        { geo: "sphere", r: 0.13, pos: [-0.44, 0.9, 0.3], col: 0xff8fa6 },
        { geo: "sphere", r: 0.1, pos: [-0.26, 0.98, 0.34], col: 0xf7d774 },
    ] },
    star: { parts: [
        { geo: "octa", r: 0.26, pos: [0, 1.16, 0], col: 0xf7d774, glow: true },
        { geo: "cylinder", r: 0.03, h: 0.24, pos: [0, 0.95, 0], col: 0xb58900 },
    ] },
    shades: { parts: [
        { geo: "box", w: 0.42, h: 0.24, d: 0.08, pos: [-0.32, 0.2, 0.96], col: 0x1a1a1a },
        { geo: "box", w: 0.42, h: 0.24, d: 0.08, pos: [0.32, 0.2, 0.96], col: 0x1a1a1a },
        { geo: "box", w: 0.24, h: 0.06, d: 0.06, pos: [0, 0.22, 0.96], col: 0x1a1a1a },
    ] },
    nerd: { parts: [
        { geo: "torus", r: 0.23, tube: 0.045, pos: [-0.32, 0.19, 0.95], col: 0x1a1a1a },
        { geo: "torus", r: 0.23, tube: 0.045, pos: [0.32, 0.19, 0.95], col: 0x1a1a1a },
        { geo: "box", w: 0.2, h: 0.05, d: 0.05, pos: [0, 0.19, 0.95], col: 0x1a1a1a },
    ] },
    bow: { parts: [
        { geo: "cone", r: 0.2, h: 0.3, pos: [-0.26, -0.62, 0.72], rot: [1.57, 0, 1.57], col: 0xff5f8f },
        { geo: "cone", r: 0.2, h: 0.3, pos: [0.26, -0.62, 0.72], rot: [1.57, 0, -1.57], col: 0xff5f8f },
        { geo: "sphere", r: 0.11, pos: [0, -0.62, 0.75], col: 0xff8fa6 },
    ] },
    scarf: { parts: [
        { geo: "torus", r: 0.66, tube: 0.15, pos: [0, -0.6, 0.05], rot: [1.45, 0, 0], col: 0xd64545 },
        { geo: "box", w: 0.22, h: 0.5, d: 0.1, pos: [0.2, -0.95, 0.6], rot: [0.3, 0, 0.15], col: 0xd64545 },
    ] },
};

function buildAccessory(spec) {
    const g = new THREE.Group();
    for (const p of spec.parts) {
        let geo;
        switch (p.geo) {
            case "box": geo = new THREE.BoxGeometry(p.w || 0.2, p.h || 0.2, p.d || 0.2); break;
            case "cone": geo = new THREE.ConeGeometry(p.r || 0.15, p.h || 0.3, 16); break;
            case "cylinder": geo = new THREE.CylinderGeometry(p.r || 0.2, p.r || 0.2, p.h || 0.2, 22); break;
            case "torus": geo = new THREE.TorusGeometry(p.r || 0.2, p.tube || 0.05, 10, 26); break;
            case "octa": geo = new THREE.OctahedronGeometry(p.r || 0.2, 0); break;
            default: geo = new THREE.SphereGeometry(p.r || 0.12, 18, 14);
        }
        const mat = new THREE.MeshStandardMaterial({
            color: p.col, roughness: 0.5, metalness: 0.15,
            ...(p.glow ? { emissive: p.col, emissiveIntensity: 0.5 } : {}),
        });
        const m = new THREE.Mesh(geo, mat);
        if (p.pos) m.position.set(p.pos[0], p.pos[1], p.pos[2]);
        if (p.rot) m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
        if (p.scale) m.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        g.add(m);
    }
    return g;
}

/* Equipped gear is part of the signature. Without it the model is never
   rebuilt when you change a hat, which is the other half of why equipping
   appeared to do nothing. */
function currentSig() {
    const c = state.color || {};
    const e = state.equipped || {};
    return [getStage().name, c.body, c.outline, e.hat, e.eyes, e.neck].join("|");
}

export function start() {
    if (renderer || failed) return is3dActive();
    const canvas = document.getElementById("pet3d");
    if (!canvas) return false;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
        // No WebGL (old device, blocklisted driver, headless). Stay on the SVG.
        failed = true;
        renderer = null;
        return false;
    }
    if (!renderer.getContext()) { failed = true; renderer = null; return false; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.35, 6.2);
    camera.lookAt(0, -0.1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 3.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 0.9);
    rim.position.set(-3, 1.5, -2.5);
    scene.add(rim);

    rebuild();
    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(loop);
    return true;
}

export function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    window.removeEventListener("resize", resize);
    if (root && scene) scene.remove(root);
    if (renderer) renderer.dispose();
    renderer = scene = camera = root = parts = null;
    lastSig = "";
}

function rebuild() {
    if (!scene) return;
    if (root) scene.remove(root);
    const colors = state.color || { body: "#c9e8b5", cheek: "#f4a8b3", outline: "#2d4a1f" };
    parts = buildPet(colors);
    root = parts.group;
    const s = getStage().size || 1;
    root.scale.setScalar(s * 1.15);
    scene.add(root);
    lastSig = currentSig();
}

function resize() {
    if (!renderer) return;
    const wrap = document.getElementById("pet-wrap");
    if (!wrap) return;
    const w = wrap.clientWidth || 160, h = wrap.clientHeight || 160;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

/* ── per-frame pose ──
   Reads the same mv state the CSS gait reads, so 3D and SVG stay in step. */
function loop(ts) {
    frameId = requestAnimationFrame(loop);
    if (!renderer || !root) return;

    if (currentSig() !== lastSig) rebuild();     // stage grew, or colour changed

    const t = ts / 1000;
    const asleep = !!state.sleeping;
    const mood = asleep ? "asleep" : getMood();
    const moving = !asleep && (mv.mode === "walk" || mv.mode === "run" || mv.traveling);
    const running = mv.traveling || mv.mode === "run";
    const speed = running ? 13 : 6.5;
    const swing = running ? 0.95 : 0.55;
    const p = parts;

    // Turn to face travel. This is the thing the SVG could not do: a symmetric
    // pet mirrored on X looks identical, but a rotated model reads instantly.
    const want = moving ? mv.facing * 0.62 : Math.sin(t * 0.4) * 0.13;
    root.rotation.y += (want - root.rotation.y) * 0.12;

    if (moving) {
        const ph = t * speed;
        p.legL.rotation.x = Math.sin(ph) * swing;
        p.legR.rotation.x = Math.sin(ph + Math.PI) * swing;
        p.legL.position.z = 0.05 + Math.sin(ph) * 0.3;
        p.legR.position.z = 0.05 + Math.sin(ph + Math.PI) * 0.3;
        p.armL.rotation.x = Math.sin(ph + Math.PI) * swing * 1.1;
        p.armR.rotation.x = Math.sin(ph) * swing * 1.1;
        root.position.y = Math.abs(Math.sin(ph)) * (running ? 0.16 : 0.08);
        root.rotation.z = Math.sin(ph) * 0.04;
    } else if (asleep) {
        const b = Math.sin(t * 1.2) * 0.03;
        root.position.y = -0.05;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        p.armL.rotation.x = p.armR.rotation.x = 0;
        p.legL.position.z = p.legR.position.z = 0.05;
        root.rotation.z = 0;
        p.torso.scale.set(1 + b, 0.95 - b * 0.6, 0.9 + b);
    } else {
        const b = Math.sin(t * 1.8);
        root.position.y = b * 0.06;
        p.legL.rotation.x = p.legR.rotation.x = 0;
        p.legL.position.z = p.legR.position.z = 0.05;
        p.armL.rotation.x = Math.sin(t * 1.6) * 0.18;
        p.armR.rotation.x = Math.sin(t * 1.6 + Math.PI) * 0.18;
        root.rotation.z = 0;
    }
    if (!asleep) p.torso.scale.set(1, 0.95, 0.9);

    // Hopping is owned by the wander loop; mirror it in the model.
    const wrap = document.getElementById("pet-wrap");
    if (wrap && wrap.classList.contains("hop")) root.position.y += 0.55;

    // Face. Eyes squash shut for sleep and for a happy squint; the mouth
    // widens or inverts. Cheap, and it tracks the same moods the SVG draws.
    const closed = asleep || mood === "happy" || mood === "loved";
    p.eyeL.scale.y = p.eyeR.scale.y = closed ? 0.18 : (mood === "excited" ? 1.25 : 1);
    p.eyeL.scale.x = p.eyeR.scale.x = mood === "excited" ? 1.2 : 1;
    if (mood === "sad" || mood === "sick") {
        p.eyeL.position.y = p.eyeR.position.y = 0.12;
        p.mouth.scale.set(0.9, 0.4, 0.4);
        p.mouth.position.y = -0.2;
    } else if (mood === "hungry") {
        p.mouth.scale.set(1.15, 1.15, 0.5);
        p.mouth.position.y = -0.18;
    } else if (closed && !asleep) {
        p.mouth.scale.set(1.5, 0.9, 0.45);
        p.mouth.position.y = -0.18;
    } else {
        p.eyeL.position.y = p.eyeR.position.y = 0.18;
        p.mouth.scale.set(1, 0.55, 0.4);
        p.mouth.position.y = -0.16;
    }

    // The shadow lives in world space, so undo the body's bob and lean.
    p.shadow.position.y = -1.22 - root.position.y;
    p.shadow.rotation.z = -root.rotation.z;

    renderer.render(scene, camera);
}
