/* calendar.js — events and reminders through chat, and the notifications that
   fire when they come due.

   Reuses state.appointments — the SAME array the Journal's 📅 Appts tab reads
   and writes — so an event created by chat shows up there, and one added
   through the form gets a reminder too. One store, two doors in, same
   reasoning as contacts-by-chat in chat.js.

   Creation is deliberately gated behind BOTH a recognisable trigger phrase
   AND a date the parser can actually resolve. Early drafts allowed bare
   "i have ..." / "there's ..." openers, and "i have a headache today" or
   "there's a bug in the shooter today" would have silently become calendar
   events — a wrong reminder is worse than no reminder. Both openers were
   dropped; every remaining trigger is something that essentially only
   appears when the user means to schedule something. */

import { state, save, uid } from './state.js';
import { toast, speak, chirp, log } from './ui.js';
import { checkAchievements } from './economy.js';

const pad = n => String(n).padStart(2, "0");
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = d => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };

const WD = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5, sat: 6, saturday: 6 };
const WD_ALT = Object.keys(WD).sort((a, b) => b.length - a.length).join("|");

const MO = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const MO_ALT = Object.keys(MO).sort((a, b) => b.length - a.length).join("|");

/* ── date extraction ──
   Tries patterns most-specific-first and returns { date, start, end } so the
   caller can cut the matched text out of the sentence and use what's left as
   the title. Returns null if nothing resolvable is found — callers treat
   "no date" as "not a calendar command", never as "assume today". */
function extractDate(text, now) {
    const rules = [
        [/\bin (a|\d+) weeks?\b/i, m => addDays(now, (m[1].toLowerCase() === "a" ? 1 : +m[1]) * 7)],
        [/\bin (\d+) days?\b/i, m => addDays(now, +m[1])],
        [/\b(\d{4})-(\d{2})-(\d{2})\b/, m => new Date(+m[1], +m[2] - 1, +m[3])],
        [/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/, m => {
            const yr = m[3] ? (m[3].length === 2 ? 2000 + (+m[3]) : +m[3]) : now.getFullYear();
            return rollYearIfPast(new Date(yr, +m[1] - 1, +m[2]), now, !!m[3]);
        }],
        [new RegExp(`\\b(${MO_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s*(\\d{4})?\\b`, "i"), m =>
            rollYearIfPast(new Date(m[3] ? +m[3] : now.getFullYear(), MO[m[1].toLowerCase()], +m[2]), now, !!m[3])],
        [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MO_ALT})\\.?\\s*(\\d{4})?\\b`, "i"), m =>
            rollYearIfPast(new Date(m[3] ? +m[3] : now.getFullYear(), MO[m[2].toLowerCase()], +m[1]), now, !!m[3])],
        [new RegExp(`\\bnext\\s+(${WD_ALT})\\b`, "i"), m => nextWeekday(now, WD[m[1].toLowerCase()], false)],
        [new RegExp(`\\bthis\\s+(${WD_ALT})\\b`, "i"), m => nextWeekday(now, WD[m[1].toLowerCase()], true)],
        [new RegExp(`\\b(${WD_ALT})\\b`, "i"), m => nextWeekday(now, WD[m[1].toLowerCase()], false)],
        [/\btoday\b|\btonight\b/i, () => now],
        [/\btomorrow\b|\btmrw?\b/i, () => addDays(now, 1)],
    ];
    for (const [re, fn] of rules) {
        const m = re.exec(text);
        if (!m) continue;
        const d = fn(m);
        if (!d || isNaN(d.getTime())) continue;
        return { date: toISO(d), start: m.index, end: m.index + m[0].length };
    }
    return null;
}

// "aug 5" said in December means next August, not last August — but only
// when the year was omitted; an explicit past year is left alone.
function rollYearIfPast(d, now, yearWasExplicit) {
    if (!yearWasExplicit && startOfDay(d) < startOfDay(now)) d.setFullYear(d.getFullYear() + 1);
    return d;
}

// bare/"next" weekday = the next occurrence AFTER today (never today itself).
// "this" weekday = the occurrence within the next 0–6 days, so it CAN be today.
function nextWeekday(now, target, allowToday) {
    const cur = now.getDay();
    let diff = (target - cur + 7) % 7;
    if (diff === 0 && !allowToday) diff = 7;
    return addDays(now, diff);
}

/* ── time extraction ──
   A bare hour with no am/pm and no colon ("at 9") is genuinely ambiguous and
   is deliberately left unresolved — the event still gets created from the
   date alone rather than guessing morning or evening. */
function extractTime(text) {
    const rules = [
        [/\bnoon\b/i, () => "12:00"],
        [/\bmidnight\b/i, () => "00:00"],
        [/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i, m => to24(+m[1], m[2], m[3])],
        [/\b(\d{1,2})\s*(am|pm)\b/i, m => to24(+m[1], "00", m[2])],
        [/\b([01]\d|2[0-3]):([0-5]\d)\b/, m => `${m[1]}:${m[2]}`],
    ];
    for (const [re, fn] of rules) {
        const m = re.exec(text);
        if (!m) continue;
        const t = fn(m);
        if (t) return { time: t, start: m.index, end: m.index + m[0].length };
    }
    return null;
}

function to24(h, mm, ampm) {
    if (h < 1 || h > 12) return null;
    let hh = h % 12;
    if (/pm/i.test(ampm)) hh += 12;
    return `${pad(hh)}:${mm}`;
}

function formatTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)} ${ampm}`;
}

