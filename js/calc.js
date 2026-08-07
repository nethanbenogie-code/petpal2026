/* calc.js — a chat calculator that understands digits, number-words, and
   mixed forms: "1+1", "one + 1", "1 plus 1", "one plus one", "1 plus one".

   Same discipline as contacts-by-chat and calendar-by-chat: the WHOLE
   trimmed message must be exactly `<number> <operator> <number>` (optionally
   with a leading "what is" / trailing "?"). A number or operator word
   appearing inside a longer ordinary sentence never triggers this — "I have
   2 dogs and 1 cat" doesn't parse as 2+1, because there's no operator
   directly between two numbers spanning the whole message. */

const ONES = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1000, million: 1000000 };

const NUMBER_WORDS = [...Object.keys(ONES), ...Object.keys(TENS), ...Object.keys(SCALES), "and"];
const NUMBER_WORD_ALT = NUMBER_WORDS.sort((a, b) => b.length - a.length).join("|");

/* "twenty-one" must read as one number; "555-1234" must NOT read as
   twenty-one style joining, and must stay eligible as a minus expression.
   Only hyphens that sit between a tens-word and a ones-word are joins —
   built from the actual vocabulary, so this can never misfire on a digit. */
const TENS_ONES_HYPHEN = new RegExp(
    `\\b(${Object.keys(TENS).join("|")})-(${Object.keys(ONES).filter(w => ONES[w] < 10 && w !== "zero").join("|")})\\b`, "gi");

function wordsToNumber(words) {
    let total = 0, current = 0, matchedAny = false;
    for (const w of words) {
        if (w === "and") continue;
        if (w in ONES) { current += ONES[w]; matchedAny = true; }
        else if (w in TENS) { current += TENS[w]; matchedAny = true; }
        else if (w === "hundred") { current = (current || 1) * 100; matchedAny = true; }
        else if (w === "thousand") { total += (current || 1) * 1000; current = 0; matchedAny = true; }
        else if (w === "million") { total += (current || 1) * 1000000; current = 0; matchedAny = true; }
        else return null;
    }
    return matchedAny ? total + current : null;
}

// Longest-phrase-first so "multiplied by" wins over a bare "by" fragment, etc.
const OPS = [
    ["divided by", "/"], ["multiplied by", "*"], ["multiply by", "*"], ["subtracted by", "-"],
    ["added to", "+"], ["times", "*"], ["over", "/"], ["plus", "+"], ["minus", "-"],
    ["add", "+"], ["subtract", "-"],
];
const OP_WORD_ALT = OPS.map(([w]) => w.replace(/ /g, "\\s+")).join("|");
const OP_SYMBOL = "[+\\-*x×÷/]";

const NUM_PATTERN = `-?\\d+(?:\\.\\d+)?|(?:${NUMBER_WORD_ALT})(?:\\s+(?:${NUMBER_WORD_ALT}))*`;
const FULL_RE = new RegExp(
    `^(?:what'?s|what is|how much is|calculate|compute)?\\s*` +
    `(?<left>${NUM_PATTERN})(?<sp1>\\s*)(?<op>${OP_SYMBOL}|${OP_WORD_ALT})(?<sp2>\\s*)(?<right>${NUM_PATTERN})` +
    `\\s*[?.!]*$`, "i");

function resolveNumber(raw) {
    const s = raw.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);
    return wordsToNumber(s.toLowerCase().split(/\s+/));
}

function resolveOp(raw) {
    const s = raw.trim().toLowerCase();
    if (/^[+\-*x×÷/]$/.test(s)) {
        return s === "x" || s === "×" ? "*" : s === "÷" ? "/" : s;
    }
    for (const [word, sym] of OPS) {
        if (s.replace(/\s+/g, " ") === word) return sym;
    }
    return null;
}

function formatNum(n) {
    if (!isFinite(n)) return String(n);
    // Ten significant digits, then drop float noise like 0.30000000000000004.
    const r = Number(n.toPrecision(10));
    return r.toString();
}

export function tryCalcCommand(raw) {
    const text = raw.trim();
    // Hyphenated number-words are joined into one token BEFORE the main match,
    // so "twenty-one" and "twenty one" behave identically without touching
    // any other hyphen (a phone number's hyphens are never in this vocabulary
    // and pass through untouched).
    const normalized = text.replace(TENS_ONES_HYPHEN, "$1 $2");

    const m = FULL_RE.exec(normalized);
    if (!m) return null;
    const { left, sp1, op: opRaw, sp2, right } = m.groups;

    const a = resolveNumber(left);
    const b = resolveNumber(right);
    const op = resolveOp(opRaw);
    if (a === null || b === null || op === null) return null;

    /* A tight, unspaced hyphen ("555-1234", "2024-08") reads as a phone
       number or a date/ID far more often than as subtraction in real chat.
       Word forms and spaced symbols are unambiguous and skip this guard
       entirely; only "5-3"-shaped input is affected, and even then only
       when either side is large enough to look like a real identifier
       rather than a small arithmetic problem. */
    const tightHyphen = op === "-" && opRaw === "-" && sp1 === "" && sp2 === "";
    if (tightHyphen && (Math.abs(a) >= 1000 || Math.abs(b) >= 1000)) return null;

    let result;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "*") result = a * b;
    else if (op === "/") {
        if (b === 0) return "Can't divide by zero! 🧮";
        result = a / b;
    }

    const symbol = { "+": "+", "-": "-", "*": "×", "/": "÷" }[op];
    return `🧮 ${formatNum(a)} ${symbol} ${formatNum(b)} = ${formatNum(result)}`;
}
