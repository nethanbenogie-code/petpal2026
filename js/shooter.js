/* shooter.js — The in-app Twin-Bee style shooter.
   Split out of index.html's single script block; logic unchanged. */

import { play } from './actions.js';
import { checkAchievements } from './economy.js';
import { closeModal, openModal } from './journal.js';
import { clamp, rand, save, state } from './state.js';
import { chirp, toast } from './ui.js';
/* ─── SHOOTER GAME (Twin-Bee style) ─── */
let shooter = null;
let shooterKeyHandler = null;
let shooterRunning = false;

function launchShooter() {
    if (shooter && shooter.running) { closeModal(); return; }
    openModal("🚀 Shooter Game", `
    <div class="shooter-container" style="position:relative;">
      <canvas id="shooterCanvas" width="320" height="480"></canvas>
      <div class="shooter-hud">
        <span>❤️ <span id="s-lives">3</span></span>
        <span>🏆 <span id="s-score">0</span></span>
        <span>🎯 <span id="s-level">1</span></span>
      </div>
      <div class="shooter-overlay show" id="s-overlay">
        <h2>🚀 Twin-Bee</h2>
        <p style="font-size:12px;">Move with ← → or tap/drag • Shoot with SPACE or tap</p>
        <button class="btn-play" id="s-start-btn">▶ Play</button>
      </div>
      <div class="shooter-touch-area" id="s-touch-area"></div>
    </div>
    <div class="shooter-controls">
      <button id="s-left">◀</button>
      <button id="s-right">▶</button>
      <button class="fire" id="s-fire">🔥 FIRE</button>
    </div>
    <p style="font-size:10px; color:#888; text-align:center; margin-top:4px;">High score: ${state.shooterHighScore||0}</p>
  `);

    setTimeout(() => {
        const canvas = document.getElementById("shooterCanvas");
        const ctx = canvas.getContext("2d");
        const overlay = document.getElementById("s-overlay");

        const game = {
            running: false,
            score: 0,
            lives: 3,
            level: 1,
            player: { x: 160, y: 430, w: 24, h: 24, speed: 4 },
            bullets: [],
            enemies: [],
            enemyBullets: [],
            stars: [],
            explosions: [],
            powerups: [],
            frames: 0,
            enemySpawnTimer: 0,
            enemySpawnRate: 40,
            maxEnemies: 5,
            keys: { left: false, right: false, fire: false },
            touchX: null,
            fireCooldown: 0,
            combo: 0,
            maxCombo: 0,
            gameOver: false,
        };

        for (let i = 0; i < 60; i++) {
            game.stars.push({ x: rand(0, 320), y: rand(0, 480), size: rand(0.5, 2), speed: rand(0.3, 1.5) });
        }

        const keys = game.keys;
        // ─── FIXED: key handler that respects form inputs ───
        function safeKeyHandler(e) {
            const tag = e.target.tagName?.toLowerCase() || '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
                return; // ✅ spacebar works in text fields
            }
            if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault();
                keys.left = true; }
            if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault();
                keys.right = true; }
            if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
                e.preventDefault();
                if (game.running && !game.gameOver) fireBullet();
            }
            if (e.key === "Enter" && game.gameOver) restartShooter();
        }

        function safeKeyUpHandler(e) {
            const tag = e.target.tagName?.toLowerCase() || '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
            if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault();
                keys.left = false; }
            if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault();
                keys.right = false; }
            if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); }
        }

        // Remove old listeners if any
        if (shooterKeyHandler) {
            document.removeEventListener('keydown', shooterKeyHandler);
            document.removeEventListener('keyup', shooterKeyHandler);
        }
        shooterKeyHandler = safeKeyHandler;
        document.addEventListener('keydown', safeKeyHandler);
        document.addEventListener('keyup', safeKeyUpHandler);

        const touchArea = document.getElementById("s-touch-area");
        touchArea.style.position = "absolute";
        touchArea.style.inset = "0";
        touchArea.style.zIndex = "2";
        touchArea.style.touchAction = "none";

        let touchActive = false;
        let touchX = null;
        let touchY = null;

        touchArea.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const t = e.touches[0];
            touchX = (t.clientX - rect.left) * scaleX;
            touchY = (t.clientY - rect.top) * scaleY;
            touchActive = true;
            if (game.running && !game.gameOver) fireBullet();
        }, { passive: false });

        touchArea.addEventListener("touchmove", (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const t = e.touches[0];
            touchX = (t.clientX - rect.left) * scaleX;
            touchY = (t.clientY - rect.top) * scaleY;
        }, { passive: false });

        touchArea.addEventListener("touchend", (e) => {
            e.preventDefault();
            touchActive = false;
            touchX = null;
            touchY = null;
        }, { passive: false });

        document.getElementById("s-left").onmousedown = () => keys.left = true;
        document.getElementById("s-left").onmouseup = () => keys.left = false;
        document.getElementById("s-left").ontouchstart = (e) => { e.preventDefault();
            keys.left = true; };
        document.getElementById("s-left").ontouchend = (e) => { e.preventDefault();
            keys.left = false; };
        document.getElementById("s-right").onmousedown = () => keys.right = true;
        document.getElementById("s-right").onmouseup = () => keys.right = false;
        document.getElementById("s-right").ontouchstart = (e) => { e.preventDefault();
            keys.right = true; };
        document.getElementById("s-right").ontouchend = (e) => { e.preventDefault();
            keys.right = false; };
        document.getElementById("s-fire").onclick = () => { if (game.running && !game.gameOver) fireBullet(); };
        document.getElementById("s-fire").ontouchstart = (e) => { e.preventDefault(); if (game.running && !game
                .gameOver) fireBullet(); };

        function fireBullet() {
            if (game.fireCooldown > 0) return;
            game.bullets.push({ x: game.player.x + 10, y: game.player.y - 8, w: 4, h: 12, speed: 7 });
            game.bullets.push({ x: game.player.x + 10, y: game.player.y - 8, w: 4, h: 12, speed: 7 });
            game.fireCooldown = 8;
            if (game.powerups.some(p => p.type === "spread" && p.active)) {
                game.bullets.push({ x: game.player.x - 4, y: game.player.y - 4, w: 4, h: 10, speed: 6, dx: -1.5 });
                game.bullets.push({ x: game.player.x + 20, y: game.player.y - 4, w: 4, h: 10, speed: 6, dx: 1.5 });
            }
            chirp("beep");
        }

        function spawnEnemy() {
            const types = ["basic", "fast", "tank"];
            let type = types[0];
            let r = Math.random();
            if (r < 0.2 && game.level > 2) type = "fast";
            if (r < 0.1 && game.level > 4) type = "tank";

            const configs = {
                basic: { w: 20, h: 20, hp: 1, speed: 1.2 + game.level * 0.1, score: 10, color: "#ff6b6b" },
                fast: { w: 16, h: 16, hp: 1, speed: 2.5 + game.level * 0.1, score: 20, color: "#ffd93d" },
                tank: { w: 28, h: 28, hp: 3, speed: 0.8 + game.level * 0.05, score: 30, color: "#6bcbff" },
            };
            const cfg = configs[type];
            const x = rand(10, 310 - cfg.w);
            const enemy = {
                x,
                y: -cfg.h,
                w: cfg.w,
                h: cfg.h,
                hp: cfg.hp,
                maxHp: cfg.hp,
                speed: cfg.speed,
                score: cfg.score,
                color: cfg.color,
                type,
                shootTimer: rand(60, 180),
                wobble: rand(0, Math.PI * 2),
                wobbleSpeed: rand(0.02, 0.06),
            };
            game.enemies.push(enemy);
        }

        function spawnPowerup(x, y) {
            if (Math.random() < 0.08) {
                const types = ["spread", "speed", "shield"];
                const type = types[Math.floor(Math.random() * types.length)];
                game.powerups.push({ x, y, w: 16, h: 16, type, active: true, speed: 1.5, icon: type === "spread" ?
                        "⭐" : type === "speed" ? "⚡" : "🛡" });
            }
        }

        function updateShooter() {
            if (!game.running || game.gameOver) return;
            game.frames++;
            game.fireCooldown = Math.max(0, game.fireCooldown - 1);

            let dx = 0;
            if (keys.left || keys.right) {
                if (keys.left) dx = -game.player.speed;
                if (keys.right) dx = game.player.speed;
            } else if (touchActive && touchX !== null) {
                const targetX = touchX - game.player.w / 2;
                const diff = targetX - game.player.x;
                if (Math.abs(diff) > 2) {
                    dx = Math.sign(diff) * Math.min(game.player.speed, Math.abs(diff));
                }
            }
            game.player.x = clamp(game.player.x + dx, 0, 320 - game.player.w);
            if (touchActive && touchY !== null && touchY < game.player.y - 20) {
                if (game.fireCooldown === 0) fireBullet();
            }

            for (const s of game.stars) {
                s.y += s.speed;
                if (s.y > 480) { s.y = 0;
                    s.x = rand(0, 320); }
            }

            for (const b of game.bullets) {
                b.y -= b.speed;
                if (b.dx) b.x += b.dx;
            }
            game.bullets = game.bullets.filter(b => b.y > -10 && b.x > -10 && b.x < 330);

            for (const b of game.enemyBullets) {
                b.y += b.speed;
                b.x += b.dx || 0;
            }
            game.enemyBullets = game.enemyBullets.filter(b => b.y < 490);

            for (const e of game.enemies) {
                e.y += e.speed;
                e.wobble += e.wobbleSpeed;
                e.x += Math.sin(e.wobble) * 0.5;
                e.x = clamp(e.x, 0, 320 - e.w);
                e.shootTimer--;
                if (e.shootTimer <= 0 && e.y > 30) {
                    e.shootTimer = rand(60, 180 - game.level * 5);
                    const dx = (game.player.x + game.player.w / 2) - (e.x + e.w / 2);
                    const dy = (game.player.y + game.player.h / 2) - (e.y + e.h / 2);
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        game.enemyBullets.push({
                            x: e.x + e.w / 2 - 3,
                            y: e.y + e.h,
                            w: 6,
                            h: 6,
                            speed: 2 + game.level * 0.2,
                            dx: (dx / dist) * 0.8,
                        });
                    }
                }
            }

            game.enemySpawnTimer--;
            if (game.enemySpawnTimer <= 0 && game.enemies.length < game.maxEnemies + game.level) {
                spawnEnemy();
                game.enemySpawnTimer = Math.max(15, game.enemySpawnRate - game.level * 2);
            }

            for (const b of game.bullets) {
                for (const e of game.enemies) {
                    if (b.x < e.x + e.w && b.x + b.w > e.x &&
                        b.y < e.y + e.h && b.y + b.h > e.y) {
                        e.hp--;
                        b.y = -100;
                        if (e.hp <= 0) {
                            const idx = game.enemies.indexOf(e);
                            if (idx > -1) {
                                game.enemies.splice(idx, 1);
                                game.score += e.score;
                                game.combo++;
                                if (game.combo > game.maxCombo) game.maxCombo = game.combo;
                                spawnPowerup(e.x + e.w / 2, e.y + e.h / 2);
                                game.explosions.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, life: 15, maxLife: 15,
                                    size: e.w });
                                chirp("hunt");
                                document.getElementById("s-score").textContent = game.score;
                                const newLevel = Math.floor(game.score / 50) + 1;
                                if (newLevel > game.level) {
                                    game.level = newLevel;
                                    document.getElementById("s-level").textContent = game.level;
                                    toast(`🎯 Level ${game.level}!`, "achievement");
                                    chirp("level");
                                    game.lives = Math.min(5, game.lives + 1);
                                    document.getElementById("s-lives").textContent = game.lives;
                                }
                            }
                        }
                        break;
                    }
                }
            }

            for (const b of game.enemyBullets) {
                const px = game.player.x,
                    py = game.player.y,
                    pw = game.player.w,
                    ph = game.player.h;
                if (b.x < px + pw && b.x + b.w > px &&
                    b.y < py + ph && b.y + b.h > py) {
                    b.y = 500;
                    hitPlayer();
                }
            }

            for (const e of game.enemies) {
                const px = game.player.x,
                    py = game.player.y,
                    pw = game.player.w,
                    ph = game.player.h;
                if (e.x < px + pw && e.x + e.w > px &&
                    e.y < py + ph && e.y + e.h > py) {
                    const idx = game.enemies.indexOf(e);
                    if (idx > -1) game.enemies.splice(idx, 1);
                    hitPlayer();
                    break;
                }
            }

            for (const p of game.powerups) {
                p.y += p.speed;
                const px = game.player.x,
                    py = game.player.y,
                    pw = game.player.w,
                    ph = game.player.h;
                if (p.x < px + pw && p.x + p.w > px &&
                    p.y < py + ph && p.y + p.h > py) {
                    p.active = false;
                    if (p.type === "spread") {
                        game.powerups = game.powerups.filter(p2 => p2.type !== "spread" || p2 === p);
                        p.active = true;
                        p.life = 300;
                        toast("⭐ Spread shot!", "achievement");
                    } else if (p.type === "speed") {
                        game.player.speed = 6;
                        setTimeout(() => { game.player.speed = 4; }, 5000);
                        toast("⚡ Speed boost!", "achievement");
                    } else if (p.type === "shield") {
                        game.lives = Math.min(5, game.lives + 1);
                        document.getElementById("s-lives").textContent = game.lives;
                        toast("🛡 Extra life!", "achievement");
                    }
                    chirp("coin");
                }
            }
            game.powerups = game.powerups.filter(p => p.active && p.y < 490);

            for (const p of game.powerups) {
                if (p.life !== undefined) {
                    p.life--;
                    if (p.life <= 0) p.active = false;
                }
            }
            game.powerups = game.powerups.filter(p => p.active);

            game.enemies = game.enemies.filter(e => e.y < 490);

            if (game.lives <= 0) {
                game.gameOver = true;
                game.running = false;
                if (game.score > state.shooterHighScore) {
                    state.shooterHighScore = game.score;
                    save();
                    toast("🏆 New high score!", "achievement");
                    checkAchievements();
                }
                overlay.classList.add("show");
                overlay.innerHTML = `
          <h2>💥 Game Over</h2>
          <p>Score: ${game.score}</p>
          <p style="font-size:12px;">Combo: ${game.maxCombo} | Level: ${game.level}</p>
          <p style="font-size:11px; color:${game.score>state.shooterHighScore?'#ffd93d':'#888'};">High score: ${state.shooterHighScore}</p>
          <button class="btn-play" id="s-restart-btn">🔄 Restart</button>
        `;
                document.getElementById("s-restart-btn").onclick = restartShooter;
                document.getElementById("s-score").textContent = game.score;
            }

            document.getElementById("s-lives").textContent = game.lives;
            document.getElementById("s-score").textContent = game.score;
            document.getElementById("s-level").textContent = game.level;

            drawShooter(game, ctx);
            requestAnimationFrame(updateShooter);
        }

        function hitPlayer() {
            game.lives--;
            document.getElementById("s-lives").textContent = game.lives;
            chirp("sad");
            game.explosions.push({ x: game.player.x + game.player.w / 2, y: game.player.y + game.player.h / 2,
                life: 20, maxLife: 20, size: 30 });
            game.player.x = 160 - game.player.w / 2;
            game.combo = 0;
            if (game.lives <= 0) {
                game.gameOver = true;
                game.running = false;
            }
        }

        function drawShooter(g, ctx) {
            ctx.clearRect(0, 0, 320, 480);

            for (const s of g.stars) {
                ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.random()*0.3})`;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            }

            for (const p of g.powerups) {
                ctx.font = "16px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = "rgba(255,255,255,0.3)";
                ctx.shadowBlur = 8;
                ctx.fillText(p.icon, p.x + p.w / 2, p.y + p.h / 2);
                ctx.shadowBlur = 0;
            }

            for (const b of g.enemyBullets) {
                ctx.fillStyle = "#ff6b6b";
                ctx.shadowColor = "#ff6b6b";
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(b.x + 3, b.y + 3, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            for (const e of g.enemies) {
                ctx.fillStyle = e.color;
                ctx.shadowColor = e.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                if (e.type === "tank") {
                    ctx.roundRect(e.x, e.y, e.w, e.h, 4);
                } else if (e.type === "fast") {
                    ctx.beginPath();
                    ctx.moveTo(e.x + e.w / 2, e.y);
                    ctx.lineTo(e.x + e.w, e.y + e.h);
                    ctx.lineTo(e.x, e.y + e.h);
                    ctx.closePath();
                } else {
                    ctx.roundRect(e.x, e.y, e.w, e.h, 6);
                }
                ctx.fill();
                ctx.shadowBlur = 0;
                if (e.maxHp > 1) {
                    ctx.fillStyle = "#333";
                    ctx.fillRect(e.x, e.y - 6, e.w, 3);
                    ctx.fillStyle = "#6bcbff";
                    ctx.fillRect(e.x, e.y - 6, (e.hp / e.maxHp) * e.w, 3);
                }
                ctx.fillStyle = "white";
                ctx.fillRect(e.x + 4, e.y + 4, 4, 4);
                ctx.fillRect(e.x + e.w - 8, e.y + 4, 4, 4);
                ctx.fillStyle = "#222";
                ctx.fillRect(e.x + 5, e.y + 5, 2, 2);
                ctx.fillRect(e.x + e.w - 7, e.y + 5, 2, 2);
            }

            for (const b of g.bullets) {
                ctx.fillStyle = "#ffd93d";
                ctx.shadowColor = "#ffd93d";
                ctx.shadowBlur = 12;
                ctx.fillRect(b.x, b.y, b.w, b.h);
                ctx.shadowBlur = 0;
            }

            const p = g.player;
            ctx.shadowColor = "#6bcbff";
            ctx.shadowBlur = 15;
            ctx.fillStyle = "#4a8ec4";
            ctx.beginPath();
            ctx.moveTo(p.x + p.w / 2, p.y);
            ctx.lineTo(p.x + p.w, p.y + p.h);
            ctx.lineTo(p.x, p.y + p.h);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#7bc4f0";
            ctx.beginPath();
            ctx.arc(p.x + p.w / 2, p.y + 8, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#3a7a9a";
            ctx.fillRect(p.x - 4, p.y + 8, 4, 8);
            ctx.fillRect(p.x + p.w, p.y + 8, 4, 8);
            ctx.shadowBlur = 0;

            for (const ex of g.explosions) {
                const progress = 1 - ex.life / ex.maxLife;
                const size = ex.size * (1 + progress * 1.5);
                const alpha = 1 - progress;
                ctx.fillStyle = `rgba(255,200,50,${alpha*0.6})`;
                ctx.beginPath();
                ctx.arc(ex.x, ex.y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `rgba(255,100,50,${alpha*0.4})`;
                ctx.beginPath();
                ctx.arc(ex.x, ex.y, size * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ex.life--;
            }
            g.explosions = g.explosions.filter(ex => ex.life > 0);

            if (g.combo > 2) {
                ctx.fillStyle = "#ffd93d";
                ctx.font = "14px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(`🔥 ${g.combo}x`, 160, 30);
            }
        }

        function restartShooter() {
            game.running = false;
            game.gameOver = false;
            game.score = 0;
            game.lives = 3;
            game.level = 1;
            game.combo = 0;
            game.maxCombo = 0;
            game.bullets = [];
            game.enemies = [];
            game.enemyBullets = [];
            game.explosions = [];
            game.powerups = [];
            game.frames = 0;
            game.enemySpawnTimer = 30;
            game.player.x = 160 - game.player.w / 2;
            game.player.y = 430;
            game.fireCooldown = 0;
            document.getElementById("s-lives").textContent = 3;
            document.getElementById("s-score").textContent = 0;
            document.getElementById("s-level").textContent = 1;
            overlay.classList.remove("show");
            game.running = true;
            updateShooter();
        }

        document.getElementById("s-start-btn").onclick = () => {
            overlay.classList.remove("show");
            game.running = true;
            updateShooter();
        };

        if (!CanvasRenderingContext2D.prototype.roundRect) {
            CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
                if (r > w / 2) r = w / 2;
                if (r > h / 2) r = h / 2;
                this.moveTo(x + r, y);
                this.lineTo(x + w - r, y);
                this.quadraticCurveTo(x + w, y, x + w, y + r);
                this.lineTo(x + w, y + h - r);
                this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                this.lineTo(x + r, y + h);
                this.quadraticCurveTo(x, y + h, x, y + h - r);
                this.lineTo(x, y + r);
                this.quadraticCurveTo(x, y, x + r, y);
                return this;
            };
        }

        drawShooter(game, ctx);
    }, 100);
}

export {
    launchShooter,
    shooter,
    shooterKeyHandler,
    shooterRunning
};
