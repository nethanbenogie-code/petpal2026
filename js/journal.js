/* journal.js — Notifications, modal plumbing, notes/appointments/contacts/diary.
   Split out of index.html's single script block; logic unchanged. */

import { bath, pet } from './actions.js';
import { escHtml } from './chat.js';
import { checkAchievements } from './economy.js';
import { updateUI } from './main.js';
import { save, state, uid } from './state.js';
import { toast } from './ui.js';
/* ─── NOTIFICATIONS ─── */
function requestNotifications() {
    if (!("Notification" in window)) { toast("Notifications not supported"); return; }
    Notification.requestPermission().then(p => {
        if (p === "granted") {
            state.notificationsEnabled = true;
            save();
            toast("Notifications on!");
            new Notification(`Hi from ${state.name}!`, { body: "I'll let you know when I need you.",
                icon: "icon.svg" });
        } else { state.notificationsEnabled = false;
            toast("Permission denied"); }
        updateUI();
    });
}

function sendNotification() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    let msg = "Come check on me!";
    if (state.hunger < 20) msg = "I'm hungry! 🍎";
    else if (state.thirst < 15) msg = "Water please 💧";
    else if (state.health < 30) msg = "I don't feel well 💊";
    else if (state.clean < 15) msg = "I need a bath 🛁";
    try { new Notification(state.name, { body: msg, icon: "icon.svg", tag: "petpal" }); } catch (e) {}
}

/* ─── MODALS ─── */
function openModal(title, bodyHTML) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHTML;
    document.getElementById("modal-bg").classList.add("show");
}

function closeModal() { document.getElementById("modal-bg").classList.remove("show"); }
/* Guarded because this module is imported by battle.html too, which has no
   modal chrome. state.js sits at the root of the import graph and pulls the
   whole app in behind it, so any top-level DOM wiring here has to tolerate a
   page that doesn't own those elements — otherwise the import throws and the
   importing page silently renders nothing. */
const _modalClose = document.getElementById("modal-close");
if (_modalClose) _modalClose.onclick = closeModal;
const _modalBg = document.getElementById("modal-bg");
if (_modalBg) _modalBg.onclick = (e) => { if (e.target.id === "modal-bg") closeModal(); };

