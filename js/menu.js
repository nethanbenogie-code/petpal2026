/* menu.js — The settings menu and everything hanging off it.
   Split out of index.html's single script block; logic unchanged. */

import { pet, play } from './actions.js';
import { earnCoins } from './economy.js';
import { closeModal, openModal, requestNotifications } from './journal.js';
import { updateUI } from './main.js';
import { openGallery } from './media.js';
import { levelPanelHtml } from './rpg.js';
import { bossFight, dailyFight } from './encounters.js';
import { changeLocation } from './petmove.js';
import { updateScene } from './scene.js';
import { ACHIEVEMENTS, LOCATIONS, STORAGE_KEY, ageInHours, save, state } from './state.js';
import { startTraining } from './tricks.js';
import { chirp, initAudio, initTTS, speak, toast } from './ui.js';
/* ─── MENU ─── */
function openMenu() {
    const t = state.traits;
    const traitList = Object.entries(t).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<div style="display:flex; justify-content:space-between; font-size:11px; padding:2px 0;"><span>${k}</span><span>${Math.round(v)}</span></div>`)
        .join("");

    const locOptions = LOCATIONS.map(l =>
        `<button class="menu-item" data-loc="${l.id}" style="${state.locationUnlocked.includes(l.id)?'':'opacity:0.5;'}">
      <span>${l.label}</span>
      <span>${state.locationUnlocked.includes(l.id)?'✓':'🔒'}</span>
    </button>`
    ).join("");

    const achList = Object.entries(ACHIEVEMENTS).map(([key, info]) => {
        const unlocked = state.achievements[key];
        return `<div style="display:flex; justify-content:space-between; padding:4px 0; font-size:11px; border-bottom:1px solid #f0f0f0;">
      <span>${unlocked?'✅':'⬜'} ${info.icon} ${info.label}</span>
      <span style="color:${unlocked?'var(--ok)':'#ccc'};">${unlocked?new Date(state.achievements[key]).toLocaleDateString():'locked'}</span>
    </div>`;
    }).join("");

    openModal("⚙ Menu", `
    <div class="menu-list">
      <button class="menu-item" id="m-rename"><span>✏️ Rename pet</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-voice"><span>🔊 Voice & sound</span><span class="menu-toggle ${state.voiceEnabled?'on':''}"></span></button>
      <button class="menu-item" id="m-notif"><span>🔔 Notifications</span><span class="menu-toggle ${state.notificationsEnabled?'on':''}"></span></button>
      <button class="menu-item" id="m-daynight"><span>🌓 Auto day/night</span><span class="menu-toggle ${state.autoDayNight?'on':''}"></span></button>
      <button class="menu-item" id="m-3d"><span>🧊 3D pet</span><span class="menu-toggle ${state.render3d?'on':''}"></span></button>
      <button class="menu-item" id="m-locations"><span>📍 Locations</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-boss"><span>★ Zone boss</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-daily-battle"><span>🗓 Daily challenge</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-level"><span>📊 Level & stats</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-personality"><span>🧠 Personality</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-vocab"><span>📖 Vocabulary</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-tricks"><span>🎓 Tricks</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-achievements"><span>🏆 Achievements</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-gallery"><span>📸 Gallery (${state.photos.length})</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-daily"><span>🌅 Daily reward</span><span class="arrow">›</span></button>
      <button class="menu-item" id="m-reset" style="color: var(--danger);"><span>🗑 Reset pet</span><span class="arrow">›</span></button>
    </div>
  `);

    setTimeout(() => {
        document.getElementById("m-rename").onclick = () => {
            openModal("✏️ Rename", `
        <p>Give ${state.name} a new name:</p>
        <input type="text" id="rename-input" maxlength="16" value="${state.name.replace(/"/g,"&quot;")}" />
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn-primary" id="rename-ok">Save</button>
        </div>
      `);
            setTimeout(() => {
                const input = document.getElementById("rename-input");
                input.focus();
                input.select();
                document.getElementById("rename-ok").onclick = () => {
                    const v = input.value.trim();
                    if (v) { state.name = v.slice(0, 16);
                        save();
                        updateUI();
                        speak(`I'm ${v} now!`); }
                    closeModal();
                };
            }, 50);
        };
        document.getElementById("m-voice").onclick = () => {
            state.voiceEnabled = !state.voiceEnabled;
            save();
            if (state.voiceEnabled) { initTTS();
                initAudio();
                chirp("happy");
                speak("I can talk now!"); }
            openMenu();
        };
        document.getElementById("m-notif").onclick = () => {
            if (!state.notificationsEnabled) requestNotifications();
            else { state.notificationsEnabled = false;
                save();
                openMenu(); }
        };
        document.getElementById("m-daynight").onclick = () => {
            state.autoDayNight = !state.autoDayNight;
            save();
            updateScene();
            openMenu();
        };
        document.getElementById("m-boss").onclick = () => { closeModal(); bossFight(); };
        document.getElementById("m-daily-battle").onclick = () => { closeModal(); dailyFight(); };
        document.getElementById("m-level").onclick = () => {
            openModal("📊 Level & stats", levelPanelHtml() + `
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeModal();openMenu();">Back</button>
        </div>`);
        };
        document.getElementById("m-3d").onclick = () => {
            state.render3d = !state.render3d;
            save();
            // main.js owns the switch; reached via window to avoid a cycle
            // (main already imports menu.js).
            if (window.applyRenderMode) window.applyRenderMode();
            openMenu();
        };
        document.getElementById("m-locations").onclick = () => {
            openModal("📍 Locations", `
        <p style="font-size:12px; color:#888;">Tap to change scene. 🔒 = locked.</p>
        <div class="menu-list">${locOptions}</div>
      `);
            setTimeout(() => {
                document.querySelectorAll("[data-loc]").forEach(btn => {
                    btn.onclick = () => {
                        const id = btn.dataset.loc;
                        if (state.locationUnlocked.includes(id)) changeLocation(id);
                        else toast("🔒 Locked! Keep playing.");
                    };
                });
            }, 50);
        };
        document.getElementById("m-personality").onclick = () => {
            openModal("🧠 Personality", `
        <p style="font-size:11px; color:#888;">${state.name} — ${state.totalMessages} messages, ${ageInHours().toFixed(1)} hours old.</p>
        ${traitList}
        <p style="font-size:11px; margin-top:8px; color:#888;">💡 Talk, pet, and play to shape personality!</p>
      `);
        };
        document.getElementById("m-vocab").onclick = () => {
            const words = Object.entries(state.vocab).sort((a, b) => b[1].count - a[1].count).slice(0, 30);
            openModal("📖 Vocabulary", `
        <p style="font-size:11px; color:#888;">Words ${state.name} has learned:</p>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
          ${words.length ? words.map(([w,d]) => `<span class="badge" style="background:#eee; padding:2px 8px; border-radius:12px; font-size:11px;">${w} ×${d.count}</span>`).join(" ") : "<i>No words yet. Talk to your pet!</i>"}
        </div>
      `);
        };
        document.getElementById("m-tricks").onclick = () => {
            const list = Object.entries(state.tricks);
            openModal("🎓 Tricks", `
        <p style="font-size:11px; color:#888;">Say these words to make me do things:</p>
        ${list.length ? list.map(([w,t]) => `<div style="padding:4px 0; border-bottom:1px solid #f0f0f0; font-size:13px;"><b>"${w}"</b> → ${t.action} <span style="color:#888; font-size:11px;">(lvl ${Math.floor(t.level)}/3)</span></div>`).join("") : "<i>No tricks yet. Tap Train!</i>"}
        <div class="modal-actions"><button class="btn-primary" onclick="startTraining()">🎓 Train new</button></div>
      `);
        };
        document.getElementById("m-achievements").onclick = () => {
            const total = Object.keys(ACHIEVEMENTS).length;
            const unlocked = Object.keys(state.achievements).filter(k => k in ACHIEVEMENTS).length;
            openModal("🏆 Achievements", `
        <p style="font-size:12px; color:#888;">${unlocked}/${total} unlocked</p>
        <div style="max-height:200px; overflow-y:auto;">${achList}</div>
      `);
        };
        document.getElementById("m-gallery").onclick = () => { closeModal();
            openGallery(); };
        document.getElementById("m-daily").onclick = () => {
            const streak = state.dailyLogin.streak || 0;
            const bonus = Math.min(20 + streak * 2, 100);
            openModal("🌅 Daily Reward", `
        <p style="text-align:center; font-size:40px; margin:8px 0;">🎁</p>
        <p style="text-align:center; font-size:16px;">Day ${streak} streak!</p>
        <p style="text-align:center; font-size:20px; color:#b58900;">+${bonus} 💰</p>
        <div class="modal-actions">
          <button class="btn-primary" id="daily-claim">Claim</button>
          <button class="btn-secondary" onclick="closeModal()">Close</button>
        </div>
      `);
            setTimeout(() => {
                document.getElementById("daily-claim").onclick = () => {
                    if (state.dailyLogin.claimed) { toast("Already claimed today!"); return; }
                    state.dailyLogin.claimed = true;
                    state.dailyLogin.last = Date.now();
                    earnCoins(bonus, true);
                    toast(`+${bonus} daily bonus!`, "coin");
                    closeModal();
                    save();
                    updateUI();
                };
            }, 50);
        };
        document.getElementById("m-reset").onclick = () => {
            openModal("🗑 Reset?", `
        <p>Really reset your pet? All progress, memories, coins, notes, and photos will be lost.</p>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn-primary" id="reset-ok" style="background:var(--danger);">Yes, reset</button>
        </div>
      `);
            setTimeout(() => {
                document.getElementById("reset-ok").onclick = () => {
                    localStorage.removeItem(STORAGE_KEY);
                    location.reload();
                };
            }, 50);
        };
    }, 50);
}

export {
    openMenu
};
