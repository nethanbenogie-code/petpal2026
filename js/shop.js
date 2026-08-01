/* shop.js — Food, accessories and playmates.
   Split out of index.html's single script block; logic unchanged. */

import { feed } from './actions.js';
import { spendCoins } from './economy.js';
import { closeModal, openModal } from './journal.js';
import { updateUI } from './main.js';
import { buyPlaymate } from './petmove.js';
import { PLAYMATES, SHOP_ACCESSORIES, SHOP_FOODS, save, state } from './state.js';
import { chirp, toast } from './ui.js';
/* ─── SHOP ─── */
let shopTab = "foods";

function openShop() {
    const pmItems = PLAYMATES.map(p => {
        const owned = state.playmates.some(m => m.id === p.id);
        return `<div class="shop-item ${owned?'owned':''}" data-playmate="${p.id}">
      <div class="item-icon">${p.icon}</div>
      <div class="item-name">${p.name}</div>
      <div class="item-price">${owned ? "owned" : `${p.price} 💰`}</div>
    </div>`;
    }).join("");

    openModal("🛍 Shop", `
    <div class="shop-tabs">
      <button class="shop-tab ${shopTab==='foods'?'active':''}" data-tab="foods">🍎 Foods</button>
      <button class="shop-tab ${shopTab==='accessories'?'active':''}" data-tab="accessories">🎩 Gear</button>
      <button class="shop-tab ${shopTab==='playmates'?'active':''}" data-tab="playmates">🐾 Friends</button>
    </div>
    <div id="shop-list-container">${renderShopList()}</div>
  `);
    setTimeout(() => {
        document.querySelectorAll(".shop-tab").forEach(t => {
            t.onclick = () => { shopTab = t.dataset.tab;
                openShop(); };
        });
        bindShopItems();
    }, 50);
}

function renderShopList() {
    if (shopTab === "foods") {
        return `<div class="shop-list">${SHOP_FOODS.map(f => {
      const owned = state.inventory[f.id] || 0;
      return `<div class="shop-item ${owned?'owned':''}" data-food="${f.id}">
        <div class="item-icon">${f.icon}</div>
        <div class="item-name">${f.name}</div>
        <div class="item-price">${owned ? `x${owned}` : `${f.price} 💰`}</div>
      </div>`;
    }).join("")}</div>`;
    } else if (shopTab === "accessories") {
        return `<div class="shop-list">${SHOP_ACCESSORIES.map(a => {
      const owned = state.ownedAccessories.includes(a.id);
      const equipped = state.equipped[a.slot] === a.id;
      return `<div class="shop-item ${owned?'owned':''} ${equipped?'equipped':''}" data-acc="${a.id}">
        <div class="item-icon">${a.icon}</div>
        <div class="item-name">${a.name}</div>
        <div class="item-price">${owned ? (equipped ? "worn" : "tap to wear") : `${a.price} 💰`}</div>
      </div>`;
    }).join("")}</div>`;
    } else {
        return `<div class="shop-list">${PLAYMATES.map(p => {
      const owned = state.playmates.some(m => m.id === p.id);
      return `<div class="shop-item ${owned?'owned':''}" data-playmate="${p.id}">
        <div class="item-icon">${p.icon}</div>
        <div class="item-name">${p.name}</div>
        <div class="item-price">${owned ? "owned" : `${p.price} 💰`}</div>
      </div>`;
    }).join("")}</div>`;
    }
}

function bindShopItems() {
    document.querySelectorAll("[data-food]").forEach(el => {
        el.onclick = () => {
            const id = el.dataset.food;
            const f = SHOP_FOODS.find(x => x.id === id);
            if (state.inventory[id] > 0) { closeModal();
                feed(id); } else {
                if (spendCoins(f.price)) {
                    state.inventory[id] = (state.inventory[id] || 0) + 1;
                    save();
                    toast(`Bought ${f.name}!`);
                    openShop();
                }
            }
        };
    });
    document.querySelectorAll("[data-acc]").forEach(el => {
        el.onclick = () => {
            const id = el.dataset.acc;
            const a = SHOP_ACCESSORIES.find(x => x.id === id);
            if (state.ownedAccessories.includes(id)) {
                if (state.equipped[a.slot] === id) { state.equipped[a.slot] = null; } else { state.equipped[a
                        .slot] = id; }
                save();
                updateUI();
                chirp("beep");
                openShop();
            } else {
                if (spendCoins(a.price)) {
                    state.ownedAccessories.push(id);
                    state.equipped[a.slot] = id;
                    save();
                    updateUI();
                    toast(`Got ${a.name}!`);
                    chirp("love");
                    openShop();
                }
            }
        };
    });
    document.querySelectorAll("[data-playmate]").forEach(el => {
        el.onclick = () => { buyPlaymate(el.dataset.playmate); };
    });
}

export {
    bindShopItems,
    openShop,
    renderShopList,
    shopTab
};