/* ─── JOURNAL / NOTES ─── */
function openJournal() {
    const noteList = state.notes.map(n =>
        `<div class="note-item" data-id="${n.id}">
      <div><span class="title">${n.title||'Untitled'}</span> <span class="date">${new Date(n.date).toLocaleDateString()}</span></div>
      <span class="del" data-del="note-${n.id}">✕</span>
    </div>`
    ).join("");

    const apptList = state.appointments.map(a =>
        `<div class="appt-item" data-id="${a.id}">
      <div><span class="title">${a.title}</span> <span class="date">${a.date} ${a.time||''}</span></div>
      <span class="del" data-del="appt-${a.id}">✕</span>
    </div>`
    ).join("");

    const contactList = state.contacts.map(c =>
        `<div class="contact-item" data-id="${c.id}">
      <div><span class="name">${escHtml(c.name)}</span> <span class="phone">${escHtml(c.phone||c.address||'')}</span></div>
      <span class="del" data-del="contact-${c.id}">✕</span>
    </div>`
    ).join("");

    const journalList = state.journal.map(j =>
        `<div class="journal-item" data-id="${j.id}">
      <div><span class="title">${j.mood||'📝'} ${new Date(j.date).toLocaleDateString()}</span> <span class="date">${j.content?j.content.slice(0,30)+'…':''}</span></div>
      <span class="del" data-del="journal-${j.id}">✕</span>
    </div>`
    ).join("");

    openModal("📓 Journal & Notes", `
    <div class="shop-tabs">
      <button class="shop-tab active" data-jtab="notes">📝 Notes</button>
      <button class="shop-tab" data-jtab="appointments">📅 Appts</button>
      <button class="shop-tab" data-jtab="contacts">📇 Contacts</button>
      <button class="shop-tab" data-jtab="journal">📖 Journal</button>
    </div>
    <div id="journal-content">
      <div style="margin-bottom:8px;">
        <button class="btn-primary" id="j-add-btn" style="padding:4px 12px; font-size:12px;">+ Add</button>
      </div>
      <div id="j-list">${noteList || '<p style="color:#888; font-size:12px;">No notes yet.</p>'}</div>
    </div>
  `);

    let currentTab = "notes";

    function renderTab(tab) {
        currentTab = tab;
        let list = "";
        let addLabel = "Add Note";
        if (tab === "notes") {
            list = state.notes.map(n =>
                `<div class="note-item" data-id="${n.id}">
          <div><span class="title">${n.title||'Untitled'}</span> <span class="date">${new Date(n.date).toLocaleDateString()}</span></div>
          <span class="del" data-del="note-${n.id}">✕</span>
        </div>`
            ).join("") || '<p style="color:#888; font-size:12px;">No notes yet.</p>';
            addLabel = "✏️ Add Note";
        } else if (tab === "appointments") {
            list = state.appointments.map(a =>
                `<div class="appt-item" data-id="${a.id}">
          <div><span class="title">${a.title}</span> <span class="date">${a.date} ${a.time||''}</span></div>
          <span class="del" data-del="appt-${a.id}">✕</span>
        </div>`
            ).join("") || '<p style="color:#888; font-size:12px;">No appointments.</p>';
            addLabel = "📅 Add Appointment";
        } else if (tab === "contacts") {
            list = state.contacts.map(c =>
                `<div class="contact-item" data-id="${c.id}">
          <div><span class="name">${escHtml(c.name)}</span> <span class="phone">${escHtml(c.phone||c.address||'')}</span></div>
          <span class="del" data-del="contact-${c.id}">✕</span>
        </div>`
            ).join("") || '<p style="color:#888; font-size:12px;">No contacts.</p>';
            addLabel = "👤 Add Contact";
        } else if (tab === "journal") {
            list = state.journal.map(j =>
                `<div class="journal-item" data-id="${j.id}">
          <div><span class="title">${j.mood||'📝'} ${new Date(j.date).toLocaleDateString()}</span> <span class="date">${j.content?j.content.slice(0,30)+'…':''}</span></div>
          <span class="del" data-del="journal-${j.id}">✕</span>
        </div>`
            ).join("") || '<p style="color:#888; font-size:12px;">No journal entries.</p>';
            addLabel = "📖 Write Entry";
        }
        document.getElementById("j-list").innerHTML = list;
        document.getElementById("j-add-btn").textContent = addLabel;
        // rebind deletes
        document.querySelectorAll("[data-del]").forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                const key = el.dataset.del;
                const [type, id] = key.split("-");
                if (type === "note") { state.notes = state.notes.filter(n => n.id !== id);
                    save();
                    renderTab(currentTab);
                    toast("Note deleted"); } else if (type === "appt") { state.appointments = state
                        .appointments.filter(a => a.id !== id);
                    save();
                    renderTab(currentTab);
                    toast("Appointment deleted"); } else if (type === "contact") { state.contacts = state
                        .contacts.filter(c => c.id !== id);
                    save();
                    renderTab(currentTab);
                    toast("Contact deleted"); } else if (type === "journal") { state.journal = state
                        .journal.filter(j => j.id !== id);
                    save();
                    renderTab(currentTab);
                    toast("Journal entry deleted"); }
                checkAchievements();
                updateUI();
            };
        });
        // bind item clicks for viewing/editing
        document.querySelectorAll(".note-item, .appt-item, .contact-item, .journal-item").forEach(el => {
            el.onclick = () => {
                const id = el.dataset.id;
                if (currentTab === "notes") {
                    const n = state.notes.find(x => x.id === id);
                    if (n) showNoteDetail(n);
                } else if (currentTab === "appointments") {
                    const a = state.appointments.find(x => x.id === id);
                    if (a) showApptDetail(a);
                } else if (currentTab === "contacts") {
                    const c = state.contacts.find(x => x.id === id);
                    if (c) showContactDetail(c);
                } else if (currentTab === "journal") {
                    const j = state.journal.find(x => x.id === id);
                    if (j) showJournalDetail(j);
                }
            };
        });
    }

    document.querySelectorAll("[data-jtab]").forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll("[data-jtab]").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            renderTab(tab.dataset.jtab);
        };
    });

    document.getElementById("j-add-btn").onclick = () => {
        if (currentTab === "notes") showAddNote();
        else if (currentTab === "appointments") showAddAppt();
        else if (currentTab === "contacts") showAddContact();
        else if (currentTab === "journal") showAddJournal();
    };

    renderTab("notes");
}

