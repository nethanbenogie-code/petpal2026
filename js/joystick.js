/* joystick.js — a round D-pad / thumbstick for the arcade and the shooter.

   Self-contained: injects its own CSS once, builds its own DOM, and speaks to
   the host through two callbacks. Works for taps on the outer chevrons AND for
   dragging the knob, because on a phone you want to hold a direction while a
   piece falls, and on a desktop you want to click an arrow.

   Pointer Events throughout rather than separate mouse/touch handlers —
   setPointerCapture is what keeps a drag alive when your thumb slides off the
   knob, which is the usual reason home-made sticks feel like they stick. */

const CSS = `
.jstick {
    position: relative;
    width: var(--js-size, 150px);
    height: var(--js-size, 150px);
    margin: 0 auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    flex: 0 0 auto;
}
.jstick .js-glow {
    position: absolute;
    inset: -14%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(90,140,220,.35), transparent 68%);
    pointer-events: none;
}
.jstick .js-bezel {
    position: absolute;
    inset: 11%;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 34%, #33405c, #1d2740 70%);
    box-shadow: 0 6px 18px rgba(0,0,0,.45), inset 0 2px 4px rgba(255,255,255,.06);
}
.jstick .js-ring {
    position: absolute;
    inset: 13%;
    border-radius: 50%;
    border: 7px solid #2ee6c5;
    box-shadow: 0 0 12px rgba(46,230,197,.75), inset 0 0 10px rgba(46,230,197,.55);
    transition: border-color .12s, box-shadow .12s;
    pointer-events: none;
}
.jstick.active .js-ring {
    border-color: #7cffe9;
    box-shadow: 0 0 22px rgba(124,255,233,.95), inset 0 0 14px rgba(124,255,233,.7);
}
.jstick .js-knob {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 46%;
    height: 46%;
    margin: -23% 0 0 -23%;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 28%, #a8c6f2, #6d8fc8 55%, #2e3f63 100%);
    box-shadow: 0 8px 16px rgba(0,0,0,.4), inset 0 -6px 12px rgba(0,0,0,.25);
    cursor: grab;
    transition: transform .08s ease-out;
    display: flex;
    align-items: center;
    justify-content: center;
}
.jstick.active .js-knob { cursor: grabbing; }
.jstick .js-knob::after {
    content: "";
    width: 42%;
    height: 42%;
    border-radius: 50%;
    border: 3px solid #2ee6c5;
    box-shadow: 0 0 8px rgba(46,230,197,.8);
}
.jstick .js-dot {
    position: absolute;
    width: 9%;
    height: 9%;
    border-radius: 50%;
    background: rgba(255,255,255,.16);
    box-shadow: inset 0 1px 2px rgba(0,0,0,.3);
    pointer-events: none;
}
.jstick .js-arrow {
    position: absolute;
    width: 15%;
    height: 15%;
    color: #2ee6c5;
    opacity: .8;
    cursor: pointer;
    transition: opacity .12s, transform .12s, filter .12s;
}
.jstick .js-arrow svg { width: 100%; height: 100%; display: block; }
.jstick .js-arrow.lit {
    opacity: 1;
    filter: drop-shadow(0 0 6px rgba(46,230,197,.95));
    transform: scale(1.25);
}
.jstick .js-arrow.up    { top: 0;    left: 42.5%; }
.jstick .js-arrow.down  { bottom: 0; left: 42.5%; }
.jstick .js-arrow.left  { left: 0;   top: 42.5%; }
.jstick .js-arrow.right { right: 0;  top: 42.5%; }
`;

const CHEVRON = {
    up: "M4 16 L12 7 L20 16",
    down: "M4 8 L12 17 L20 8",
    left: "M16 4 L7 12 L16 20",
    right: "M8 4 L17 12 L8 20",
};

let cssInjected = false;

function injectCss() {
    if (cssInjected) return;
    cssInjected = true;
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
}

/**
 * @param host      element to build inside (its contents are replaced)
 * @param onChange  (dir, pressed) — dir is "up"|"down"|"left"|"right"
 * @param opts      { center: fn }  called on a tap of the knob itself
 * @returns { destroy, release }
 */
export function createJoystick(host, onChange, opts = {}) {
    injectCss();
    host.innerHTML = "";
    host.classList.add("jstick");

    const glow = document.createElement("div"); glow.className = "js-glow";
    const bezel = document.createElement("div"); bezel.className = "js-bezel";
    const ring = document.createElement("div"); ring.className = "js-ring";
    const knob = document.createElement("div"); knob.className = "js-knob";
    host.append(glow, bezel, ring, knob);

    // the little moulded dimples from the reference
    for (const [x, y] of [[46, 20], [20, 47], [74, 47], [46, 76]]) {
        const d = document.createElement("div");
        d.className = "js-dot";
        d.style.left = x + "%"; d.style.top = y + "%";
        knob.appendChild(d);
    }

    const arrows = {};
    for (const dir of ["up", "down", "left", "right"]) {
        const a = document.createElement("div");
        a.className = "js-arrow " + dir;
        a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="${CHEVRON[dir]}"/></svg>`;
        host.appendChild(a);
        arrows[dir] = a;
    }

    /* One direction at a time. Diagonals would need every caller to handle two
       simultaneous presses, and none of these games want them. */
    let current = null, pointerId = null, moved = 0;

    function setDir(dir) {
        if (dir === current) return;
        if (current) { onChange(current, false); arrows[current].classList.remove("lit"); }
        current = dir;
        if (current) { onChange(current, true); arrows[current].classList.add("lit"); }
    }

    function knobTo(dir) {
        const d = 0.26;
        const map = { up: [0, -d], down: [0, d], left: [-d, 0], right: [d, 0] };
        const [x, y] = map[dir] || [0, 0];
        knob.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
    }

    function dirFromPoint(cx, cy) {
        const r = host.getBoundingClientRect();
        const dx = cx - (r.left + r.width / 2);
        const dy = cy - (r.top + r.height / 2);
        // dead zone in the middle so a centre tap is not read as a direction
        if (Math.hypot(dx, dy) < r.width * 0.12) return null;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left")
                                           : (dy > 0 ? "down" : "up");
    }

    function down(e) {
        if (pointerId !== null) return;
        pointerId = e.pointerId;
        moved = 0;
        host.classList.add("active");
        try { host.setPointerCapture(pointerId); } catch (err) {}
        const d = dirFromPoint(e.clientX, e.clientY);
        setDir(d); knobTo(d);
        e.preventDefault();
    }

    function move(e) {
        if (e.pointerId !== pointerId) return;
        moved++;
        const d = dirFromPoint(e.clientX, e.clientY);
        setDir(d); knobTo(d);
        e.preventDefault();
    }

    function up(e) {
        if (e.pointerId !== pointerId) return;
        const wasCentreTap = current === null && moved < 3;
        try { host.releasePointerCapture(pointerId); } catch (err) {}
        pointerId = null;
        host.classList.remove("active");
        setDir(null);
        knobTo(null);
        if (wasCentreTap && opts.center) opts.center();
        e.preventDefault();
    }

    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    // a pointer lost while the tab hides would otherwise latch a direction on
    window.addEventListener("blur", () => { if (pointerId !== null) setDir(null), knobTo(null); });

    return {
        release() { setDir(null); knobTo(null); },
        destroy() {
            host.removeEventListener("pointerdown", down);
            host.removeEventListener("pointermove", move);
            host.removeEventListener("pointerup", up);
            host.removeEventListener("pointercancel", up);
            host.innerHTML = "";
            host.classList.remove("jstick", "active");
        },
    };
}
