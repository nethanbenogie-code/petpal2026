/* scene.js — Weather, the pet's SVG artwork, and the location backdrop.
   Split out of index.html's single script block; logic unchanged. */

import { bath, park, pet } from './actions.js';
import { checkDailyLogin } from './economy.js';
import { tick, updateUI } from './main.js';
import { renderPlaymates } from './petmove.js';
import { LOCATIONS, WEATHERS, getMood, getStage, getTimeOfDay, rand, save, state } from './state.js';
/* ─── WEATHER ─── */
function updateWeather() {
    const now = Date.now();
    if (now - state.weather.changedAt > 1000 * 60 * 30) {
        let r = Math.random();
        let cum = 0;
        let chosen = WEATHERS[0];
        for (const wt of WEATHERS) {
            cum += wt.chance;
            if (r < cum) { chosen = wt; break; }
        }
        state.weather.id = chosen.id;
        state.weather.changedAt = now;
        save();
    }
    applyWeather();
}

/* Same reason as _sceneSig: this ran once a second and re-created every
   raindrop, so rain restarted its fall animation instead of falling. */
let _weatherSig = "";

function applyWeather(force) {
    const scene = document.getElementById("scene");
    const w = state.weather.id;
    const sig = w + "|" + scene.querySelectorAll(".rain-drop, .snowflake, .fog-overlay").length;
    if (!force && sig === _weatherSig) return;
    scene.querySelectorAll(".rain-drop, .snowflake, .fog-overlay").forEach(el => el.remove());
    if (w === "rainy" || w === "stormy") {
        for (let i = 0; i < 25; i++) {
            const drop = document.createElement("div");
            drop.className = "rain-drop";
            drop.textContent = "💧";
            drop.style.left = rand(0, 95) + "%";
            drop.style.animationDelay = rand(0, 1.2) + "s";
            drop.style.fontSize = rand(8, 14) + "px";
            drop.style.opacity = rand(0.2, 0.5);
            scene.appendChild(drop);
        }
    }
    if (w === "snowy") {
        for (let i = 0; i < 20; i++) {
            const flake = document.createElement("div");
            flake.className = "snowflake";
            flake.textContent = "❄";
            flake.style.left = rand(0, 95) + "%";
            flake.style.animationDelay = rand(0, 3) + "s";
            flake.style.fontSize = rand(10, 18) + "px";
            flake.style.opacity = rand(0.3, 0.8);
            scene.appendChild(flake);
        }
    }
    if (w === "foggy") {
        const fog = document.createElement("div");
        fog.className = "fog-overlay decor";
        fog.style.cssText =
            `position:absolute; inset:0; background:rgba(200,200,210,0.25); backdrop-filter:blur(2px); pointer-events:none; z-index:2;`;
        scene.appendChild(fog);
    }
    /* Recorded AFTER the rebuild, so the count in the signature matches
       what is on screen. If a decor sweep removes the fog overlay the
       count drifts and the next call rebuilds — self-healing. */
    _weatherSig = w + "|" + scene.querySelectorAll(".rain-drop, .snowflake, .fog-overlay").length;
}

/* ─── PET RENDERING ─── */
function pickColor() {
    const options = [
        { body: "#c9e8b5", cheek: "#f4a8b3", outline: "#2d4a1f" },
        { body: "#a8d8f7", cheek: "#ffb3c1", outline: "#1a3a52" },
        { body: "#ffd6a5", cheek: "#f4a8b3", outline: "#5a3510" },
        { body: "#e0bbf7", cheek: "#ff8fa6", outline: "#3a1f52" },
        { body: "#fff2a8", cheek: "#f4a8b3", outline: "#5a4510" },
        { body: "#ffb3c1", cheek: "#e56b6f", outline: "#5a1830" },
        { body: "#b8d8a8", cheek: "#f4a8b3", outline: "#2a3a1a" },
        { body: "#f0d0a8", cheek: "#ff8fa6", outline: "#5a4020" },
    ];
    return options[Math.floor(Math.random() * options.length)];
}

