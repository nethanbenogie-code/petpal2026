/* ui.js — Toast, chat log, speech bubble, sound effects, voice in/out.
   Split out of index.html's single script block; logic unchanged. */

import { pet } from './actions.js';
import { handleUserMessage } from './chat.js';
import { getStage, state } from './state.js';
/* ─── TOAST / LOG / BUBBLE ─── */
let toastTimer;

function toast(text, type) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function log(who, text) {
    const el = document.getElementById("log");
    const div = document.createElement("div");
    div.className = "log-entry " + who;
    const prefix = who === "me" ? "You: " : who === "pet" ? `${state.name}: ` : "";
    div.textContent = prefix + text;
    el.appendChild(div);
    while (el.children.length > 20) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
}

let bubbleTimer;

function speak(text, duration = 3000) {
    const b = document.getElementById("bubble");
    b.textContent = text;
    b.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => b.classList.remove("show"), duration);
    log("pet", text);
    speakOut(text);
}

function sayShort(t) { speak(t, 1500); }

function isBubbleShowing() { return document.getElementById("bubble").classList.contains("show"); }

/* ─── AUDIO ─── */
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new(window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
}

function chirp(type = "happy") {
    if (!state.voiceEnabled) return;
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = {
        happy: [600, 900],
        sad: [400, 300],
        eat: [500, 550, 500],
        coin: [880, 1320],
        beep: [700],
        love: [700, 900, 1100],
        error: [200],
        hunt: [400, 600, 800],
        level: [600, 800, 1000, 1200],
    } [type] || [500];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.value = 0;
        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.01);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.08 + 0.08);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.1);
    });
}

let ttsVoice = null;

function initTTS() {
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
        const voices = speechSynthesis.getVoices();
        ttsVoice = voices.find(v => /child|kid|female/i.test(v.name)) ||
            voices.find(v => v.lang.startsWith("en")) ||
            voices[0];
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
}

function speakOut(text) {
    if (!state.voiceEnabled || !("speechSynthesis" in window)) return;
    const clean = text.replace(/\*[^*]*\*/g, "").replace(/[^\w\s.,!?'-]/g, "").trim();
    if (!clean) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    const stage = getStage();
    utt.pitch = stage.pitch || 1.4;
    utt.rate = 1.1;
    utt.volume = 0.9;
    if (ttsVoice) utt.voice = ttsVoice;
    speechSynthesis.speak(utt);
}

/* ─── SPEECH RECOGNITION ─── */
let recognition = null;
let isListening = false;

function initSpeechRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        const input = document.getElementById("chat-input");
        input.value = text;
        handleUserMessage(text);
        input.value = "";
        stopListening();
    };
    rec.onerror = (e) => {
        stopListening();
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            toast("Mic permission denied");
        } else if (e.error !== "no-speech" && e.error !== "aborted") {
            toast("Voice error");
        }
    };
    rec.onend = () => stopListening();
    return rec;
}

function toggleListen() {
    if (!recognition) recognition = initSpeechRec();
    if (!recognition) { toast("Voice not supported here"); return; }
    if (isListening) { stopListening(); return; }
    try {
        recognition.start();
        isListening = true;
        document.getElementById("mic-btn").classList.add("listening");
        document.getElementById("chat-input").placeholder = "Listening...";
    } catch (e) { stopListening(); }
}

function stopListening() {
    isListening = false;
    document.getElementById("mic-btn").classList.remove("listening");
    document.getElementById("chat-input").placeholder = "Talk to your pet...";
}

export {
    audioCtx,
    bubbleTimer,
    chirp,
    initAudio,
    initSpeechRec,
    initTTS,
    isBubbleShowing,
    isListening,
    log,
    recognition,
    sayShort,
    speak,
    speakOut,
    stopListening,
    toast,
    toastTimer,
    toggleListen,
    ttsVoice
};
