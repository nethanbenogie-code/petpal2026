/* media.js — Camera and photo gallery, the Hunt mini-game.
   Split out of index.html's single script block; logic unchanged. */

import { pet } from './actions.js';
import { grantXp, XP } from './rpg.js';
import { checkAchievements, earnCoins } from './economy.js';
import { closeModal, openModal } from './journal.js';
import { updateUI } from './main.js';
import { HUNT_ITEMS, rand, randInt, save, state } from './state.js';
import { chirp, toast } from './ui.js';
/* ─── CAMERA ─── */
function takePhoto() {
    const flash = document.getElementById("flash");
    flash.classList.remove("on");
    void flash.offsetWidth;
    flash.classList.add("on");
    chirp("beep");
    setTimeout(() => {
        if (typeof html2canvas !== "undefined") {
            html2canvas(document.getElementById("pet-stage"), { scale: 0.8, useCORS: true, backgroundColor: null,
                    logging: false }).then(canvas => {
                savePhoto(canvas.toDataURL("image/png"));
            }).catch(() => { savePhoto(generatePhotoData()); });
        } else {
            savePhoto(generatePhotoData());
        }
    }, 300);
}

function generatePhotoData() {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    const c = state.color || { body: "#c9e8b5", outline: "#2d4a1f" };
    ctx.fillStyle = "#d5f0c2";
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.ellipse(150, 150, 80, 85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = c.outline;
    ctx.font = "30px sans-serif";
    ctx.fillText("🐾", 120, 170);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#1a2b0f";
    ctx.fillText(state.name, 110, 240);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#666";
    ctx.fillText(new Date().toLocaleDateString(), 110, 265);
    return canvas.toDataURL("image/png");
}

function savePhoto(dataURL) {
    state.photos.push({ dataURL, timestamp: Date.now() });
    if (state.photos.length > 50) state.photos.shift();
    save();
    toast("📸 Photo saved!", "coin");
    grantXp(XP.photo);
    checkAchievements();
    updateUI();
}

function openGallery() {
    if (state.photos.length === 0) { toast("No photos yet! 📷"); return; }
    const items = state.photos.slice().reverse().map((p, i) =>
        `<div class="gallery-item" data-idx="${i}"><img src="${p.dataURL}" alt="photo" /></div>`
    ).join("");
    openModal("📸 Photo Gallery", `
    <div class="gallery-grid">${items}</div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="clearPhotos()">Clear all</button>
      <button class="btn-primary" onclick="closeModal()">Done</button>
    </div>
  `);
    setTimeout(() => {
        document.querySelectorAll(".gallery-item").forEach(el => {
            el.onclick = () => {
                const idx = parseInt(el.dataset.idx);
                const reversed = state.photos.slice().reverse();
                const p = reversed[idx];
                if (p) {
                    openModal("📷 Photo", `
            <img src="${p.dataURL}" style="width:100%; border-radius:10px; margin-bottom:8px;" />
            <p style="font-size:11px; color:#888;">${new Date(p.timestamp).toLocaleString()}</p>
            <div class="modal-actions">
              <button class="btn-secondary" onclick="closeModal();openGallery();">Back</button>
              <button class="btn-danger" onclick="deletePhoto('${p.timestamp}')">Delete</button>
            </div>
          `);
                }
            };
        });
    }, 50);
}

function deletePhoto(ts) {
    state.photos = state.photos.filter(p => p.timestamp !== parseInt(ts));
    save();
    closeModal();
    openGallery();
}

function clearPhotos() {
    if (confirm("Delete all photos?")) { state.photos = [];
        save();
        closeModal();
        toast("Photos cleared"); }
}

/* ─── HUNT ─── */
let huntGame = null;

function startHunt() {
    huntGame = { score: 0, round: 0, maxRounds: 12, running: true, timer: null };
    openModal("🏹 Hunt!", `
    <div class="game-score">
      <span>Score: <span id="h-score">0</span></span>
      <span>Round: <span id="h-round">0</span>/${huntGame.maxRounds}</span>
    </div>
    <div class="hunt-area" id="hunt-area"></div>
    <p style="font-size:11px; color:#888; text-align:center;">Tap the hidden creatures!</p>
  `);
    setTimeout(nextHuntRound, 400);
}

function nextHuntRound() {
    if (!huntGame || !huntGame.running) return;
    const area = document.getElementById("hunt-area");
    if (!area) { huntGame = null; return; }
    if (huntGame.round >= huntGame.maxRounds) { endHunt(); return; }
    huntGame.round++;
    document.getElementById("h-round").textContent = huntGame.round;
    const count = randInt(2, 4);
    for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        el.className = "hunt-item";
        el.textContent = HUNT_ITEMS[randInt(0, HUNT_ITEMS.length - 1)];
        el.style.left = rand(5, 85) + "%";
        el.style.top = rand(5, 85) + "%";
        el.style.fontSize = rand(22, 36) + "px";
        let caught = false;
        el.onclick = (e) => {
            e.stopPropagation();
            if (caught) return;
            caught = true;
            el.classList.add("pop");
            huntGame.score++;
            document.getElementById("h-score").textContent = huntGame.score;
            chirp("hunt");
            setTimeout(() => el.remove(), 300);
        };
        area.appendChild(el);
        setTimeout(() => { if (!caught && el.parentNode) el.remove(); }, 2500);
    }
    huntGame.timer = setTimeout(() => {
        if (huntGame && huntGame.running) {
            area.querySelectorAll(".hunt-item").forEach(el => el.remove());
            nextHuntRound();
        }
    }, 2800);
}

function endHunt() {
    if (!huntGame) return;
    const s = huntGame.score;
    const reward = s * 4 + 5;
    state.huntStats.caught = (state.huntStats.caught || 0) + s;
    state.huntStats.total = (state.huntStats.total || 0) + huntGame.round;
    earnCoins(reward);
    state.fun = Math.min(100, state.fun + s * 2);
    save();
    huntGame = null;
    checkAchievements();
    openModal("🏹 Hunt over!", `
    <p style="text-align:center; font-size:16px;">Caught <b>${s}</b> creatures!</p>
    <p style="text-align:center; font-size:20px; color:#b58900;">+${reward} 💰</p>
    <p style="text-align:center; font-size:12px; color:#888;">Total: ${state.huntStats.caught}</p>
    <div class="modal-actions">
      <button class="btn-primary" id="h-again">Hunt again</button>
      <button class="btn-secondary" onclick="closeModal()">Done</button>
    </div>
  `);
    setTimeout(() => { document.getElementById("h-again").onclick = () => { closeModal();
            startHunt(); }; }, 50);
}

export {
    clearPhotos,
    deletePhoto,
    endHunt,
    generatePhotoData,
    huntGame,
    nextHuntRound,
    openGallery,
    savePhoto,
    startHunt,
    takePhoto
};
