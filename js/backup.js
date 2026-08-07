/* backup.js — export the whole save to a JSON file, and restore from one.

   Both paths go through localStorage + a full page reload, exactly like
   Reset pet already does (menu.js). That sidesteps every question about
   safely mutating the live `state` binding from another module: a reload
   re-runs load() from scratch, and every module re-imports the fresh object.
   Mutating `state` in place instead would leave every in-flight system — the
   wander loop, the 3D pet, timers, cached redraw signatures like _petSig —
   holding assumptions built from the OLD pet. */

import { STORAGE_KEY, state, save } from './state.js';
import { escHtml } from './chat.js';
import { openModal, closeModal } from './journal.js';
import { toast } from './ui.js';

const FORMAT = 1;

function slug(s) {
    return String(s || "pet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pet";
}

function todayStamp(d) {
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Downloads a JSON snapshot of the current save. Forces a fresh save() first
 *  so the file matches what's on screen, not whatever the 5-second autosave
 *  last happened to write. */
export function exportBackup() {
    save();
    const envelope = {
        app: "petpal",
        formatVersion: FORMAT,
        storageKey: STORAGE_KEY,
        exportedAt: Date.now(),
        petName: state.name,
        state,
    };
    let json;
    try { json = JSON.stringify(envelope, null, 2); }
    catch (e) { toast("Couldn't build the backup file."); return; }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `petpal-${slug(state.name)}-${todayStamp(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // The browser has already queued the download off the blob by the time
    // click() returns, so freeing the URL a moment later is safe.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("💾 Backup saved!");
}

/** Pulls a state object out of whatever was parsed, accepting both our own
 *  envelope and a bare state object (a hand-edited file, or an older export
 *  format). load() already back-fills any keys missing against
 *  DEFAULT_STATE, so this only needs to reject things that plainly aren't a
 *  PetPal save — it doesn't need to validate the full shape. */
function extractState(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = (parsed.state && typeof parsed.state === "object") ? parsed.state : parsed;
    const looksRight = candidate && typeof candidate === "object" &&
        "name" in candidate && ("hunger" in candidate || "traits" in candidate);
    return looksRight ? candidate : null;
}

function describeBackup(parsed, candidate) {
    const bits = [];
    if (candidate.name) bits.push(escHtml(candidate.name));
    if (typeof candidate.xp === "number") bits.push(`${Math.round(candidate.xp)} XP`);
    if (typeof candidate.coins === "number") bits.push(`${candidate.coins} coins`);
    if (parsed && typeof parsed.exportedAt === "number") {
        bits.push(`backed up ${new Date(parsed.exportedAt).toLocaleString()}`);
    }
    return bits.join(" · ") || "unknown pet";
}

/** Opens a file picker, previews what's in it, and only on confirmation
 *  replaces the save and reloads. Restoring is destructive to whatever is
 *  currently loaded, so it gets the same explicit confirm step Reset pet
 *  uses, not a silent overwrite. */
export function importBackupFlow() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            let parsed;
            try { parsed = JSON.parse(reader.result); }
            catch (e) { toast("That file isn't valid JSON."); return; }
            const candidate = extractState(parsed);
            if (!candidate) { toast("That doesn't look like a PetPal backup."); return; }

            openModal("📂 Restore backup?", `
              <p style="font-size:13px;">This will replace your current pet with:</p>
              <p style="font-size:13px; font-weight:700; margin:6px 0;">${describeBackup(parsed, candidate)}</p>
              <p style="font-size:12px; color:var(--danger);">
                Your current pet (${escHtml(state.name)}, ${Math.round(state.xp || 0)} XP) will be
                gone unless you've backed it up too.
              </p>
              <div class="modal-actions">
                <button class="btn-secondary" id="restore-cancel">Cancel</button>
                <button class="btn-primary" id="restore-ok" style="background:var(--danger);">Replace it</button>
              </div>`);
            setTimeout(() => {
                const cancelBtn = document.getElementById("restore-cancel");
                const okBtn = document.getElementById("restore-ok");
                if (cancelBtn) cancelBtn.onclick = closeModal;
                if (okBtn) okBtn.onclick = () => {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
                    } catch (e) {
                        toast("Couldn't restore — storage may be full.");
                        return;
                    }
                    location.reload();
                };
            }, 50);
        };
        reader.onerror = () => toast("Couldn't read that file.");
        reader.readAsText(file);
    };
    input.click();
}