function formatDateHuman(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined,
        { weekday: "short", month: "short", day: "numeric" });
}

function cleanTitle(s) {
    /* Cutting the date and the time out of the sentence can orphan TWO
       connector words at once — "the dentist on ‹friday› at ‹3pm›" leaves
       "the dentist on  at " once both matches are removed. A single
       replace() only strips the outermost one ("at"), leaving "on" stuck to
       the title. Both ends use `+` so a run of connectors comes off together,
       however many stacked up. */
    let t = s.replace(/\s+/g, " ").trim();
    t = t.replace(/^(?:(?:on|at|for|about|to)\s+)+/i, "");
    t = t.replace(/(?:\s+(?:on|at|for|about|to))+\s*$/i, "");
    t = t.trim();
    if (!t) t = "Reminder";
    return t.charAt(0).toUpperCase() + t.slice(1);
}

function apptLine(a) {
    const when = a.time ? `${formatDateHuman(a.date)} at ${formatTime(a.time)}` : formatDateHuman(a.date);
    return `📅 ${a.title} — ${when}${a.location ? " @ " + a.location : ""}`;
}

/* ── creation ── */
const CREATE_OPENERS = [
    /^remind me (?:to|about)\s+/i,
    /^remember to\s+/i,
    /^remember that\s+/i,
    /^don'?t let me forget(?:\s+(?:to|about))?\s+/i,
    /^schedule\s+/i,
    /^book(?:\s+an?)?\s+/i,
];

function makeAppointment(title, date, time, location) {
    const appt = { id: uid(), title, date, time: time || "", location: location || "", notes: "", notified: false };
    state.appointments.push(appt);
    save();
    checkAchievements();
    return appt;
}

function tryCreate(text) {
    // explicit structured form, same shape as "save contact: name | phone | ..."
    let m = text.match(/^add (?:an? )?event:?\s*(.+)$/i);
    if (m) {
        const parts = m[1].split("|").map(s => s.trim()).filter(Boolean);
        if (!parts.length) return null;
        const rest = parts.slice(1).join(" ");
        const now = new Date();
        const d = extractDate(rest, now);
        if (!d) return "What date is that for?";
        const t = extractTime(rest);
        const appt = makeAppointment(cleanTitle(parts[0]), d.date, t ? t.time : "", parts[3] || "");
        return `${apptLine(appt)} — saved!`;
    }

    for (const opener of CREATE_OPENERS) {
        const om = opener.exec(text);
        if (!om) continue;
        let rest = text.slice(om[0].length);
        const now = new Date();

        const t = extractTime(rest);
        if (t) rest = rest.slice(0, t.start) + rest.slice(t.end);
        const d = extractDate(rest, now);
        if (!d) return null;               // no resolvable date -> not a calendar command, stay silent
        rest = rest.slice(0, d.start) + rest.slice(d.end);

        const appt = makeAppointment(cleanTitle(rest), d.date, t ? t.time : "", "");
        return `Got it! ${apptLine(appt)}.`;
    }
    return null;
}

