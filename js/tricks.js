/* tricks.js — Teaching and performing tricks.
   Split out of index.html's single script block; logic unchanged. */

import { pet, spawnHearts } from './actions.js';
import { grantXp, XP } from './rpg.js';
import { checkAchievements, earnCoins } from './economy.js';
import { closeModal, openModal } from './journal.js';
import { TRICK_ACTIONS, pickReply, save, state } from './state.js';
import { chirp, speak, toast } from './ui.js';
/* ─── TRICKS ─── */
function performTrick(word) {
    const t = state.tricks[word];
    if (!t) return;
    const successChance = 0.4 + t.level * 0.2;
    if (Math.random() > successChance) {
        speak(pickReply(["Hmm... what was that?", "I forgot...", "*confused*"]));
        return;
    }
    const action = TRICK_ACTIONS[t.action];
    if (!action) { speak("*confused*"); return; }
    const wrap = document.getElementById("pet-wrap");
    if (action.class) {
        wrap.classList.add(action.class);
        setTimeout(() => wrap.classList.remove(action.class), 1500);
    }
    if (action.handler) action.handler();
    else speak(`${action.emoji} ${action.name}!`);
    chirp("happy");
    spawnHearts(1);
    t.level = Math.min(3, t.level + 0.1);
    state.tricksLearned = (state.tricksLearned || 0) + 1;
    earnCoins(2);
    grantXp(XP.trick);
    checkAchievements();
    save();
}

function startTraining() {
    openModal("🎓 Train a trick", `
    <p>Pick an action, then teach me a command word.</p>
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; margin-bottom:10px;">
      ${Object.entries(TRICK_ACTIONS).map(([id, a]) => `
        <button class="menu-item" data-trick="${id}" style="flex-direction:column; text-align:center; padding:10px 4px; gap:2px; font-size:11px;">
          <span style="font-size:26px;">${a.emoji}</span>
          <span>${a.name}</span>
        </button>`).join("")}
    </div>
    <p style="font-size:10px; color:#888;">Trained: ${Object.entries(state.tricks).map(([w,t])=>`"${w}" → ${t.action} (lvl ${Math.floor(t.level)})`).join(", ") || "none"}</p>
  `);
    setTimeout(() => {
        document.querySelectorAll("[data-trick]").forEach(btn => {
            btn.onclick = () => {
                const trickId = btn.dataset.trick;
                closeModal();
                promptTrickWord(trickId);
            };
        });
    }, 50);
}

function promptTrickWord(trickId) {
    const action = TRICK_ACTIONS[trickId];
    openModal("Teach the word", `
    <p>Type the word you'll say to make me <b>${action.name}</b>.</p>
    <input type="text" id="trick-word-input" maxlength="20" placeholder="${trickId}" />
    <div class="modal-actions">
      <button class="btn-secondary" id="tw-cancel">Cancel</button>
      <button class="btn-primary" id="tw-ok">Teach</button>
    </div>
  `);
    setTimeout(() => {
        const input = document.getElementById("trick-word-input");
        input.focus();
        document.getElementById("tw-cancel").onclick = closeModal;
        document.getElementById("tw-ok").onclick = () => {
            const w = input.value.trim().toLowerCase();
            if (!w) return;
            state.tricks[w] = { action: trickId, level: 0 };
            state.tricksLearned = (state.tricksLearned || 0) + 1;
            save();
            closeModal();
            speak(`New word! "${w}" means ${action.name}!`);
            chirp("love");
            toast(`Learned command: "${w}"`);
            checkAchievements();
        };
        input.onkeydown = (e) => { if (e.key === "Enter") document.getElementById("tw-ok").click(); };
    }, 50);
}

function finishTraining(text) { state.pendingTrick = null;
    save(); }

export {
    finishTraining,
    performTrick,
    promptTrickWord,
    startTraining
};