function showAddNote() {
    openModal("✏️ New Note", `
    <input type="text" id="note-title" placeholder="Title" />
    <textarea id="note-content" placeholder="Write your note..." rows="4"></textarea>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="note-save">Save Note</button>
    </div>
  `);
    setTimeout(() => {
        document.getElementById("note-save").onclick = () => {
            const title = document.getElementById("note-title").value.trim() || "Untitled";
            const content = document.getElementById("note-content").value.trim();
            if (!content) { toast("Please write something."); return; }
            state.notes.push({ id: uid(), title, content, date: Date.now() });
            save();
            closeModal();
            toast("📝 Note saved!");
            checkAchievements();
            updateUI();
            openJournal();
        };
    }, 50);
}

function showNoteDetail(n) {
    openModal("📝 Note", `
    <p><strong>${n.title}</strong></p>
    <p style="font-size:12px; color:#888;">${new Date(n.date).toLocaleString()}</p>
    <p style="white-space:pre-wrap; background:#f5f5f5; padding:8px; border-radius:8px; margin-top:6px;">${n.content}</p>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal();openJournal();">Back</button>
      <button class="btn-danger" onclick="deleteNote('${n.id}')">Delete</button>
    </div>
  `);
}

function deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    save();
    closeModal();
    toast("Note deleted");
    openJournal();
    updateUI();
}

function showAddAppt() {
    openModal("📅 New Appointment", `
    <input type="text" id="appt-title" placeholder="Title" />
    <input type="date" id="appt-date" />
    <input type="time" id="appt-time" />
    <input type="text" id="appt-location" placeholder="Location" />
    <textarea id="appt-notes" placeholder="Notes" rows="2"></textarea>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="appt-save">Save</button>
    </div>
  `);
    setTimeout(() => {
        document.getElementById("appt-date").value = new Date().toISOString().slice(0, 10);
        document.getElementById("appt-save").onclick = () => {
            const title = document.getElementById("appt-title").value.trim() || "Appointment";
            const date = document.getElementById("appt-date").value;
            const time = document.getElementById("appt-time").value;
            const location = document.getElementById("appt-location").value.trim();
            const notes = document.getElementById("appt-notes").value.trim();
            if (!date) { toast("Please select a date."); return; }
            state.appointments.push({ id: uid(), title, date, time, location, notes });
            save();
            closeModal();
            toast("📅 Appointment saved!");
            checkAchievements();
            updateUI();
            openJournal();
        };
    }, 50);
}

function showApptDetail(a) {
    openModal("📅 Appointment", `
    <p><strong>${a.title}</strong></p>
    <p style="font-size:12px;">📆 ${a.date} ${a.time||''}</p>
    ${a.location ? `<p style="font-size:12px;">📍 ${a.location}</p>` : ''}
    ${a.notes ? `<p style="white-space:pre-wrap; background:#f5f5f5; padding:8px; border-radius:8px; margin-top:6px; font-size:12px;">${a.notes}</p>` : ''}
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal();openJournal();">Back</button>
      <button class="btn-danger" onclick="deleteAppt('${a.id}')">Delete</button>
    </div>
  `);
}

function deleteAppt(id) {
    state.appointments = state.appointments.filter(a => a.id !== id);
    save();
    closeModal();
    toast("Appointment deleted");
    openJournal();
    updateUI();
}

function showAddContact() {
    openModal("👤 New Contact", `
    <input type="text" id="contact-name" placeholder="Name" />
    <input type="text" id="contact-phone" placeholder="Phone / number" />
    <input type="text" id="contact-address" placeholder="Address" />
    <input type="text" id="contact-email" placeholder="Email" />
    <textarea id="contact-notes" placeholder="Notes" rows="2"></textarea>
    <p style="font-size:11px; color:#888; margin-top:6px;">
      Tip: you can also just tell your pet —
      <em>"remember Ana's number is 0917..."</em>
    </p>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="contact-save">Save</button>
    </div>
  `);
    setTimeout(() => {
        document.getElementById("contact-save").onclick = () => {
            const name = document.getElementById("contact-name").value.trim();
            if (!name) { toast("Please enter a name."); return; }
            const phone = document.getElementById("contact-phone").value.trim();
            const address = document.getElementById("contact-address").value.trim();
            const email = document.getElementById("contact-email").value.trim();
            const notes = document.getElementById("contact-notes").value.trim();
            state.contacts.push({ id: uid(), name, phone, address, email, notes });
            save();
            closeModal();
            toast("👤 Contact saved!");
            checkAchievements();
            updateUI();
            openJournal();
        };
    }, 50);
}

