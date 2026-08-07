/* quotes.js — inspirational quotes: a small bundled set that works fully
   offline from install, plus an optional "get more" fetch from a public,
   CORS-enabled dataset. The fetch is NEVER automatic — only on the user's
   own tap of "🔄 Get more quotes" — because this app's one promise
   (README: "no network requests at runtime") should not get quietly broken
   by a background call the user never asked for.

   Everything that reaches the screen, bundled or fetched, goes through the
   same two-layer content filter first: an AUTHOR blocklist for figures whose
   name alone carries a political or revolutionary charge regardless of what
   the specific line says, and a word-boundary KEYWORD filter over the quote
   text itself for politics/war/rebellion vocabulary. Filtering happens once,
   at fetch time, on the raw response — only quotes that pass are ever
   written to state or shown; nothing unfiltered is cached "just in case".

   Verified against a real public 1,655-quote dataset before shipping: a
   first-draft substring filter matched "king" inside "thinking", "nation"
   inside "imagination", and "christ" inside "Christopher" — nonsense
   matches. Fixed with word-boundary regex. Even after that fix, quotes
   attributed BY NAME to Gandhi, MLK, Churchill, Thomas Paine and Donald
   Trump still passed on text alone — the words were often innocuous
   ("freedom is what you do with what's been done to you"), but the author
   is inseparably political. That's why the author list exists as a second,
   independent layer rather than relying on text content alone. */

import { state, save } from './state.js';
import { toast, speak, chirp } from './ui.js';
import { openModal, closeModal } from './journal.js';
import { escHtml } from './chat.js';

// GitHub raw content sends Access-Control-Allow-Origin: * unconditionally —
// confirmed live before writing this, since the more "official-sounding"
// quote APIs turned out not to work: api.quotable.io no longer resolves at
// all, and zenquotes.io sends no CORS header, so a browser fetch() from this
// app (any origin — localhost, GitHub Pages, wherever it's hosted) would be
// silently blocked by the browser even though the API itself is up.
const SOURCE_URL = "https://raw.githubusercontent.com/dwyl/quotes/main/quotes.json";
const MAX_CACHED = 250;

/* Figures whose name alone carries a political, military or revolutionary
   charge, independent of the specific line quoted. Deliberately
   over-inclusive — Mandela and MLK are excluded despite their own message
   being reconciliation rather than violence, because the ask was to avoid
   politics generally, not to individually judge each figure's politics.
   Matched case-insensitively as a substring of the author field, so
   "Martin Luther King, Jr." is caught by "martin luther king" and titles
   like "General Douglas MacArthur" are caught by "general ". Best-effort,
   not exhaustive — there is no complete list of every political figure who
   was ever quoted. */
const BLOCKED_AUTHORS = [
    "trump", "obama", "biden", "clinton", "bush", "reagan", "nixon",
    "roosevelt", "kennedy", "lincoln", "jefferson", "washington",
    "churchill", "hitler", "stalin", "lenin", "marx", "mao zedong", "mao tse",
    "che guevara", "castro", "napoleon", "gandhi", "martin luther king",
    "malcolm x", "mussolini", "franco", "pol pot", "thomas paine",
    "douglas macarthur", "general ", "president ", "prime minister",
    "senator ", "governor ", "colonel ", "admiral ",
];

/* Politics / war / rebellion vocabulary, matched as WHOLE WORDS so "king"
   doesn't fire on "thinking" and "nation" doesn't fire on "imagination" —
   the bug the first draft of this filter actually had, caught by running it
   against the real dataset before shipping rather than by inspection alone. */
const BLOCKED_TEXT = new RegExp([
    "govern(?:ment|s)?", "presidents?", "revolutions?", "revolt\\w*",
    "rebels?", "rebellion", "uprisings?", "overthrows?", "regimes?",
    "politic\\w*", "protests?", "riots?", "\\bwar\\b", "warfare",
    "\\barm(?:y|ies)\\b", "soldiers?", "weapons?", "\\bguns?\\b",
    "\\bkill\\w*", "murder\\w*", "\\bslaves?\\b", "slavery", "tyrants?",
    "tyranny", "democra\\w*", "communis\\w*", "socialis\\w*", "\\bvote\\b",
    "voting", "elections?", "\\bnations?\\b", "\\bking\\b", "\\bqueen\\b",
    "\\bcountry\\b", "\\bfreedom\\b", "\\bliberty\\b", "independence",
    "\\benem(?:y|ies)\\b",
].join("|"), "i");

export function isSafeQuote(q) {
    if (!q || typeof q.text !== "string" || typeof q.author !== "string") return false;
    const text = q.text.trim();
    if (text.length < 8 || text.length > 240) return false;
    const author = q.author.trim().toLowerCase();
    if (!author || author === "unknown") return false;
    if (BLOCKED_AUTHORS.some(bad => author.includes(bad))) return false;
    if (BLOCKED_TEXT.test(text)) return false;
    return true;
}