function accessorySVG(slot) {
    const id = state.equipped[slot];
    if (!id) return "";
    const map = {
        tophat: `<rect x="-20" y="-90" width="40" height="30" fill="#1a1a1a"/><rect x="-30" y="-62" width="60" height="6" fill="#1a1a1a"/><rect x="-20" y="-70" width="40" height="4" fill="#d64545"/>`,
        crown: `<path d="M-30 -60 L -30 -85 L -15 -70 L 0 -90 L 15 -70 L 30 -85 L 30 -60 Z" fill="#f7d774" stroke="#b58900" stroke-width="2"/><circle cx="0" cy="-78" r="3" fill="#d64545"/><circle cx="-18" cy="-72" r="2" fill="#4a8ec4"/><circle cx="18" cy="-72" r="2" fill="#4a8ec4"/>`,
        gradcap: `<rect x="-25" y="-72" width="50" height="8" fill="#1a1a1a"/><rect x="-18" y="-82" width="36" height="12" fill="#1a1a1a"/><line x1="0" y1="-72" x2="20" y2="-60" stroke="#f7d774" stroke-width="2"/><circle cx="20" cy="-60" r="3" fill="#f7d774"/>`,
        cap: `<path d="M-25 -65 Q 0 -85 25 -65 L 25 -60 L -25 -60 Z" fill="#d64545"/><rect x="-30" y="-62" width="30" height="4" fill="#d64545"/>`,
        flower: `<circle cx="0" cy="-80" r="10" fill="#ff5f8f"/><circle cx="-6" cy="-86" r="6" fill="#ff8fa6"/><circle cx="6" cy="-86" r="6" fill="#ff8fa6"/><circle cx="0" cy="-74" r="6" fill="#ff8fa6"/><circle cx="0" cy="-80" r="4" fill="#f7d774"/>`,
        star: `<polygon points="0,-92 6,-78 22,-78 10,-68 14,-52 0,-60 -14,-52 -10,-68 -22,-78 -6,-78" fill="#f7d774" stroke="#b58900" stroke-width="1.5"/>`,
        shades: { eyes: `<rect x="-32" y="-13" width="26" height="14" fill="#1a1a1a" rx="4"/><rect x="6" y="-13" width="26" height="14" fill="#1a1a1a" rx="4"/><rect x="-6" y="-6" width="12" height="2" fill="#1a1a1a"/>` },
        nerd: { eyes: `<circle cx="-19" cy="-6" r="14" fill="none" stroke="#1a1a1a" stroke-width="3"/><circle cx="19" cy="-6" r="14" fill="none" stroke="#1a1a1a" stroke-width="3"/><line x1="-5" y1="-6" x2="5" y2="-6" stroke="#1a1a1a" stroke-width="3"/>` },
        bow: `<path d="M-20 40 L -30 30 L -30 50 L -20 40 L -10 40 L 0 40 L 10 40 L 20 40 L 30 50 L 30 30 Z" fill="#ff5f8f" stroke="#a03060" stroke-width="2"/><circle cx="0" cy="40" r="6" fill="#ff5f8f" stroke="#a03060" stroke-width="2"/>`,
        scarf: `<path d="M-32 45 Q 0 55 32 45 L 32 60 Q 0 70 -32 60 Z" fill="#d64545"/><rect x="-8" y="60" width="10" height="20" fill="#d64545"/>`
    };
    const entry = map[id];
    if (!entry) return "";
    return typeof entry === "string" ? entry : "";
}

function eyesAccessoryOverlay() {
    const id = state.equipped.eyes;
    const map = {
        shades: `<rect x="68" y="87" width="26" height="12" fill="#1a1a1a" rx="3"/><rect x="106" y="87" width="26" height="12" fill="#1a1a1a" rx="3"/><rect x="94" y="91" width="12" height="2" fill="#1a1a1a"/>`,
        nerd: `<circle cx="81" cy="93" r="12" fill="none" stroke="#1a1a1a" stroke-width="3"/><circle cx="119" cy="93" r="12" fill="none" stroke="#1a1a1a" stroke-width="3"/><line x1="93" y1="93" x2="107" y2="93" stroke="#1a1a1a" stroke-width="3"/>`
    };
    return map[id] || "";
}

