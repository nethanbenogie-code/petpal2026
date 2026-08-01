/* chat.js — Message handling, vocabulary learning, replies, contacts-by-chat.
   Split out of index.html's single script block; logic unchanged. */

import { bath, medicine, park, pet, play, sleep, spawnHearts, water } from './actions.js';
import { grantXp, XP } from './rpg.js';
import { checkAchievements, earnCoins } from './economy.js';
import { shooter } from './shooter.js';
import { AFFECTION_WORDS, BAD_WORDS, GREETING_WORDS, QUESTIONS, STOPWORDS, getMood, getStage, pickReply, randomLearnedWord, save, setMoodOverride, state, uid } from './state.js';
import { finishTraining, performTrick } from './tricks.js';
import { chirp, log, speak } from './ui.js';
/* ─── CHAT ─── */
/* ─── CONTACTS OVER CHAT ──────────────────────────────────────────
   Saves and reads back a name / number / address through the chat box,
   writing into the same state.contacts the Journal's Contacts tab uses,
   so anything stored here is visible and deletable there too.

   These commands deliberately bypass learn(). Chat text is fed into
   state.vocab, and generateSpontaneous() / generateSong() pick random
   learned words to blurt out — tell the pet a phone number twice and it
   would eventually sing it. Contact data must not enter that pool. */
const FIELD_WORDS = [
    ["phone", ["contact number", "contact no", "phone number", "mobile number", "cell phone",
        "cellphone", "cp number", "telephone", "number", "phone", "mobile", "cell", "cp", "tel", "digits"
    ]],
    ["address", ["home address", "address", "addy", "location", "place"]],
    ["email", ["email address", "e-mail", "email", "mail"]],
    ["notes", ["notes", "note", "info"]],
];
const FIELD_LABEL = { phone: "number", address: "address", email: "email", notes: "note" };
const FIELD_ICON = { phone: "📞", address: "🏠", email: "✉️", notes: "📝" };

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g,
        ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } [ch]));
}

// Longest-first, so "phone number" wins over "number".
const FIELD_ALT = FIELD_WORDS.flatMap(([, w]) => w)
    .sort((a, b) => b.length - a.length).map(escRe).join("|");

function fieldFromWord(w) {
    const s = String(w).toLowerCase().trim();
    for (const [key, words] of FIELD_WORDS)
        if (words.includes(s)) return key;
    return null;
}

/* Order-independent: "save contact: Ana | 12 Mabini St | 09171234567"
   works as well as name/number/address, because each piece is
   classified by what it looks like rather than by position. */
function classifyValue(v) {
    const s = String(v).trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "email";
    const digits = (s.match(/\d/g) || []).length;
    const solid = s.replace(/[\s()\-+.]/g, "").length;
    if (digits >= 6 && solid && digits / solid > 0.7) return "phone";
    return "address";
}

function cleanName(n) {
    let s = String(n).trim()
        .replace(/^(?:that|the|a|an)\s+/i, "")
        .replace(/[?.!,;:]+$/, "").trim();
    if (/^(?:my|mine|me|myself|i)$/i.test(s)) return "Me";
    s = s.replace(/^my\s+/i, ""); // "my mom's number" -> "mom"
    return s.trim();
}

