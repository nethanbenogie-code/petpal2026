/* minigames.js — Catch, and the launcher for the arcade window.
   Split out of index.html's single script block; logic unchanged. */

import { earnCoins } from './economy.js';
import { closeModal, openModal } from './journal.js';
import { save, state } from './state.js';
/* ─── MINI-GAMES ─── */
function openGames() {
  // Open games.html in a new window/tab
  window.open('games.html', '_blank', 'width=600,height=700,resizable=yes');
}

let catchGame = null;

function playCatch() {
    catchGame = { score: 0, misses: 0, round: 0, running: true };
    openModal("🎯 Catch the treat", `
    <div class="game-score">
      <span>Score: <span id="c-score">0</span></span>
      <span>Round: <span id="c-round">0</span>/10</span>
    </div>
    <div class="game-area" id="catch-area"></div>
    <p style="font-size:11px; color:#888; text-align:center;">Tap treats before they fall!</p>
  `);
    setTimeout(nextCatchRound, 400);
}

function nextCatchRound() {
    if (!catchGame || !catchGame.running) return;
    const area = document.getElementById("catch-area");
    if (!area) { catchGame = null; return; }
    if (catchGame.round >= 10) { endCatch(); return; }
    catchGame.round++;
    document.getElementById("c-round").textContent = catchGame.round;
    const treat = document.createElement("div");
    treat.className = "game-treat";
    treat.textContent = ["🍎", "🍬", "🍰", "🍓", "🍩", "🍪", "🍭"][Math.floor(Math.random() * 7)];
    treat.style.left = (Math.random() * 80 + 5) + "%";
    let caught = false;
    treat.onclick = () => {
        if (caught) return;
        caught = true;
        catchGame.score++;
        document.getElementById("c-score").textContent = catchGame.score;
        treat.remove();
        setTimeout(nextCatchRound, 350);
    };
    area.appendChild(treat);
    setTimeout(() => { if (!caught && treat.parentNode) { treat.remove();
            catchGame.misses++;
            setTimeout(nextCatchRound, 350); } }, 2200);
}

function endCatch() {
    const s = catchGame.score;
    catchGame = null;
    const reward = s * 3 + 5;
    earnCoins(reward);
    state.fun = Math.min(100, state.fun + s * 2);
    save();
    openModal("Game over!", `
    <p style="text-align:center; font-size:15px;">Caught <b>${s}</b> treats!</p>
    <p style="text-align:center; font-size:20px; color:#b58900;">+${reward} 💰</p>
    <div class="modal-actions">
      <button class="btn-primary" id="c-again">Play again</button>
      <button class="btn-secondary" onclick="closeModal()">Done</button>
    </div>
  `);
    setTimeout(() => { document.getElementById("c-again").onclick = () => { closeModal();
            playCatch(); }; }, 50);
}

let memGame = null;

function playMemory() {
    const icons = ["🍎", "🍰", "🍕", "🎾", "🎨", "💎", "🐱", "🌈"];
    const cards = [...icons.slice(0, 6)].concat([...icons.slice(0, 6)]).sort(() => Math.random() - 0.5);
    memGame = { cards, flipped: [], matched: [], moves: 0 };
    openModal("🃏 Memory match", `
    <div class="game-score">
      <span>Moves: <span id="m-moves">0</span></span>
      <span>Pairs: <span id="m-pairs">0</span>/6</span>
    </div>
    <div class="memory-grid" id="mem-grid">
      ${cards.map((c, i) => `<button class="memory-card" data-idx="${i}" data-icon="${c}"></button>`).join("")}
    </div>
  `);
    setTimeout(() => {
        document.querySelectorAll(".memory-card").forEach(card => {
            card.onclick = () => memFlip(parseInt(card.dataset.idx));
        });
    }, 50);
}

function memFlip(idx) {
    if (!memGame) return;
    if (memGame.matched.includes(idx) || memGame.flipped.includes(idx)) return;
    if (memGame.flipped.length >= 2) return;
    const card = document.querySelector(`[data-idx="${idx}"]`);
    card.textContent = memGame.cards[idx];
    card.classList.add("flipped");
    memGame.flipped.push(idx);
    if (memGame.flipped.length === 2) {
        memGame.moves++;
        document.getElementById("m-moves").textContent = memGame.moves;
        const [a, b] = memGame.flipped;
        if (memGame.cards[a] === memGame.cards[b]) {
            memGame.matched.push(a, b);
            document.querySelectorAll(`[data-idx="${a}"], [data-idx="${b}"]`).forEach(c => c.classList.add("matched"));
            document.getElementById("m-pairs").textContent = memGame.matched.length / 2;
            memGame.flipped = [];
            if (memGame.matched.length === memGame.cards.length) { setTimeout(endMemory, 600); }
        } else {
            setTimeout(() => {
                document.querySelectorAll(`[data-idx="${a}"], [data-idx="${b}"]`).forEach(c => {
                    c.classList.remove("flipped");
                    c.textContent = "";
                });
                memGame.flipped = [];
            }, 800);
        }
    }
}

function endMemory() {
    const moves = memGame.moves;
    memGame = null;
    const reward = Math.max(10, 50 - moves * 2);
    earnCoins(reward);
    state.fun = Math.min(100, state.fun + 15);
    save();
    openModal("You won!", `
    <p style="text-align:center; font-size:15px;">Solved in <b>${moves}</b> moves!</p>
    <p style="text-align:center; font-size:20px; color:#b58900;">+${reward} 💰</p>
    <div class="modal-actions">
      <button class="btn-primary" id="m-again">Play again</button>
      <button class="btn-secondary" onclick="closeModal()">Done</button>
    </div>
  `);
    setTimeout(() => { document.getElementById("m-again").onclick = () => { closeModal();
            playMemory(); }; }, 50);
}

export {
    catchGame,
    endCatch,
    endMemory,
    memFlip,
    memGame,
    nextCatchRound,
    openGames,
    playCatch,
    playMemory
};
