/* state.js — Constants, the save file, and the small shared helpers.
   Split out of index.html's single script block; logic unchanged. */

import { bath, park, pet, spawnHearts } from './actions.js';
import { generateSong } from './chat.js';
import { speak } from './ui.js';

/* ═══════════════════════════════════════════════════════════════
   PETPAL v4 — Full-featured AI companion + Journal + Shooter
   ═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "petpal.v4";
const STAT_KEYS = ["hunger", "thirst", "clean", "energy", "fun", "health"];
const STAT_LABELS = { hunger: "Full", thirst: "Hydra", clean: "Clean", energy: "Rest", fun: "Fun", health: "Health" };
/* energy (the "Rest" stat) was 0.05 — halved on request so Rest lasts twice
   as long before the pet gets tired. The night-time ×2 multiplier in main.js
   tick() is relative to this base rate, so halving it here doubles time-to-
   empty at night too, not just during the day. */
const DRAIN = { hunger: 0.08, thirst: 0.12, clean: 0.05, energy: 0.025, fun: 0.06, health: 0.01 };

const STAGES = [
    { name: "Egg", until: 0.02, size: 0.55 },
    { name: "Baby", until: 0.3, size: 0.75, pitch: 1.8 },
    { name: "Kid", until: 1, size: 0.9, pitch: 1.5 },
    { name: "Teen", until: 3, size: 1.0, pitch: 1.2 },
    { name: "Adult", until: 999, size: 1.1, pitch: 1.0 }
];

const STOPWORDS = new Set(("a an the is are was were be been being do does did have has had " +
    "i you he she it we they me him her us them my your his hers our their this that these those " +
    "of in on at to for with by from and or but not so if then than as at").split(" "));

/* `tint` is the colour the travel veil fades through on the way in —
   a white flash into Space or Night reads as a camera fault. */
const LOCATIONS = [
    { id: "home", label: "🏠 Home", bgClass: "", tint: "#f2ede4" },
    { id: "park", label: "🌳 Park", bgClass: "park-bg", tint: "#9ad39e" },
    { id: "beach", label: "🏖 Beach", bgClass: "beach-bg", tint: "#ffeccb" },
    { id: "school", label: "🏫 School", bgClass: "school-bg", tint: "#d9d0b4" },
    { id: "mall", label: "🛍 Mall", bgClass: "mall-bg", tint: "#eadff2" },
    { id: "lab", label: "🔬 Lab", bgClass: "lab-bg", tint: "#d3e9ee" },
    { id: "hospital", label: "🏥 Hospital", bgClass: "hospital-bg", tint: "#e9f5f8" },
    { id: "forest", label: "🌲 Forest", bgClass: "forest-bg", tint: "#79ae6f" },
    { id: "city", label: "🏙 City", bgClass: "city-bg", tint: "#93a2b0" },
    { id: "mountain", label: "⛰ Mountain", bgClass: "mountain-bg", tint: "#cfd9e2" },
    { id: "space", label: "🚀 Space", bgClass: "space-bg", tint: "#12123a" },
    { id: "snow", label: "❄️ Snow", bgClass: "snow-bg", tint: "#e8f0f8" },
    { id: "rain", label: "🌧 Rain", bgClass: "rain-bg", tint: "#59697a" },
    { id: "bath", label: "🛁 Bath", bgClass: "bath-bg", tint: "#bde3f0" },
    { id: "dusk", label: "🌅 Dusk", bgClass: "dusk-bg", tint: "#a86a72" },
    { id: "dawn", label: "🌄 Dawn", bgClass: "dawn-bg", tint: "#ffcaa8" },
    { id: "night", label: "🌙 Night", bgClass: "night-bg", tint: "#1e2c4e" },
];

const PLAYMATES = [
    { id: "cat", name: "Kitty", icon: "🐱", price: 80, color: "#f4a8b3" },
    { id: "dog", name: "Puppy", icon: "🐶", price: 100, color: "#c9b88a" },
    { id: "bird", name: "Birb", icon: "🐦", price: 60, color: "#a8d8f7" },
    { id: "bunny", name: "Bunny", icon: "🐰", price: 70, color: "#ffd6a5" },
    { id: "fox", name: "Fox", icon: "🦊", price: 90, color: "#e8a87a" },
    { id: "panda", name: "Panda", icon: "🐼", price: 120, color: "#ddd" },
    { id: "unicorn", name: "Unicorn", icon: "🦄", price: 200, color: "#f0a8d8" },
    { id: "dragon", name: "Dragon", icon: "🐉", price: 250, color: "#7ac4a8" },
];

const SHOP_FOODS = [
    { id: "apple", name: "Apple", icon: "🍎", price: 5, effects: { hunger: 30 } },
    { id: "cake", name: "Cake", icon: "🍰", price: 15, effects: { hunger: 50, fun: 10, health: 5 } },
    { id: "pizza", name: "Pizza", icon: "🍕", price: 20, effects: { hunger: 60, fun: 5 } },
    { id: "vitamin", name: "Vitamin", icon: "💊+", price: 30, effects: { health: 60 } },
    { id: "juice", name: "Juice", icon: "🧃", price: 12, effects: { thirst: 60, fun: 5 } },
    { id: "cookie", name: "Cookie", icon: "🍪", price: 10, effects: { hunger: 20, fun: 15 } },
    { id: "fish", name: "Fish", icon: "🐟", price: 25, effects: { hunger: 40, health: 10 } },
    { id: "berry", name: "Berry", icon: "🫐", price: 8, effects: { hunger: 15, health: 5 } },
];