function showContactDetail(c) {
    // Escaped: chat can write these values, and a name containing markup
    // would otherwise run when the card is opened.
    openModal("👤 Contact", `
    <p><strong>${escHtml(c.name)}</strong></p>
    ${c.phone ? `<p style="font-size:12px;">📞 ${escHtml(c.phone)}</p>` : ''}
    ${c.address ? `<p style="font-size:12px;">🏠 ${escHtml(c.address)}</p>` : ''}
    ${c.email ? `<p style="font-size:12px;">✉️ ${escHtml(c.email)}</p>` : ''}
    ${c.notes ? `<p style="white-space:pre-wrap; background:#f5f5f5; padding:8px; border-radius:8px; margin-top:6px; font-size:12px;">${escHtml(c.notes)}</p>` : ''}
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal();openJournal();">Back</button>
      <button class="btn-danger" onclick="deleteContact('${c.id}')">Delete</button>
    </div>
  `);
}

function deleteContact(id) {
    state.contacts = state.contacts.filter(c => c.id !== id);
    save();
    closeModal();
    toast("Contact deleted");
    openJournal();
    updateUI();
}

function showAddJournal() {
    const moods = ["😊", "😢", "😡", "😴", "🤔", "🥳", "😌", "😰"];
    openModal("📖 Journal Entry", `
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
      ${moods.map(m => `<button class="mood-btn" data-mood="${m}" style="font-size:20px; background:transparent; border:2px solid #ddd; border-radius:8px; padding:2px 6px; cursor:pointer;">${m}</button>`).join("")}
    </div>
    <input type="text" id="journal-mood" placeholder="Mood (e.g. Happy, Sad...)" />
    <textarea id="journal-content" placeholder="What happened today?" rows="4"></textarea>
    <input type="text" id="journal-tags" placeholder="Tags (comma separated)" />
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="journal-save">Save Entry</button>
    </div>
  `);
    setTimeout(() => {
        document.querySelectorAll(".mood-btn").forEach(btn => {
            btn.onclick = () => {
                document.getElementById("journal-mood").value = btn.dataset.mood;
                document.querySelectorAll(".mood-btn").forEach(b => b.style.borderColor = "#ddd");
                btn.style.borderColor = "var(--btn-active)";
            };
        });
        document.getElementById("journal-save").onclick = () => {
            const mood = document.getElementById("journal-mood").value.trim() || "😊";
            const content = document.getElementById("journal-content").value.trim();
            if (!content) { toast("Please write something."); return; }
            const tags = document.getElementById("journal-tags").value.split(",").map(s => s.trim()).filter(Boolean);
            state.journal.push({ id: uid(), date: Date.now(), mood, content, tags });
            save();
            closeModal();
            toast("📖 Journal entry saved!");
            checkAchievements();
            updateUI();
            openJournal();
        };
    }, 50);
}

function showJournalDetail(j) {
    openModal("📖 Journal", `
    <p style="font-size:20px;">${j.mood||'📝'} <span style="font-size:12px; color:#888;">${new Date(j.date).toLocaleString()}</span></p>
    ${j.tags?.length ? `<p style="font-size:11px; color:#888;">🏷️ ${j.tags.join(', ')}</p>` : ''}
    <p style="white-space:pre-wrap; background:#f5f5f5; padding:8px; border-radius:8px; margin-top:6px;">${j.content}</p>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal();openJournal();">Back</button>
      <button class="btn-danger" onclick="deleteJournal('${j.id}')">Delete</button>
    </div>
  `);
}

function deleteJournal(id) {
    state.journal = state.journal.filter(j => j.id !== id);
    save();
    closeModal();
    toast("Journal entry deleted");
    openJournal();
    updateUI();
}

export {
    closeModal,
    deleteAppt,
    deleteContact,
    deleteJournal,
    deleteNote,
    openJournal,
    openModal,
    requestNotifications,
    sendNotification,
    showAddAppt,
    showAddContact,
    showAddJournal,
    showAddNote,
    showApptDetail,
    showContactDetail,
    showJournalDetail,
    showNoteDetail
};