// Deliberately strict. A loose name pattern turns ordinary sentences
// into junk contacts, and a silently-created contact is worse than an
// unrecognised command.
function validName(s) {
    return !!s && s.length <= 40 && s.split(/\s+/).length <= 4 &&
        /^[\p{L}\p{N}][\p{L}\p{N} .'\-]*$/u.test(s);
}

function findContact(name) {
    const n = String(name).toLowerCase().trim();
    if (!n) return null;
    return state.contacts.find(c => (c.name || "").toLowerCase() === n) ||
        state.contacts.find(c => (c.name || "").toLowerCase().startsWith(n)) ||
        state.contacts.find(c => (c.name || "").toLowerCase().includes(n)) || null;
}

function upsertContact(name, patch) {
    let c = findContact(name);
    let created = false;
    if (!c) {
        // "my mom's number" leaves the name lowercased; tidy it for
        // display without touching names the user already capitalised.
        const display = name === name.toLowerCase() ?
            name.replace(/\b\p{L}/gu, ch => ch.toUpperCase()) : name;
        c = { id: uid(), name: display, phone: "", address: "", email: "", notes: "" };
        state.contacts.push(c);
        created = true;
    }
    const changed = [];
    for (const [k, v] of Object.entries(patch)) {
        if (!v) continue;
        const replaced = c[k] && c[k] !== v;
        c[k] = v;
        changed.push({ field: k, value: v, replaced });
    }
    return { contact: c, created, changed };
}

function contactCard(c) {
    const bits = [];
    if (c.phone) bits.push(`${FIELD_ICON.phone} ${c.phone}`);
    if (c.address) bits.push(`${FIELD_ICON.address} ${c.address}`);
    if (c.email) bits.push(`${FIELD_ICON.email} ${c.email}`);
    if (c.notes) bits.push(`${FIELD_ICON.notes} ${c.notes}`);
    return bits.length ? `${c.name} — ${bits.join("  ")}` : `I know ${c.name}, but nothing else about them yet.`;
}

function tryContactCommand(raw) {
    const text = raw.trim();
    const t = text.toLowerCase();
    let m;

    // ── list everything ──
    if (/^(?:list|show|see|read)\s+(?:me\s+)?(?:my\s+|all\s+)?contacts\b/.test(t) ||
        /^(?:my|all)\s+contacts\b/.test(t) ||
        /^who\s+do\s+you\s+(?:remember|know)\b/.test(t)) {
        if (!state.contacts.length) return "I haven't saved anyone yet. Try: remember Ana's number is 0917...";
        state.contacts.forEach(c => log("pet", contactCard(c)));
        return `I remember ${state.contacts.length} ${state.contacts.length === 1 ? "person" : "people"}!`;
    }

    // ── forget ──
    m = text.match(/^(?:forget|delete|remove)\s+(?:the\s+)?(?:contact\s+)?(.+?)[?.!]*$/i);
    if (m) {
        const name = cleanName(m[1]);
        if (validName(name)) {
            const c = findContact(name);
            if (c) {
                state.contacts = state.contacts.filter(x => x.id !== c.id);
                return `Okay, I forgot ${c.name}.`;
            }
            return `I don't have anyone called "${name}".`;
        }
    }

    // ── save a whole contact: "save contact: Ana | 0917... | 12 Mabini St" ──
    m = text.match(/^(?:save|add|new|create|store)\s+(?:a\s+|new\s+)?contact\s*[:\-]?\s*(.+)$/i);
    if (m) {
        const parts = (m[1].includes("|") ? m[1].split("|") : m[1].split(","))
            .map(s => s.trim()).filter(Boolean);
        const name = cleanName(parts.shift() || "");
        if (!validName(name)) return "What name should I save it under?";
        const patch = {};
        const leftovers = [];
        for (const p of parts) {
            const kind = classifyValue(p);
            if (kind === "address") leftovers.push(p);
            else if (!patch[kind]) patch[kind] = p;
        }
        if (leftovers.length) patch.address = leftovers.join(", ");
        const r = upsertContact(name, patch);
        return `${r.created ? "Saved" : "Updated"} ${r.contact.name}! ${contactCard(r.contact)}`;
    }

    /* ── first person: "remember my address is ..." / "what's my number"
       These carry no possessive apostrophe for the possessive patterns
       below to hook onto, so they need their own pair. Everything
       first-person is filed under one contact called "Me". */
    m = text.match(new RegExp(
        "^(?:(?:please\\s+)?(?:remember|save|note|store|keep)\\s+)?(?:that\\s+)?my\\s+(" +
        FIELD_ALT + ")\\s+(?:is|are|=|:)\\s+(.+)$", "i"));
    if (m) {
        const field = fieldFromWord(m[1]),
            value = m[2].trim().replace(/[.!]+$/, "");
        if (field && value) {
            const r = upsertContact("Me", { [field]: value });
            const ch = r.changed[0];
            return `${ch && ch.replaced ? "Updated" : "Got it"}! ${FIELD_ICON[field]} Your ${FIELD_LABEL[field]}: ${value}`;
        }
    }
    m = text.match(new RegExp(
        "^(?:what(?:'s| is| was)?|whats|give me|tell me|show me|do you know)?\\s*my\\s+(" +
        FIELD_ALT + ")\\s*\\??$", "i"));
    if (m) {
        const field = fieldFromWord(m[1]);
        if (field) {
            const c = findContact("Me");
            if (!c || !c[field]) return `You haven't told me your ${FIELD_LABEL[field]} yet.`;
            return `${FIELD_ICON[field]} Your ${FIELD_LABEL[field]}: ${c[field]}`;
        }
    }

    // ── save one field: "remember Ana's number is 0917..." ──
    m = text.match(new RegExp(
        "^(?:(?:please\\s+)?(?:remember|save|note|store|keep)\\s+)?(?:that\\s+)?" +
        "([\\p{L}\\p{N} .'\\-]{1,40}?)(?:'s|s'|’s)\\s+(" + FIELD_ALT + ")\\s+(?:is|are|=|:)\\s+(.+)$", "iu"));
    if (m) {
        const name = cleanName(m[1]),
            field = fieldFromWord(m[2]),
            value = m[3].trim().replace(/[.!]+$/, "");
        if (validName(name) && field && value) {
            const r = upsertContact(name, { [field]: value });
            const ch = r.changed[0];
            return `${ch && ch.replaced ? "Updated" : "Got it"}! ${FIELD_ICON[field]} ${r.contact.name}'s ${FIELD_LABEL[field]}: ${value}`;
        }
    }

    // ── same, phrased the other way: "remember the address of Ana is ..." ──
    m = text.match(new RegExp(
        "^(?:(?:please\\s+)?(?:remember|save|note|store|keep)\\s+)?(?:the\\s+)?(" + FIELD_ALT +
        ")\\s+(?:of|for)\\s+([\\p{L}\\p{N} .'\\-]{1,40}?)\\s+(?:is|are|=|:)\\s+(.+)$", "iu"));
    if (m) {
        const field = fieldFromWord(m[1]),
            name = cleanName(m[2]),
            value = m[3].trim().replace(/[.!]+$/, "");
        if (validName(name) && field && value) {
            const r = upsertContact(name, { [field]: value });
            const ch = r.changed[0];
            return `${ch && ch.replaced ? "Updated" : "Got it"}! ${FIELD_ICON[field]} ${r.contact.name}'s ${FIELD_LABEL[field]}: ${value}`;
        }
    }

    // ── ask for one field: "what is Ana's number" / "Ana's address?" ──
    m = text.match(new RegExp(
        "^(?:what(?:'s| is| was)?|whats|give me|tell me|show me|do you know)?\\s*(?:the\\s+)?" +
        "([\\p{L}\\p{N} .'\\-]{1,40}?)(?:'s|s'|’s)\\s+(" + FIELD_ALT + ")\\s*\\??$", "iu")) ||
        text.match(new RegExp(
            "^(?:what(?:'s| is| was)?|whats|give me|tell me|show me|do you know)\\s+(?:the\\s+)?(" +
            FIELD_ALT + ")\\s+(?:of|for)\\s+([\\p{L}\\p{N} .'\\-]{1,40}?)\\s*\\??$", "iu"));
    if (m) {
        // The two patterns capture name/field in opposite order.
        let name = cleanName(m[1]),
            field = fieldFromWord(m[2]);
        if (!field) { field = fieldFromWord(m[1]); name = cleanName(m[2]); }
        if (validName(name) && field) {
            const c = findContact(name);
            if (!c) return `I don't know anyone called "${name}" yet.`;
            if (!c[field]) return `I know ${c.name}, but I don't have their ${FIELD_LABEL[field]}.`;
            return `${FIELD_ICON[field]} ${c.name}'s ${FIELD_LABEL[field]}: ${c[field]}`;
        }
    }

    // ── ask for everything: "who is Ana" ──
    m = text.match(/^(?:who(?:'s| is| was)?|whos|tell me about|what do you know about|do you remember)\s+(.+?)[?.!]*$/i);
    if (m) {
        const name = cleanName(m[1]);
        if (validName(name)) {
            const c = findContact(name);
            // No match falls through to ordinary chat on purpose: "who is
            // your best friend" is conversation, not a failed lookup.
            if (c) return contactCard(c);
        }
    }

    return null;
}

function handleUserMessage(rawText) {
    const text = rawText.trim();
    if (!text) return;
    log("me", text);
    if (state.pendingTrick) { finishTraining(text); return; }

    // Checked before tricks and before learn(): a trick word inside
    // "remember Ana's address is Trick Street" must not hijack it, and
    // the text must never reach state.vocab.
    const contactReply = tryContactCommand(text);
    if (contactReply) {
        save();
        chirp("beep");
        setTimeout(() => speak(contactReply, 7000), 300);
        return;
    }

    const lower = text.toLowerCase();
    for (const word of Object.keys(state.tricks)) {
        if (lower.includes(word)) { performTrick(word); return; }
    }
    learn(text);
    earnCoins(1, true);
    grantXp(XP.chat);
    const response = generateResponse(text);
    setTimeout(() => speak(response, 4500), 400);
}

function learn(text) {
    state.totalMessages++;
    state.traits.talkative = Math.min(100, state.traits.talkative + 0.5);
    state.phrases.unshift(text);
    if (state.phrases.length > 30) state.phrases.pop();
    const words = text.toLowerCase().replace(/[^a-z0-9\s']/g, "").split(/\s+/);
    for (const w of words) {
        if (w.length < 3 || STOPWORDS.has(w)) continue;
        if (!state.vocab[w]) state.vocab[w] = { count: 0, lastSeen: 0 };
        state.vocab[w].count++;
        state.vocab[w].lastSeen = Date.now();
    }
    const lower = text.toLowerCase();
    if (AFFECTION_WORDS.some(w => lower.includes(w))) {
        state.traits.affectionate = Math.min(100, state.traits.affectionate + 1);
        state.fun = Math.min(100, state.fun + 5);
        spawnHearts(2);
    }
    if (BAD_WORDS.some(w => lower.includes(w))) {
        state.traits.affectionate = Math.max(0, state.traits.affectionate - 2);
        state.fun = Math.max(0, state.fun - 10);
        setMoodOverride("sad", 3000);
    }
    checkAchievements();
    save();
}

function generateResponse(text) {
    const t = text.toLowerCase();
    if (state.sleeping) return Math.random() < 0.5 ? "... zzz ..." : "mmm... sleeping...";
    if (state.health < 30) return pickReply(["*coughs* I don't feel good...", "I need medicine..."]);
    if (state.hunger < 20) return pickReply(["I'm so hungry!!", "Feed me? Please?"]);
    if (state.thirst < 20) return pickReply(["My mouth is dry...", "Water? Please?"]);
    if (state.clean < 15) return pickReply(["Ew I'm dirty...", "I need a bath"]);
    if (state.energy < 15) return pickReply(["So... tired...", "Yaaaawn"]);
    if (GREETING_WORDS.some(w => t.startsWith(w) || t.split(/\s+/).includes(w))) {
        return pickReply([`Hi friend!`, "Hello!", "Hey you!", `You're here!`]);
    }
    if (t.includes("love you") || t.includes("love u")) {
        state.traits.affectionate = Math.min(100, state.traits.affectionate + 3);
        spawnHearts(3);
        setMoodOverride("loved", 3000);
        return pickReply(["I love you too!!", "💕💕💕", "You make me so happy!"]);
    }
    if (t.includes("your name") || t.includes("who are you")) {
        return `I'm ${state.name}! Your ${getStage().name.toLowerCase()} pet!`;
    }
    if (t.includes("how are you") || t.includes("how do you feel")) return moodDescription();
    if (t.includes("what") && (t.includes("do") || t.includes("want"))) return whatDoIWant();
    if (t.includes("sing") || t.includes("song")) return generateSong();
    if (t.includes("play")) return state.energy > 30 ? pickReply(["YES PLAY!", "Fun time!"]) : "Too tired to play...";
    if (t.includes("park") || t.includes("walk")) return pickReply(["Ooh the park?", "I love outside!"]);
    if (t.includes("photo") || t.includes("picture") || t.includes("camera")) return "📸 Say cheese!";
    if (t.includes("journal") || t.includes("note") || t.includes("remember")) {
        return "📓 I can keep notes for you! Tap the 📓 button!";
    }
    if (t.includes("shooter") || t.includes("game") || t.includes("play")) {
        return "🚀 Play Shooter! Tap the 🚀 button!";
    }
    if (t.endsWith("?") || QUESTIONS.some(q => t.startsWith(q))) return generateQuestionResponse();
    return generateChatty(text);
}

function moodDescription() {
    const m = getMood();
    const map = {
        happy: ["I feel great!", "Really good today!"],
        excited: ["Amazing!!! So much energy!!", "SO GOOD!"],
        loved: ["Loved! So loved!", "My heart is full"],
        sad: ["A little sad...", "Kinda down..."],
        hungry: ["Hungry..."],
        sick: ["Not well..."],
        idle: ["I'm okay", "Just chill", "Meh, alright"],
        sleeping: ["Zzz..."]
    };
    return pickReply(map[m] || ["Just being me"]);
}

function whatDoIWant() {
    const needs = [];
    if (state.hunger < 50) needs.push("food");
    if (state.thirst < 50) needs.push("water");
    if (state.clean < 50) needs.push("a bath");
    if (state.fun < 50) needs.push("to play");
    if (state.energy < 40) needs.push("sleep");
    if (!needs.length) return pickReply(["Just hang out with you!", "Cuddles maybe?"]);
    if (needs.length === 1) return `I want ${needs[0]}!`;
    return `Maybe ${needs.slice(0, 2).join(" and ")}?`;
}

function generateQuestionResponse() {
    const w = randomLearnedWord();
    return pickReply(["Hmm... I don't know!", "Good question!", w ? `Maybe ${w}?` : "You tell me!",
        "I'm just a little pet...", w || "Hmm..."
    ]);
}

function generateChatty(userText) {
    const words = userText.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(w => w.length > 2 && !
        STOPWORDS.has(w));
    const echo = words[Math.floor(Math.random() * words.length)] || randomLearnedWord() || "you";
    const templates = [
        `${echo}? Tell me more!`, `Ooh, ${echo}!`, `${echo}!!`,
        "Mmhmm mmhmm", "*tilts head*", `I like when you say "${echo}"`,
        "Really??", "Wow!", `Say ${echo} again!`
    ];
    if (state.traits.talkative > 60) {
        const learned = Object.keys(state.vocab).filter(w => state.vocab[w].count >= 3 && w !== echo)
            .sort((a, b) => state.vocab[b].count - state.vocab[a].count);
        if (learned.length) {
            const other = learned[Math.floor(Math.random() * Math.min(5, learned.length))];
            templates.push(`${echo} and ${other}? Interesting!`, `I remember when you said ${other}`);
        }
    }
    return pickReply(templates);
}

function generateSpontaneous() {
    const m = getMood();
    if (m === "sad") return pickReply(["*sighs*", "Notice me?", "I'm lonely"]);
    if (m === "hungry") return pickReply(["*tummy rumbles*", "Snacks?"]);
    if (m === "excited") return pickReply(["Hiiii!!", "Look at me!"]);
    const w = randomLearnedWord();
    if (w && Math.random() < 0.5) return pickReply([`${w}!`, `${w}...`, `Thinking about ${w}`]);
    return pickReply(["Hmm...", "*whistles*", "La la la", "*hums*", "Boop!"]);
}

function generateSong() {
    const words = Object.entries(state.vocab).sort((a, b) => b[1].count - a[1].count).slice(0, 6).map(x => x[0]);
    if (!words.length) return "La la la... la la la!";
    const lyrics = [];
    for (let i = 0; i < 4; i++) {
        lyrics.push(words[Math.floor(Math.random() * words.length)]);
    }
    return `🎵 ${lyrics.join(" ")} 🎵`;
}

export {
    FIELD_ALT,
    FIELD_ICON,
    FIELD_LABEL,
    FIELD_WORDS,
    classifyValue,
    cleanName,
    contactCard,
    escHtml,
    escRe,
    fieldFromWord,
    findContact,
    generateChatty,
    generateQuestionResponse,
    generateResponse,
    generateSong,
    generateSpontaneous,
    handleUserMessage,
    learn,
    moodDescription,
    tryContactCommand,
    upsertContact,
    validName,
    whatDoIWant
};