const SHOP_ACCESSORIES = [
    { id: "tophat", name: "Top hat", icon: "🎩", price: 50, slot: "hat" },
    { id: "crown", name: "Crown", icon: "👑", price: 100, slot: "hat" },
    { id: "gradcap", name: "Grad cap", icon: "🎓", price: 40, slot: "hat" },
    { id: "cap", name: "Cap", icon: "🧢", price: 30, slot: "hat" },
    { id: "shades", name: "Shades", icon: "😎", price: 40, slot: "eyes" },
    { id: "nerd", name: "Glasses", icon: "🤓", price: 40, slot: "eyes" },
    { id: "bow", name: "Bow", icon: "🎀", price: 30, slot: "neck" },
    { id: "scarf", name: "Scarf", icon: "🧣", price: 40, slot: "neck" },
    { id: "flower", name: "Flower", icon: "🌺", price: 25, slot: "hat" },
    { id: "star", name: "Star", icon: "⭐", price: 60, slot: "hat" },
];

const ACHIEVEMENTS = {
    first_pet: { label: "First pet", icon: "🐣", desc: "Hatch your first pet" },
    level_2: { label: "Growing up", icon: "🌱", desc: "Reach Baby stage" },
    level_3: { label: "Kid", icon: "🧒", desc: "Reach Kid stage" },
    level_4: { label: "Teen", icon: "🧑", desc: "Reach Teen stage" },
    level_5: { label: "Adult", icon: "🧔", desc: "Reach Adult stage" },
    coins_100: { label: "Savvy", icon: "💰", desc: "Earn 100 coins" },
    coins_500: { label: "Rich", icon: "💎", desc: "Earn 500 coins" },
    playmate_1: { label: "Friend", icon: "🤝", desc: "Buy first playmate" },
    playmate_3: { label: "Party", icon: "🎉", desc: "Buy 3 playmates" },
    playmate_5: { label: "Menagerie", icon: "🐾", desc: "Buy 5 playmates" },
    photos_5: { label: "Photographer", icon: "📸", desc: "Take 5 photos" },
    photos_20: { label: "Shutterbug", icon: "📷", desc: "Take 20 photos" },
    hunt_10: { label: "Hunter", icon: "🏹", desc: "Catch 10 hunt items" },
    hunt_50: { label: "Master Hunter", icon: "🎯", desc: "Catch 50 hunt items" },
    chat_50: { label: "Chatterbox", icon: "💬", desc: "Send 50 messages" },
    chat_200: { label: "Talkative", icon: "🗣", desc: "Send 200 messages" },
    tricks_3: { label: "Smart", icon: "🧠", desc: "Train 3 tricks" },
    tricks_6: { label: "Genius", icon: "🎓", desc: "Train 6 tricks" },
    notes_5: { label: "Note-taker", icon: "📝", desc: "Write 5 notes" },
    journal_5: { label: "Diary", icon: "📖", desc: "Write 5 journal entries" },
    shooter_score_100: { label: "Pilot", icon: "✈️", desc: "Score 100 in Shooter" },
    shooter_score_300: { label: "Ace", icon: "🏆", desc: "Score 300 in Shooter" },
};

const TRICK_ACTIONS = {
    spin: { name: "spin", class: "spin", emoji: "🌀" },
    jump: { name: "jump", class: "jump", emoji: "⬆" },
    dance: { name: "dance", class: "dance", emoji: "💃" },
    sing: { name: "sing", class: "", emoji: "🎵", handler: () => speak(generateSong()) },
    sit: { name: "sit", class: "", emoji: "🪑", handler: () => setMoodOverride("idle", 2000) },
    hug: { name: "hug", class: "", emoji: "🤗", handler: () => { spawnHearts(4);
            setMoodOverride("loved", 3000); } },
    wave: { name: "wave", class: "", emoji: "👋", handler: () => speak("👋 Hi!") },
    roll: { name: "roll", class: "spin", emoji: "🔄", handler: () => speak("*rolls over*") },
};

const AFFECTION_WORDS = ["love", "cute", "good", "sweet", "dear", "baby", "honey", "precious", "angel", "adorable"];
const GREETING_WORDS = ["hi", "hello", "hey", "yo", "hola", "morning", "evening", "howdy"];
const QUESTIONS = ["how", "what", "why", "where", "when", "who", "are", "do"];
const BAD_WORDS = ["bad", "stupid", "dumb", "hate", "ugly", "gross"];
const HUNT_ITEMS = ["🐭", "🐿", "🦋", "🐞", "🐜", "🐛", "🪲", "🐝", "🦗", "🐌", "🕷", "🦟"];