/* Rebuilding svg.innerHTML restarts every CSS animation inside it, and
   drawPet() runs twice a second (setInterval + every tick). Without
   this guard the walk cycle would reset 2x/sec. The signature covers
   everything the markup actually depends on; if you add a new visual
   input, add it here too or the pet will stop updating for it. */
let _petSig = "";

function drawPet(force) {
    const svg = document.getElementById("pet");
    const c = state.color || (state.color = pickColor(), save(), state.color);
    const stage = getStage();
    const mood = getMood();
    const sig = [stage.name, mood, state.sleeping ? 1 : 0, c.body,
        state.equipped.hat, state.equipped.eyes, state.equipped.neck
    ].join("|");
    if (!force && sig === _petSig) return;
    _petSig = sig;

    if (stage.name === "Egg") {
        svg.innerHTML = `
      <ellipse cx="100" cy="120" rx="60" ry="72" fill="${c.body}" stroke="${c.outline}" stroke-width="4"/>
      <ellipse cx="85" cy="105" rx="18" ry="10" fill="rgba(255,255,255,0.5)"/>
      <ellipse cx="115" cy="130" rx="8" ry="4" fill="rgba(255,255,255,0.3)"/>
    `;
        return;
    }

    const asleep = state.sleeping;
    const scale = stage.size;
    const bodyR = 55;
    const eyeY = 90;
    let eyeLeft, eyeRight, mouth, extra = "";

    if (asleep) {
        eyeLeft =
            `<path d="M78 ${eyeY} Q 88 ${eyeY+6} 98 ${eyeY}" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        eyeRight =
            `<path d="M102 ${eyeY} Q 112 ${eyeY+6} 122 ${eyeY}" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        mouth =
            `<path d="M92 118 Q 100 122 108 118" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    } else if (mood === "happy" || mood === "loved") {
        eyeLeft =
            `<path d="M78 ${eyeY+2} Q 88 ${eyeY-6} 98 ${eyeY+2}" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        eyeRight =
            `<path d="M102 ${eyeY+2} Q 112 ${eyeY-6} 122 ${eyeY+2}" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        mouth =
            `<path d="M88 115 Q 100 128 112 115" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        if (mood === "loved") extra = `<text x="60" y="60" font-size="20">💕</text>`;
    } else if (mood === "sad") {
        eyeLeft =
            `<circle cx="88" cy="${eyeY}" r="4" fill="${c.outline}"/><circle cx="90" cy="${eyeY-1}" r="1.5" fill="white"/>`;
        eyeRight =
            `<circle cx="112" cy="${eyeY}" r="4" fill="${c.outline}"/><circle cx="114" cy="${eyeY-1}" r="1.5" fill="white"/>`;
        mouth =
            `<path d="M88 122 Q 100 112 112 122" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        extra =
            `<path d="M88 96 Q 90 105 88 112" stroke="#4a8ec4" stroke-width="2" fill="#7bc4f0" opacity="0.8"/>`;
    } else if (mood === "hungry") {
        eyeLeft =
            `<circle cx="88" cy="${eyeY}" r="5" fill="${c.outline}"/><circle cx="90" cy="${eyeY-2}" r="2" fill="white"/>`;
        eyeRight =
            `<circle cx="112" cy="${eyeY}" r="5" fill="${c.outline}"/><circle cx="114" cy="${eyeY-2}" r="2" fill="white"/>`;
        mouth = `<ellipse cx="100" cy="120" rx="8" ry="6" fill="#5a1830"/>`;
    } else if (mood === "sick") {
        eyeLeft =
            `<path d="M82 ${eyeY-4} L 94 ${eyeY+4} M 94 ${eyeY-4} L 82 ${eyeY+4}" stroke="${c.outline}" stroke-width="3" stroke-linecap="round"/>`;
        eyeRight =
            `<path d="M106 ${eyeY-4} L 118 ${eyeY+4} M 118 ${eyeY-4} L 106 ${eyeY+4}" stroke="${c.outline}" stroke-width="3" stroke-linecap="round"/>`;
        mouth =
            `<path d="M92 120 Q 96 116 100 120 Q 104 116 108 120" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        extra = `<circle cx="130" cy="70" r="8" fill="#a0d68f" opacity="0.7"/>`;
    } else if (mood === "excited") {
        eyeLeft =
            `<circle cx="88" cy="${eyeY}" r="6" fill="white" stroke="${c.outline}" stroke-width="2"/><circle cx="88" cy="${eyeY}" r="3" fill="${c.outline}"/><circle cx="89" cy="${eyeY-1}" r="1" fill="white"/>`;
        eyeRight =
            `<circle cx="112" cy="${eyeY}" r="6" fill="white" stroke="${c.outline}" stroke-width="2"/><circle cx="112" cy="${eyeY}" r="3" fill="${c.outline}"/><circle cx="113" cy="${eyeY-1}" r="1" fill="white"/>`;
        mouth =
            `<ellipse cx="100" cy="120" rx="10" ry="8" fill="#5a1830"/><path d="M96 122 Q 100 128 104 122" stroke="#ffb3c1" stroke-width="2" fill="#ffb3c1"/>`;
    } else {
        eyeLeft =
            `<circle cx="88" cy="${eyeY}" r="4" fill="${c.outline}"/><circle cx="90" cy="${eyeY-1}" r="1.5" fill="white"/>`;
        eyeRight =
            `<circle cx="112" cy="${eyeY}" r="4" fill="${c.outline}"/><circle cx="114" cy="${eyeY-1}" r="1.5" fill="white"/>`;
        mouth =
            `<path d="M93 118 Q 100 122 107 118" stroke="${c.outline}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }

    const cheeks = mood === "sick" ? "" :
        `<ellipse cx="72" cy="110" rx="6" ry="4" fill="${c.cheek}" opacity="0.7"/>
       <ellipse cx="128" cy="110" rx="6" ry="4" fill="${c.cheek}" opacity="0.7"/>`;
    const hatSVG = accessorySVG("hat");
    const neckSVG = accessorySVG("neck");
    const eyesOverlay = eyesAccessoryOverlay();
    const antenna = stage.name === "Adult" ?
        `<line x1="0" y1="${-bodyR}" x2="0" y2="${-bodyR - 15}" stroke="${c.outline}" stroke-width="3"/>
       <circle cx="0" cy="${-bodyR - 18}" r="4" fill="${c.cheek}" stroke="${c.outline}" stroke-width="2"/>` : "";

    /* Limbs are drawn BEFORE the body so a lifted foot tucks behind it
       instead of sliding across the belly. Their motion is CSS
       (.leg / .arm), driven by the walking/running class on #pet-wrap. */
    svg.innerHTML = `
    <g transform="translate(100, 100)">
      <g transform="scale(${scale})">
        <ellipse class="leg leg-l" cx="-20" cy="64" rx="12" ry="7" fill="${c.outline}"/>
        <ellipse class="leg leg-r" cx="20" cy="64" rx="12" ry="7" fill="${c.outline}"/>
        <ellipse class="arm arm-l" cx="${-bodyR - 5}" cy="20" rx="10" ry="6" fill="${c.body}" stroke="${c.outline}" stroke-width="3"/>
        <ellipse class="arm arm-r" cx="${bodyR + 5}" cy="20" rx="10" ry="6" fill="${c.body}" stroke="${c.outline}" stroke-width="3"/>
        <ellipse cx="0" cy="10" rx="${bodyR}" ry="${bodyR * 0.95}" fill="${c.body}" stroke="${c.outline}" stroke-width="4"/>
        <ellipse cx="-20" cy="-15" rx="12" ry="8" fill="rgba(255,255,255,0.4)"/>
        ${antenna}
        ${neckSVG}
        ${hatSVG}
      </g>
    </g>
    <g>
      ${cheeks}
      ${eyeLeft}
      ${eyeRight}
      ${mouth}
      ${eyesOverlay}
      ${extra}
    </g>
  `;
}

/* ─── SCENE ─── */
/* updateScene() runs every tick. Rebuilding the decor each time
   restarted the star/bubble animations once a second and would fight
   the travel crossfade, so the backdrop is only touched when the
   resolved location actually changes. */
let _sceneSig = "";

function resolvedScene() {
    let loc = state.scene;
    if (state.sleeping) loc = "night";
    if (loc === "home" && state.autoDayNight) {
        const tod = getTimeOfDay();
        if (tod === "night") loc = "night";
        else if (tod === "dawn") loc = "dawn";
        else if (tod === "dusk") loc = "dusk";
    }
    return loc;
}

function updateScene() {
    const screen = document.getElementById("screen");
    const scene = document.getElementById("scene");
    const loc = resolvedScene();

    if (loc === _sceneSig) {
        document.getElementById("zzz").style.display = state.sleeping ? "block" : "none";
        document.getElementById("time-tag").textContent = state.autoDayNight ? getTimeOfDay() : "";
        renderPlaymates();
        applyWeather();
        return;
    }

    /* Home's bgClass is "", and classList.remove("") throws
       SyntaxError. This line threw on EVERY call, and because
       checkDailyLogin() -> updateUI() -> updateScene() sits at the top
       of init, the throw aborted the rest of the startup script: no
       tick interval, no autosave, no drag, no backdrops, no weather.
       The filter is what makes any of the rest of this file run. */
    LOCATIONS.forEach(l => { if (l.bgClass) screen.classList.remove(l.bgClass); });
    screen.classList.remove("night-bg", "dawn-bg", "dusk-bg");

    const locData = LOCATIONS.find(l => l.id === loc);
    if (locData && locData.bgClass) {
        screen.classList.add(locData.bgClass);
    }

    scene.querySelectorAll(".decor").forEach(n => n.remove());

    if (loc === "park") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:16px; left:6%; font-size:36px;">🌳</div>
             <div style="position:absolute; bottom:16px; right:6%; font-size:36px;">🌲</div>
             <div style="position:absolute; bottom:18px; left:35%; font-size:18px;">🌼</div>
             <div style="position:absolute; bottom:20px; right:45%; font-size:14px;">🌿</div>`;
        scene.appendChild(d);
    } else if (loc === "beach") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:16px; left:10%; font-size:28px;">🏖</div>
             <div style="position:absolute; bottom:20px; right:15%; font-size:24px;">☀</div>
             <div style="position:absolute; top:20%; right:8%; font-size:30px;">🌊</div>
             <div style="position:absolute; bottom:10px; left:50%; font-size:14px;">🐚</div>`;
        scene.appendChild(d);
    } else if (loc === "school") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:14px; left:5%; font-size:40px;">🏫</div>
             <div style="position:absolute; bottom:16px; right:8%; font-size:26px;">🚌</div>
             <div style="position:absolute; bottom:18px; left:42%; font-size:18px;">🎒</div>
             <div style="position:absolute; top:14%; right:22%; font-size:16px;">🚩</div>
             <div style="position:absolute; bottom:20px; right:34%; font-size:14px;">📚</div>`;
        scene.appendChild(d);
    } else if (loc === "mall") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:12px; left:6%; font-size:36px;">🏬</div>
             <div style="position:absolute; bottom:16px; right:7%; font-size:28px;">🛒</div>
             <div style="position:absolute; bottom:18px; left:38%; font-size:20px;">🛍</div>
             <div style="position:absolute; top:12%; left:20%; font-size:14px;">✨</div>
             <div style="position:absolute; top:18%; right:16%; font-size:16px;">🎈</div>`;
        scene.appendChild(d);
    } else if (loc === "lab") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:14px; left:8%; font-size:32px;">🔬</div>
             <div style="position:absolute; bottom:16px; right:10%; font-size:28px;">⚗️</div>
             <div style="position:absolute; bottom:18px; left:40%; font-size:20px;">🧪</div>
             <div style="position:absolute; bottom:22px; right:34%; font-size:16px;">🧫</div>
             <div style="position:absolute; top:14%; left:26%; font-size:14px;">🧬</div>`;
        scene.appendChild(d);
    } else if (loc === "hospital") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:14px; left:6%; font-size:34px;">🏥</div>
             <div style="position:absolute; bottom:16px; right:9%; font-size:26px;">🛏</div>
             <div style="position:absolute; bottom:20px; left:40%; font-size:18px;">🩺</div>
             <div style="position:absolute; bottom:22px; right:33%; font-size:16px;">💊</div>
             <div style="position:absolute; top:12%; right:20%; font-size:16px;">🚑</div>`;
        scene.appendChild(d);
    } else if (loc === "forest") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:10px; left:5%; font-size:40px;">🌲</div>
             <div style="position:absolute; bottom:10px; right:8%; font-size:44px;">🌳</div>
             <div style="position:absolute; bottom:30px; left:30%; font-size:16px;">🍄</div>
             <div style="position:absolute; bottom:25px; right:40%; font-size:14px;">🌿</div>`;
        scene.appendChild(d);
    } else if (loc === "city") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:10px; left:6%; font-size:32px;">🏢</div>
             <div style="position:absolute; bottom:10px; right:6%; font-size:32px;">🏙</div>
             <div style="position:absolute; bottom:15px; left:45%; font-size:18px;">🚗</div>
             <div style="position:absolute; top:10px; right:20%; font-size:14px;">🌆</div>`;
        scene.appendChild(d);
    } else if (loc === "mountain") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:10px; left:15%; font-size:40px;">⛰</div>
             <div style="position:absolute; bottom:10px; right:15%; font-size:36px;">🗻</div>
             <div style="position:absolute; bottom:20px; left:50%; font-size:14px;">🌲</div>`;
        scene.appendChild(d);
    } else if (loc === "space") {
        const d = document.createElement("div");
        d.className = "decor";
        let stars = "";
        for (let i = 0; i < 12; i++) {
            stars +=
                `<div class="star" style="top:${rand(5,80)}%; left:${rand(5,90)}%; animation-delay:${rand(0,2)}s;">✦</div>`;
        }
        d.innerHTML = stars +
            `<div style="position:absolute; top:10px; right:15px; font-size:24px;">🌙</div>
             <div style="position:absolute; bottom:20px; left:20%; font-size:20px;">🛸</div>`;
        scene.appendChild(d);
    } else if (loc === "snow") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:10px; left:10%; font-size:28px;">⛄</div>
             <div style="position:absolute; bottom:20px; right:15%; font-size:24px;">🏔</div>`;
        scene.appendChild(d);
    } else if (loc === "bath") {
        const d = document.createElement("div");
        d.className = "decor";
        d.innerHTML =
            `<div style="position:absolute; bottom:20%; left:20%; font-size:22px;">🫧</div>
             <div style="position:absolute; bottom:35%; right:25%; font-size:18px;">🫧</div>
             <div style="position:absolute; bottom:12%; left:50%; font-size:24px;">🫧</div>`;
        scene.appendChild(d);
    } else if (loc === "night" || loc === "dawn" || loc === "dusk") {
        const d = document.createElement("div");
        d.className = "decor";
        let extra = "";
        if (loc === "night") {
            for (let i = 0; i < 8; i++) {
                extra +=
                    `<div class="star" style="top:${rand(5,70)}%; left:${rand(5,90)}%; animation-delay:${rand(0,2)}s;">✦</div>`;
            }
            extra += `<div style="position:absolute; top:12px; right:15px; font-size:24px;">🌙</div>`;
        } else if (loc === "dawn") {
            extra += `<div style="position:absolute; top:12px; right:15px; font-size:26px;">☀</div>`;
        } else {
            extra += `<div style="position:absolute; top:12px; right:15px; font-size:22px;">🌅</div>`;
        }
        d.innerHTML = extra;
        scene.appendChild(d);
    }

    document.getElementById("zzz").style.display = state.sleeping ? "block" : "none";
    document.getElementById("time-tag").textContent = state.autoDayNight ? getTimeOfDay() : "";
    renderPlaymates();
    applyWeather();
    // Recorded last: if anything above throws, the memo stays stale and
    // the next call retries rather than silently skipping the backdrop.
    _sceneSig = loc;
}

export {
    _petSig,
    _sceneSig,
    _weatherSig,
    accessorySVG,
    applyWeather,
    drawPet,
    eyesAccessoryOverlay,
    pickColor,
    resolvedScene,
    updateScene,
    updateWeather
};