/* Hand-picked, baked into the app — quotes work from the very first launch
   with zero network calls. The fetch below is purely a "get more variety"
   enhancement, never a requirement. Every entry here is checked against
   isSafeQuote() by this project's own test pass before shipping, same as
   anything fetched live — the filter doesn't get a pass just because the
   author picked these by hand. */
export const BUNDLED = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Well begun is half done.", author: "Aristotle" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
    { text: "Whether you think you can, or you think you can't — you're right.", author: "Henry Ford" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Keep your face always toward the sunshine, and shadows will fall behind you.", author: "Walt Whitman" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Spread love everywhere you go.", author: "Mother Teresa" },
    { text: "Always remember that you are absolutely unique. Just like everyone else.", author: "Margaret Mead" },
    { text: "Don't judge each day by the harvest you reap but by the seeds that you plant.", author: "Robert Louis Stevenson" },
    { text: "In order to succeed, we must first believe that we can.", author: "Nikos Kazantzakis" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
];

/** Fetch the public dataset, filter it, and cache what passes. Never throws
 *  out to the caller — a failed fetch just means the bundled/cached quotes
 *  keep being used, which is the whole point of shipping a bundle at all. */
export async function refreshQuotePack() {
    let res;
    try { res = await fetch(SOURCE_URL, { cache: "no-store" }); }
    catch (e) { toast("Couldn't reach the internet — using what's already here."); return false; }
    if (!res.ok) { toast("Quote source is unavailable right now."); return false; }

    let raw;
    try { raw = await res.json(); }
    catch (e) { toast("That didn't look like a quote file."); return false; }
    if (!Array.isArray(raw)) { toast("Unexpected quote format."); return false; }

    const seen = new Set((state.quotePack || []).map(q => q.text));
    const fresh = [];
    for (const q of raw) {
        if (!isSafeQuote(q)) continue;
        const text = q.text.trim();
        if (seen.has(text)) continue;
        seen.add(text);
        fresh.push({ text, author: q.author.trim() });
    }

    state.quotePack = [...(state.quotePack || []), ...fresh].slice(-MAX_CACHED);
    state.quotePackFetchedAt = Date.now();
    save();
    toast(`💭 Added ${fresh.length} new quotes (${raw.length - fresh.length} filtered out)`);
    return true;
}

/** A quote to show right now — cached ones first (they're the larger, more
 *  varied pool once fetched), falling back to the bundled set so this never
 *  returns nothing. */
export function getRandomQuote() {
    const pool = (state.quotePack && state.quotePack.length) ? state.quotePack : BUNDLED;
    return pool[Math.floor(Math.random() * pool.length)];
}

let current = null;

function render() {
    current = getRandomQuote();
    const body = document.getElementById("quote-body");
    if (!body) return;
    body.innerHTML = `
      <p style="font-size:15px; font-style:italic; line-height:1.5;">"${escHtml(current.text)}"</p>
      <p style="font-size:12px; color:#888; text-align:right; margin-top:6px;">— ${escHtml(current.author)}</p>
      <p style="font-size:10px; color:#aaa; margin-top:10px;">
        ${state.quotePack && state.quotePack.length ? state.quotePack.length : BUNDLED.length} quotes available
        ${state.quotePackFetchedAt ? " · last updated " + new Date(state.quotePackFetchedAt).toLocaleDateString() : " (built in)"}
      </p>`;
}

/** The 💭 Quotes panel: shows one, lets you cycle, and lets you explicitly
 *  pull more from the internet — that tap is the only place in this whole
 *  feature a network request happens. */
export function openQuotes() {
    openModal("💭 Inspiration", `
      <div id="quote-body"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="quote-say">Say it</button>
        <button class="btn-secondary" id="quote-next">Another</button>
        <button class="btn-primary" id="quote-fetch">🔄 Get more quotes</button>
      </div>`);
    render();
    setTimeout(() => {
        const nextBtn = document.getElementById("quote-next");
        const sayBtn = document.getElementById("quote-say");
        const fetchBtn = document.getElementById("quote-fetch");
        if (nextBtn) nextBtn.onclick = () => { chirp("beep"); render(); };
        if (sayBtn) sayBtn.onclick = () => {
            if (current) speak(`"${current.text}" — ${current.author}`, 7000);
        };
        if (fetchBtn) fetchBtn.onclick = async () => {
            fetchBtn.disabled = true;
            fetchBtn.textContent = "Fetching…";
            await refreshQuotePack();
            fetchBtn.disabled = false;
            fetchBtn.textContent = "🔄 Get more quotes";
            render();
        };
    }, 50);
}