const WEATHERS = [
    { id: "clear", label: "☀️ Clear", chance: 0.4 },
    { id: "cloudy", label: "☁️ Cloudy", chance: 0.25 },
    { id: "rainy", label: "🌧 Rainy", chance: 0.15 },
    { id: "snowy", label: "❄️ Snowy", chance: 0.1 },
    { id: "stormy", label: "⛈ Stormy", chance: 0.05 },
    { id: "foggy", label: "🌫 Foggy", chance: 0.05 },
];

/* ─── STATE ─── */
const DEFAULT_STATE = () => ({
    name: "Blob",
    born: Date.now(),
    lastTick: Date.now(),
    lastPet: 0,
    hunger: 80,
    thirst: 80,
    clean: 100,
    energy: 100,
    fun: 70,
    health: 100,
    sleeping: false,
    scene: "home",
    moodOverride: null,
    moodUntil: 0,
    traits: { playful: 20, affectionate: 20, talkative: 10, curious: 20, independent: 30 },
    vocab: {},
    phrases: [],
    totalMessages: 0,
    memories: [],
    color: null,
    coins: 30,
    inventory: { apple: 3 },
    ownedAccessories: [],
    equipped: { hat: null, eyes: null, neck: null, weapon: null },
    ownedWeapons: [],
    voiceEnabled: false,
    notificationsEnabled: false,
    autoDayNight: true,
    tricks: {},
    pendingTrick: null,
    lastAutoChat: 0,
    lastNotifyAt: 0,
    stageAnnounced: "Egg",
    playmates: [],
    photos: [],
    achievements: {},
    dailyLogin: { last: 0, streak: 0, claimed: false },
    weather: { id: "clear", changedAt: 0 },
    huntStats: { caught: 0, total: 0 },
    petX: 50,
    petY: 50,
    lastDailyClaim: 0,
    locationUnlocked: ["home", "park", "bath", "hospital"],
    totalCoinsEarned: 0,
    tricksLearned: 0,
    notes: [],
    appointments: [],
    contacts: [],
    journal: [],
    shooterHighScore: 0,
    render3d: true,     // three.js pet; falls back to the SVG if WebGL is absent
    /* Only the XP total is persisted — level and every combat stat are derived
       from it in rpg.js, so the curve can be retuned without touching saves. */
    xp: 0,
    levelAnnounced: 1,
    bossesCleared: [],          // boss ids beaten, for the first-clear bonus
    quotePack: [],               // filtered quotes fetched via the Quotes panel
    quotePackFetchedAt: 0,
    lastDailyBattle: 0,
    encountersOn: true,         // random fights while exploring
});

let state = load();

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATE();
        const parsed = JSON.parse(raw);
        const def = DEFAULT_STATE();
        for (const k of Object.keys(def)) {
            if (!(k in parsed)) parsed[k] = def[k];
        }
        return parsed;
    } catch (e) { return DEFAULT_STATE(); }
}

function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ─── HELPERS ─── */
function ageInHours() { return (Date.now() - state.born) / (1000 * 60 * 60); }

function getStage() {
    const h = ageInHours();
    for (const s of STAGES)
        if (h < s.until) return s;
    return STAGES[STAGES.length - 1];
}

function pickReply(a) { return a[Math.floor(Math.random() * a.length)]; }

function randomLearnedWord() {
    const w = Object.keys(state.vocab).filter(x => state.vocab[x].count >= 2);
    return w.length ? w[Math.floor(Math.random() * w.length)] : "";
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function rand(min, max) { return Math.random() * (max - min) + min; }

function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function getTimeOfDay() {
    const h = new Date().getHours();
    if (h >= 5 && h < 8) return "dawn";
    if (h >= 8 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
}

function getMood() {
    if (state.moodOverride && Date.now() < state.moodUntil) return state.moodOverride;
    if (state.sleeping) return "sleeping";
    if (state.health < 30) return "sick";
    if (state.hunger < 25) return "hungry";
    if (state.thirst < 20) return "hungry";
    if (state.clean < 25) return "sad";
    if (state.energy < 20) return "sad";
    if (state.fun < 20) return "sad";
    const avg = (state.hunger + state.thirst + state.clean + state.fun + state.energy) / 5;
    if (avg > 85) return "excited";
    if (avg > 70) return "happy";
    return "idle";
}

function setMoodOverride(m, ms) { state.moodOverride = m;
    state.moodUntil = Date.now() + ms; }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export {
    ACHIEVEMENTS,
    AFFECTION_WORDS,
    BAD_WORDS,
    DEFAULT_STATE,
    DRAIN,
    GREETING_WORDS,
    HUNT_ITEMS,
    LOCATIONS,
    PLAYMATES,
    QUESTIONS,
    SHOP_ACCESSORIES,
    SHOP_FOODS,
    STAGES,
    STAT_KEYS,
    STAT_LABELS,
    STOPWORDS,
    STORAGE_KEY,
    TRICK_ACTIONS,
    WEATHERS,
    ageInHours,
    clamp,
    getMood,
    getStage,
    getTimeOfDay,
    load,
    pickReply,
    rand,
    randInt,
    randomLearnedWord,
    save,
    setMoodOverride,
    state,
    uid
};