/* ── query ── */
function tryQuery(text) {
    const now = new Date();
    const upcoming = () => state.appointments
        .filter(a => a.date && a.date >= toISO(now))
        .sort((a, b) => (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99")));

    if (/^(?:what'?s on my calendar\??|list (?:my )?(?:events|appointments)|upcoming (?:events|appointments))$/i.test(text)) {
        const items = upcoming();
        if (!items.length) return "Nothing on the calendar!";
        items.forEach(a => log("pet", apptLine(a)));
        return `You have ${items.length} thing${items.length === 1 ? "" : "s"} coming up!`;
    }

    if (/^next appointment\??$/i.test(text)) {
        const items = upcoming();
        if (!items.length) return "Nothing coming up.";
        log("pet", apptLine(items[0]));
        return `Next up: ${items[0].title}.`;
    }

    const m = text.match(/^(?:what do i have|do i have anything|any(?:thing)? (?:scheduled|planned))\s*(.*?)\??$/i);
    if (m) {
        const tail = m[1].trim();
        let items, label;
        if (tail) {
            const d = extractDate(tail, now);
            if (!d) return null;           // e.g. "what do i have for dinner" — not a calendar question
            items = state.appointments.filter(a => a.date === d.date);
            label = ` for ${formatDateHuman(d.date)}`;
        } else {
            items = upcoming();
            label = "";
        }
        if (!items.length) return `Nothing scheduled${label}.`;
        items.forEach(a => log("pet", apptLine(a)));
        return `${items.length} thing${items.length === 1 ? "" : "s"}${label}!`;
    }
    return null;
}

/* ── delete ──
   Falls through to null (not an explanatory reply) when the trigger word is
   present but nothing matches, since "cancel"/"delete"/"remove" are common
   words in ordinary chat and a canned "I don't have that" would hijack
   sentences that were never about the calendar at all. Contacts' "forget" can
   afford to reply on a miss because it is a much rarer word to open a
   sentence with. */
function tryDelete(text) {
    const m = text.match(/^(?:cancel|delete|remove)\s+(?:my\s+)?(.+?)[?.!]*$/i);
    if (!m) return null;
    const needle = m[1].trim().toLowerCase();
    if (!needle) return null;
    const items = state.appointments;
    const hit = items.find(a => a.title.toLowerCase() === needle) ||
        items.find(a => a.title.toLowerCase().startsWith(needle)) ||
        items.find(a => a.title.toLowerCase().includes(needle));
    if (!hit) return null;
    state.appointments = items.filter(a => a.id !== hit.id);
    save();
    return `Cancelled "${hit.title}".`;
}

export function tryEventCommand(raw) {
    const text = raw.trim().replace(/^please\s+/i, "");
    return tryQuery(text) || tryDelete(text) || tryCreate(text);
}

/* ── reminders ──
   Checked every tick (main.js). Fires exactly once per appointment, whenever
   its moment arrives OR has already passed — including a catch-up ping if
   the app was closed right through it, so nothing goes silently missed.
   Appointments with no time never ping; they are day markers, not alarms. */
export function checkEventReminders() {
    const now = new Date();
    for (const a of state.appointments) {
        if (a.notified || !a.date || !a.time) continue;
        const due = new Date(`${a.date}T${a.time}:00`);
        if (isNaN(due.getTime()) || now < due) continue;
        a.notified = true;
        save();
        announce(a, now - due);
    }
}

function announce(a, lateMs) {
    const late = lateMs > 5 * 60 * 1000;
    const msg = `${late ? "⏰ You missed" : "⏰"} ${a.title}${a.location ? " @ " + a.location : ""}${late ? "" : " is starting now!"}`;
    toast(msg, "coin");
    speak(msg, 6000);
    chirp("level");
    if (state.notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(state.name, { body: msg, icon: "icon.svg", tag: "petpal-event-" + a.id }); }
        catch (e) {}
    }
}
