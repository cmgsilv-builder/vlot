"use strict";
/* ============================================================
   Vlot — app logic (Phase 0 + 1)
   Fresh rebuild: decks, richer cards, FSRS study, 🔊 in study,
   pick-or-type category, image search, import/export, themes.
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const endOfToday = () => new Date(new Date().setHours(23, 59, 59, 999)).getTime();

const DB = window.VlotDB;
const FSRS = window.VlotFSRS;
const TTS = window.VlotTTS;
const IMG = window.VlotImages;
const SPEECH = window.VlotSpeech;
const CUR = window.VlotCurriculum;
const INB = window.VlotInburgering;

let decks = [];
let currentDeckId = null;   // add-card / card browser
let editingCardId = null;   // set when the add screen is editing an existing card
let addReturn = "decks";    // where the add screen's ← Back goes
let lastBackup = 0;         // ms timestamp of the last full backup
let chosenImage = null;     // add-card selected image
let session = null;         // { deckId, queue:[cardId] }
let studyStats = { days: {} }; // { days: { "YYYY-MM-DD": { r, again } } } — for the Progress screen
let exam = null;               // active mock exam: { pack, qs, i, count, need, endAt, timer }

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const dayKey = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/* Record one review for today's activity (drives the Progress screen). */
async function logReview(grade) {
  const k = dayKey();
  const day = studyStats.days[k] || { r: 0, again: 0 };
  day.r += 1;
  if (grade === 1) day.again += 1;
  studyStats.days[k] = day;
  await DB.setSetting("studyStats", studyStats);
}

/* Animate any .bar fills from 0 → their data-w% for a subtle entrance. */
function paintBars() {
  requestAnimationFrame(() => {
    $$(".bar > i[data-w]").forEach((el) => { el.style.width = el.dataset.w + "%"; });
  });
}

/* ---------- toast ---------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
window.Vlot = { toast };

/* ---------- card migration (old SM-2 -> FSRS, fill new fields) ---------- */
function migrateCard(c) {
  const base = {
    id: c.id || uid(),
    word: c.word || "", trans: c.trans || "", img: c.img || null,
    sentence: c.sentence || "", sentenceTrans: c.sentenceTrans || "",
    category: c.category || "", pos: c.pos || "", article: c.article || "",
    notes: c.notes || "",
    level: c.level || "", freqRank: (typeof c.freqRank === "number" ? c.freqRank : null),
    created: c.created || null,
    source: c.source || "",   // "inburgering" = exam content, kept out of the frequency ladder
  };
  if (c.stability === undefined) {
    // coming from the old SM-2 schema (ef/interval/reps/due) or brand new
    const sr = FSRS.newCardSR();
    if (typeof c.due === "number") sr.due = c.due;        // keep any existing schedule
    if (c.reps > 0) { sr.state = "review"; sr.reps = c.reps; }
    Object.assign(base, sr);
  } else {
    Object.assign(base, {
      stability: c.stability, difficulty: c.difficulty, due: c.due,
      reps: c.reps || 0, lapses: c.lapses || 0, last: c.last || 0, state: c.state || "review",
    });
  }
  return base;
}
function migrateDeck(d) {
  return {
    id: d.id || uid(),
    name: d.name || "Untitled",
    created: d.created || Date.now(),
    cards: Array.isArray(d.cards) ? d.cards.map(migrateCard) : [],
  };
}
function dueCount(deck) {
  const t = endOfToday();
  return deck.cards.filter((c) => c.due <= t).length;
}
function allCategories() {
  const set = new Set();
  decks.forEach((d) => d.cards.forEach((c) => { if (c.category) set.add(c.category); }));
  return Array.from(set).sort();
}

/* ---------- Living curriculum ----------
   Rank each card by add-order (card #1 = rank 1), then stamp its CEFR
   level from that rank. Ranks are assigned once and kept; only missing
   ones get filled (appended after the current max), so nothing shifts.
   Persists any deck it touches. */
async function ensureCurriculum() {
  let maxRank = 0;
  const unranked = [];
  decks.forEach((d) => d.cards.forEach((c, i) => {
    if (c.source === "inburgering") return;   // exam content isn't part of the frequency climb
    if (typeof c.freqRank === "number") { if (c.freqRank > maxRank) maxRank = c.freqRank; }
    else unranked.push({ c, d, key: c.created || ((d.created || 0) + i * 0.001) });
  }));
  unranked.sort((a, b) => a.key - b.key);
  const dirty = new Set();
  unranked.forEach((u) => { u.c.freqRank = ++maxRank; dirty.add(u.d.id); });
  // refresh level for every ranked card (keeps bands right if thresholds change)
  decks.forEach((d) => d.cards.forEach((c) => {
    if (typeof c.freqRank === "number") {
      const lv = CUR.levelForRank(c.freqRank);
      if (c.level !== lv) { c.level = lv; dirty.add(d.id); }
    }
  }));
  for (const id of dirty) { await DB.putDeck(decks.find((d) => d.id === id)); }
}
function findCardById(id) {
  for (const d of decks) { const c = d.cards.find((x) => x.id === id); if (c) return c; }
  return null;
}

/* ---------- navigation ---------- */
function go(name) {
  if (name !== "exam" && exam && exam.timer) { clearInterval(exam.timer); exam.timer = null; exam = null; }
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#scr-" + name).classList.add("active");
  $$("header nav button").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
  if (name === "decks") renderDecks();
  if (name === "learn") renderLearn();
  if (name === "study") renderStudyPick();
  if (name === "progress") renderProgress();
  if (name === "exam") renderExamSetup();
  if (name === "cards") renderCards();
}
$$("header nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));

/* ---------- Decks screen ---------- */
async function refresh() { decks = (await DB.allDecks()).map(migrateDeck); }

async function renderDecks() {
  await refresh();
  const el = $("#deckList");
  if (!decks.length) {
    el.innerHTML = '<div class="empty"><div class="big">🌱</div>No decks yet. Create one above to start.</div>';
    return;
  }
  el.innerHTML = "";
  decks.sort((a, b) => a.created - b.created).forEach((d) => {
    const due = dueCount(d);
    const div = document.createElement("div");
    div.className = "deck";
    div.innerHTML =
      `<div class="dtap" data-act="browse" style="min-width:0;cursor:pointer"><div class="name"></div><div class="meta">${d.cards.length} card${d.cards.length === 1 ? "" : "s"} · tap to edit ›</div></div>
       <div class="spacer"></div>
       ${due > 0 ? `<span class="pill">${due} due</span>` : '<span class="pill grey">✓ done</span>'}
       <button class="btn small" data-act="add">+ Card</button>
       <button class="btn ghost small icon" data-act="export" title="Export">⬇️</button>
       <button class="btn ghost small icon" data-act="del" title="Delete">🗑️</button>`;
    div.querySelector(".name").textContent = d.name;
    div.querySelector('[data-act=browse]').onclick = () => openDeckCards(d.id);
    div.querySelector('[data-act=add]').onclick = () => openAdd(d.id, null, "decks");
    div.querySelector('[data-act=export]').onclick = () => exportDeck(d);
    div.querySelector('[data-act=del]').onclick = () => removeDeck(d);
    el.appendChild(div);
  });
  renderBackupNudge();
}
$("#addDeck").onclick = async () => {
  const name = $("#newDeckName").value.trim();
  if (!name) { toast("Give the deck a name."); return; }
  await DB.putDeck({ id: uid(), name, created: Date.now(), cards: [] });
  $("#newDeckName").value = "";
  renderDecks(); toast("Deck created 🎉");
};
$("#newDeckName").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#addDeck").click(); });

async function removeDeck(d) {
  if (!confirm(`Delete deck "${d.name}" and its ${d.cards.length} card(s)? Export first if unsure.`)) return;
  await DB.deleteDeck(d.id); renderDecks(); toast("Deck deleted.");
}

/* ---------- Card browser (view / edit / delete) ---------- */
function openDeckCards(deckId) { currentDeckId = deckId; go("cards"); }

async function renderCards() {
  await refresh();
  const d = decks.find((x) => x.id === currentDeckId);
  if (!d) { go("decks"); return; }
  $("#cardsDeckLabel").textContent = d.name;
  const list = $("#cardList");
  if (!d.cards.length) {
    list.innerHTML = '<div class="empty"><div class="big">🌱</div>No cards yet. Add your first one.</div>';
    return;
  }
  list.innerHTML = "";
  d.cards.forEach((c) => {
    const row = document.createElement("div");
    row.className = "crow";
    row.innerHTML =
      `<div style="min-width:0"><div class="cw"></div></div>
       <div class="spacer"></div>
       <button class="btn ghost small icon" data-act="edit" title="Edit">✏️</button>
       <button class="btn ghost small icon" data-act="del" title="Delete">🗑️</button>`;
    row.querySelector(".cw").textContent = c.word + (c.article ? " (" + c.article + ")" : "");
    row.querySelector('[data-act=edit]').onclick = () => openAdd(d.id, c.id, "cards");
    row.querySelector('[data-act=del]').onclick = () => deleteCard(d.id, c.id);
    list.appendChild(row);
  });
}
async function deleteCard(deckId, cardId) {
  const d = decks.find((x) => x.id === deckId);
  const c = d.cards.find((x) => x.id === cardId);
  if (!c || !confirm(`Delete the card "${c.word}"? This can't be undone.`)) return;
  d.cards = d.cards.filter((x) => x.id !== cardId);
  await DB.putDeck(d);
  await refresh();
  renderCards();
  toast("Card deleted.");
}
$("#cardsBack").onclick = () => go("decks");
$("#cardsAdd").onclick = () => openAdd(currentDeckId, null, "cards");

/* ---------- Add / edit card screen ---------- */
function openAdd(deckId, cardId, ret) {
  currentDeckId = deckId; chosenImage = null; editingCardId = cardId || null;
  addReturn = ret || "decks";
  const d = decks.find((x) => x.id === deckId);
  $("#addDeckLabel").textContent = "Deck: " + d.name;
  ["cardWord", "cardTrans", "cardSentence", "cardSentenceTrans", "cardNotes", "imgQuery"].forEach((id) => { $("#" + id).value = ""; });
  $("#cardPos").value = ""; $("#cardArticle").value = "";
  $("#imgResults").innerHTML = ""; $("#chosenWrap").hidden = true; $("#articleWrap").hidden = true;
  if (editingCardId) {
    const c = d.cards.find((x) => x.id === editingCardId);
    $("#cardWord").value = c.word || ""; $("#cardTrans").value = c.trans || "";
    $("#cardSentence").value = c.sentence || "";
    $("#cardSentenceTrans").value = c.sentenceTrans || ""; $("#cardNotes").value = c.notes || "";
    $("#cardPos").value = c.pos || ""; $("#cardArticle").value = c.article || "";
    $("#articleWrap").hidden = c.pos !== "noun";
    if (c.img) { chosenImage = c.img; $("#chosenImg").src = c.img; $("#chosenWrap").hidden = false; }
    $("#addTitle").textContent = "Edit card"; $("#saveCard").textContent = "Save changes";
  } else {
    $("#addTitle").textContent = "New card"; $("#saveCard").textContent = "Save card";
  }
  const editCat = editingCardId ? (d.cards.find((x) => x.id === editingCardId) || {}).category : "";
  populateCategories(editCat || "");
  updateCardCount();
  go("add");
  $("#cardWord").focus();
}
$("#backToDecks").onclick = () => go(addReturn);
// (image search field is left blank on purpose — type your own query)

// A ready-made list of common topics, merged with any categories already used
// in your decks (and whatever the card being edited already has).
const PRESET_CATEGORIES = [
  "People & family", "Food & drink", "Home & furniture", "Clothing",
  "Body & health", "Work & school", "Travel & transport", "Nature & weather",
  "Animals", "Time & dates", "Numbers", "Colors", "Emotions & feelings",
  "Places", "Shopping & money", "Technology", "Hobbies & sports",
  "Verbs (actions)", "Grammar words", "Other",
];
function populateCategories(selected) {
  const sel = $("#cardCategory");
  const set = new Set(PRESET_CATEGORIES);
  allCategories().forEach((c) => set.add(c));
  if (selected) set.add(selected);
  const cats = Array.from(set).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = '<option value="">—</option>' +
    cats.map((c) => `<option value="${c.replace(/"/g, "&quot;")}"></option>`).join("");
  // fill option text safely (avoid HTML injection from custom names)
  Array.from(sel.options).forEach((o) => { if (o.value) o.textContent = o.value; });
  sel.value = selected || "";
}
function updateCardCount() {
  const d = decks.find((x) => x.id === currentDeckId);
  $("#cardCount").textContent = d ? `${d.cards.length} in deck` : "";
}

/* image search */
$("#searchImg").onclick = doSearch;
$("#imgQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
async function doSearch() {
  const q = $("#imgQuery").value.trim();
  if (!q) { toast("Type something to search."); return; }
  const box = $("#imgResults");
  box.innerHTML = '<div class="muted" style="grid-column:1/-1">Searching…</div>';
  const results = await IMG.searchImages(q);
  if (!results.length) { box.innerHTML = '<div class="muted" style="grid-column:1/-1">Nothing found (or no internet).</div>'; return; }
  box.innerHTML = "";
  results.forEach((res) => {
    const img = document.createElement("img");
    img.src = res.thumb; img.loading = "lazy"; img.alt = "";
    img.onclick = () => pickImage(img, res);
    img.onerror = () => img.remove();
    box.appendChild(img);
  });
}
async function pickImage(imgEl, res) {
  $$("#imgResults img").forEach((i) => i.classList.remove("sel"));
  imgEl.classList.add("sel");
  const data = await IMG.toDataURL(res.thumb);
  chosenImage = data;
  $("#chosenImg").src = data; $("#chosenWrap").hidden = false;
}

$("#saveCard").onclick = async () => {
  const word = $("#cardWord").value.trim();
  const trans = $("#cardTrans").value.trim();
  if (!word || !trans) { toast("Fill in the word and translation."); return; }
  const d = decks.find((x) => x.id === currentDeckId);

  if (editingCardId) {
    // Update content only — keep scheduling, freqRank, level, source, created.
    const c = d.cards.find((x) => x.id === editingCardId);
    c.word = word; c.trans = trans; c.img = chosenImage;
    c.sentence = $("#cardSentence").value.trim();
    c.sentenceTrans = $("#cardSentenceTrans").value.trim();
    c.category = $("#cardCategory").value.trim();
    c.pos = $("#cardPos").value;
    c.article = $("#cardPos").value === "noun" ? $("#cardArticle").value : "";
    c.notes = $("#cardNotes").value.trim();
    await DB.putDeck(d);
    editingCardId = null;
    toast("Card updated ✅");
    go("cards");
    return;
  }

  const card = migrateCard({
    id: uid(), word, trans, img: chosenImage,
    created: Date.now(),
    sentence: $("#cardSentence").value.trim(),
    sentenceTrans: $("#cardSentenceTrans").value.trim(),
    category: $("#cardCategory").value.trim(),
    pos: $("#cardPos").value,
    article: $("#cardPos").value === "noun" ? $("#cardArticle").value : "",
    notes: $("#cardNotes").value.trim(),
  });
  d.cards.push(card);
  await DB.putDeck(d);
  await ensureCurriculum();   // rank + level-tag the new word
  toast("Card saved ✅");
  // reset for the next card (keep deck + category for speed)
  ["cardWord", "cardTrans", "cardSentence", "cardSentenceTrans", "cardNotes", "imgQuery"].forEach((id) => { $("#" + id).value = ""; });
  $("#cardPos").value = ""; $("#cardArticle").value = "";
  $("#imgResults").innerHTML = ""; $("#chosenWrap").hidden = true; chosenImage = null;
  populateCategories($("#cardCategory").value); updateCardCount();
  $("#cardWord").focus();
};
$("#cardPos").addEventListener("change", () => {
  $("#articleWrap").hidden = $("#cardPos").value !== "noun";
});

/* ---------- Export / Import ---------- */
function exportDeck(d) {
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = d.name.replace(/[^\w\-]+/g, "_") + ".json";
  a.click(); URL.revokeObjectURL(a.href);
  toast("Deck exported.");
}
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const parsed = JSON.parse(await f.text());
    if (!parsed.name || !Array.isArray(parsed.cards)) throw new Error("bad");
    const d = migrateDeck(parsed);
    d.id = uid(); // never overwrite
    await DB.putDeck(d);
    await refresh(); await ensureCurriculum();
    renderDecks(); toast("Deck imported ✅");
  } catch (err) { toast("Invalid file."); }
  e.target.value = "";
};

/* ---------- Backup / Restore (whole app) ---------- */
async function backupAll() {
  await refresh();
  const total = decks.reduce((s, d) => s + d.cards.length, 0);
  if (!total) { toast("Nothing to back up yet."); return; }
  const snapshot = { app: "de-of-het", version: 1, exportedAt: new Date().toISOString(), decks, studyStats };
  const blob = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "de-of-het-backup-" + dayKey() + ".json";
  a.click(); URL.revokeObjectURL(a.href);
  lastBackup = Date.now();
  await DB.setSetting("lastBackup", lastBackup);
  updateBackupInfo();
  toast(`Backup saved ✅ (${decks.length} deck${decks.length === 1 ? "" : "s"}, ${total} cards)`);
}
async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    const imported = Array.isArray(data.decks) ? data.decks : (Array.isArray(data) ? data : null);
    if (!imported) throw new Error("bad");
    for (const raw of imported) {
      if (!raw || !Array.isArray(raw.cards)) continue;
      const d = migrateDeck(raw);
      d.id = uid(); // add as new — never overwrite existing decks
      await DB.putDeck(d);
    }
    if (data.studyStats && data.studyStats.days) {
      Object.entries(data.studyStats.days).forEach(([k, v]) => { if (!studyStats.days[k]) studyStats.days[k] = v; });
      await DB.setSetting("studyStats", studyStats);
    }
    await refresh(); await ensureCurriculum();
    renderDecks();
    toast(`Backup restored ✅ (${imported.length} deck${imported.length === 1 ? "" : "s"})`);
  } catch (err) { toast("That file isn't a valid backup."); }
}
function updateBackupInfo() {
  const el = $("#backupInfo");
  if (!el) return;
  el.textContent = lastBackup
    ? "Last backup: " + new Date(lastBackup).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "No backup yet — your cards live only on this device.";
}
function renderBackupNudge() {
  const el = $("#backupNudge");
  if (!el) return;
  const total = decks.reduce((s, d) => s + d.cards.length, 0);
  const stale = !lastBackup || (Date.now() - lastBackup) > 14 * 86400000;
  if (total >= 10 && stale) {
    el.hidden = false;
    el.innerHTML = '<span>🛟 Your cards live only on this device. Back them up so a lost phone doesn\'t mean losing everything.</span><button class="btn small" id="nudgeBackup">Back up</button>';
    $("#nudgeBackup").onclick = () => backupAll();
  } else {
    el.hidden = true; el.innerHTML = "";
  }
}
$("#backupBtn").onclick = () => backupAll();
$("#restoreBtn").onclick = () => $("#restoreFile").click();
$("#restoreFile").onchange = async (e) => { const f = e.target.files[0]; if (f) await restoreBackup(f); e.target.value = ""; };

/* ---------- Study ---------- */
async function renderStudyPick() {
  await refresh();
  const el = $("#studyDeckList");
  $("#studyArea").hidden = true; $("#studyPick").hidden = false;
  if (!decks.length) { el.innerHTML = '<div class="empty"><div class="big">🙂</div>Create a deck and some cards first.</div>'; return; }
  el.innerHTML = "";
  decks.forEach((d) => {
    const due = dueCount(d);
    const div = document.createElement("div");
    div.className = "deck";
    const empty = d.cards.length === 0;
    div.innerHTML =
      `<div style="min-width:0"><div class="name"></div><div class="meta">${d.cards.length} cards</div></div>
       <div class="spacer"></div>
       ${due > 0 ? `<span class="pill">${due} due</span>` : '<span class="pill grey">✓ caught up</span>'}
       <button class="btn small" ${empty ? "disabled style=opacity:.5" : ""}>${due > 0 ? "Study" : "Review all"}</button>`;
    div.querySelector(".name").textContent = d.name;
    const btn = div.querySelector("button");
    if (!empty) btn.onclick = () => startStudy(d.id);
    el.appendChild(div);
  });
}
/* Build a study session from [{card, deckId}] entries. Due cards first;
   if none are due, review them all (cram). Works within one deck or
   across decks (study-by-level). */
function beginSession(entries, emptyMsg) {
  if (!entries.length) { toast(emptyMsg || "Nothing to study here yet 🙂"); return; }
  const t = endOfToday();
  let use = entries.filter((e) => e.card.due <= t);
  if (!use.length) { use = entries.slice(); toast("All caught up — reviewing everything 🔁"); }
  use.sort((a, b) => a.card.due - b.card.due);
  session = {
    queue: use.map((e) => e.card.id),
    deckOf: Object.fromEntries(use.map((e) => [e.card.id, e.deckId])),
    reviewed: 0,
  };
  enterStudyUI();
  nextCard();
}
function enterStudyUI() {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#scr-study").classList.add("active");
  $$("header nav button").forEach((b) => b.classList.toggle("active", b.dataset.go === "study"));
  $("#studyPick").hidden = true; $("#studyArea").hidden = false;
}
function startStudy(deckId) {
  const d = decks.find((x) => x.id === deckId);
  if (!d.cards.length) { toast("Add a card first 🙂"); return; }
  beginSession(d.cards.map((c) => ({ card: c, deckId })));
}
function startStudyByLevel(level) {
  const entries = [];
  decks.forEach((d) => d.cards.forEach((c) => { if (c.level === level) entries.push({ card: c, deckId: d.id }); }));
  beginSession(entries, `No ${level} words yet — add more to unlock this 🙂`);
}
$("#stopStudy").onclick = () => { session = null; renderStudyPick(); };

function nextCard() {
  const f = $("#flash");
  if (!session || !session.queue.length) {
    const n = session ? session.reviewed : 0;
    f.innerHTML = `<div class="empty"><div class="big">🎉</div>Done for now — you reviewed ${n} card${n === 1 ? "" : "s"}. Mooi zo! 🌱</div>`;
    $("#studyLeft").textContent = "0 left";
    setTimeout(() => { session = null; renderStudyPick(); }, 1600);
    return;
  }
  $("#studyLeft").textContent = session.queue.length + " left";
  const card = findCardById(session.queue[0]);
  if (!card) { session.queue.shift(); return nextCard(); }
  showFront(card);
}
function spkBtn(text, cls) {
  const b = document.createElement("button");
  b.className = "spk" + (cls ? " " + cls : "");
  b.textContent = "🔊"; b.title = "Listen";
  b.onclick = (e) => { e.stopPropagation(); TTS.speak(text); };
  return b;
}

/* Speech practice control: 🎤 Say it -> 0–100% score. Optional, non-blocking.
   Always rendered; if the browser can't do speech, tapping explains why. */
function makeSpeak(target, label) {
  const supported = SPEECH && SPEECH.speechSupported();
  const wrap = document.createElement("div");
  wrap.className = "speak";
  const btn = document.createElement("button");
  btn.className = "speakbtn";
  btn.innerHTML = "🎤 " + (label || "Say it");
  const res = document.createElement("div");
  res.className = "speakres"; res.hidden = true;
  res.innerHTML = '<div class="meter"><i></i></div><div class="speaktxt"></div>';
  const bar = res.querySelector("i");
  const txt = res.querySelector(".speaktxt");
  let rec = null;
  btn.onclick = () => {
    if (!supported) {
      res.hidden = false; bar.style.width = "0%";
      txt.textContent = "Speech practice needs Chrome/Edge (or Safari) with a mic + internet.";
      return;
    }
    if (rec) { try { rec.stop(); } catch (e) {} rec = null; btn.innerHTML = "🎤 " + (label || "Say it"); return; }
    res.hidden = false; bar.style.width = "0%"; txt.textContent = "";
    let done = false;
    const reset = () => { btn.classList.remove("live"); btn.innerHTML = "🎤 " + (label || "Say it"); rec = null; };
    rec = SPEECH.practice(target, {
      onStart: () => { btn.innerHTML = "● Listening… (tap to stop)"; btn.classList.add("live"); },
      onError: (code) => {
        done = true; reset();
        const msg = {
          "not-allowed": "Mic blocked. Allow it for this site, and check macOS Settings → Privacy & Security → Microphone → your browser.",
          "service-not-allowed": "Blocked by the browser/OS. Check macOS Settings → Privacy & Security → Microphone → your browser.",
          "audio-capture": "No microphone found (or the OS is blocking it — macOS Settings → Privacy & Security → Microphone).",
          "no-speech": "Didn't catch that — try again, a bit louder.",
          "network": "Speech needs internet on this device — check your connection.",
          "aborted": "Stopped. Tap 🎤 to try again.",
        }[code] || ("Speech error: “" + code + "”. Tap 🎤 to retry.");
        txt.textContent = msg;
      },
      onResult: ({ score, heard }) => {
        done = true; reset();
        bar.style.width = score + "%";
        const emoji = score >= 85 ? "🎉" : score >= 60 ? "👍" : "🔁";
        txt.innerHTML = `${emoji} <b>${score}%</b> · heard: “${heard || "—"}”`;
      },
      onEnd: () => { if (!done) { reset(); txt.textContent = "Didn't catch that — tap 🎤 and speak."; } },
    });
    if (!rec) { done = true; reset(); }
  };
  wrap.append(btn, res);
  return wrap;
}
function showFront(card) {
  const f = $("#flash"); f.innerHTML = "";
  if (card.category || card.article || card.level) {
    const cat = document.createElement("div"); cat.className = "cat";
    cat.textContent = [card.category, card.article ? card.article + "-woord" : "", card.level].filter(Boolean).join(" · ");
    f.appendChild(cat);
  }
  const word = document.createElement("div"); word.className = "word";
  word.append(document.createTextNode(card.word), spkBtn(card.word));
  f.appendChild(word);
  // Dutch example sentence up front (no English — that stays on the back).
  if (card.sentence) {
    const s = document.createElement("div"); s.className = "sentence";
    s.append(document.createTextNode("“" + card.sentence + "”"), spkBtn(card.sentence));
    f.appendChild(s);
  }
  const sp = makeSpeak(card.word, "Say it");
  if (sp) f.appendChild(sp);
  const show = document.createElement("button"); show.className = "btn"; show.textContent = "Show answer";
  show.onclick = () => showBack(card);
  f.appendChild(show);
}
function showBack(card) {
  const f = $("#flash"); f.innerHTML = "";
  if (card.category || card.article || card.level) {
    const cat = document.createElement("div"); cat.className = "cat";
    cat.textContent = [card.category, card.article ? card.article + "-woord" : "", card.pos, card.level].filter(Boolean).join(" · ");
    f.appendChild(cat);
  }
  const word = document.createElement("div"); word.className = "word";
  word.append(document.createTextNode(card.word), spkBtn(card.word));
  f.appendChild(word);
  const trans = document.createElement("div"); trans.className = "trans"; trans.textContent = card.trans;
  f.appendChild(trans);
  if (card.img) { const im = document.createElement("img"); im.className = "cardimg"; im.src = card.img; im.alt = ""; f.appendChild(im); }
  if (card.sentence) {
    const s = document.createElement("div"); s.className = "sentence";
    s.append(document.createTextNode("“" + card.sentence + "”"), spkBtn(card.sentence));
    f.appendChild(s);
    if (card.sentenceTrans) { const st = document.createElement("div"); st.className = "senttrans"; st.textContent = card.sentenceTrans; f.appendChild(st); }
  }
  if (card.notes) { const n = document.createElement("div"); n.className = "notes"; n.textContent = "💬 " + card.notes; f.appendChild(n); }

  // speech practice: word, and the sentence if there is one
  const spWord = makeSpeak(card.word, "Say the word");
  if (spWord) f.appendChild(spWord);
  if (card.sentence) { const spSent = makeSpeak(card.sentence, "Say the sentence"); if (spSent) f.appendChild(spSent); }

  const grades = document.createElement("div"); grades.className = "grades";
  const prev = FSRS.previewIntervals(card);
  const defs = [[1, "again", "Again"], [2, "hard", "Hard"], [3, "good", "Good"], [4, "easy", "Easy"]];
  defs.forEach(([g, cls, label]) => {
    const b = document.createElement("button"); b.className = "g-" + cls;
    b.innerHTML = `${label}<small>${prev[g]}</small>`;
    b.onclick = () => answer(card, g);
    grades.appendChild(b);
  });
  f.appendChild(grades);
}
async function answer(card, grade) {
  FSRS.schedule(card, grade);
  const d = decks.find((x) => x.id === session.deckOf[card.id]);
  await DB.putDeck(d);
  await logReview(grade);
  session.reviewed += 1;
  session.queue.shift();
  if (grade === 1) session.queue.push(card.id); // relearn later this session
  nextCard();
}

/* ---------- Learn (living curriculum) ---------- */
async function renderLearn() {
  await refresh();
  await ensureCurriculum();
  const cov = CUR.coverage(decks);

  // summary stats
  const toNextLine = cov.nextLevel
    ? `${cov.toNext} to ${cov.nextLevel}`
    : "top band";
  $("#learnStats").innerHTML = `
    <div class="stat"><div class="n">${cov.total}</div><div class="l">words added</div></div>
    <div class="stat"><div class="n">${cov.current}</div><div class="l">current level</div></div>
    <div class="stat"><div class="n">${cov.total ? toNextLine : "—"}</div><div class="l">next milestone</div></div>`;

  // ladder of bands
  const ladder = $("#ladder");
  ladder.innerHTML = "";
  cov.bands.forEach((b) => {
    const div = document.createElement("div");
    div.className = "band";
    div.innerHTML =
      `<div class="band-top">
         <span class="lvl">${b.level}</span>
         <div style="min-width:0"><div class="ti">${b.title}</div><div class="bl">${b.blurb}</div></div>
         <span class="cnt">${b.have} / ${b.size}</span>
       </div>
       <div class="bar"><i data-w="${b.pct}" style="width:0"></i></div>
       <div class="actions"><button class="btn ghost small" ${b.have ? "" : "disabled style=opacity:.45"}>▶ Study ${b.level} words</button></div>`;
    if (b.have) div.querySelector("button").onclick = () => startStudyByLevel(b.level);
    ladder.appendChild(div);
  });
  paintBars();

  renderInburgering();

  // grammar lessons
  const g = $("#grammar");
  g.innerHTML = "";
  CUR.GRAMMAR.forEach((les) => {
    const d = document.createElement("details");
    d.className = "lesson";
    d.innerHTML = `<summary><span class="tag">${les.level}</span>${les.title}</summary><div class="body">${les.body}</div>`;
    g.appendChild(d);
  });
}

/* Inburgering panel: two stages (A1, A2), each with an exam overview and
   its one-tap deck packs (with readiness). */
function renderInburgering() {
  const wrap = $("#inburgering");
  wrap.innerHTML = "";
  renderExamStage(wrap, INB.EXAM.a1, "A1");
  renderExamStage(wrap, INB.EXAM.a2, "A2");
  // mock-exam launcher
  const mocks = availableMocks();
  const cta = document.createElement("div");
  cta.className = "pack";
  cta.innerHTML =
    `<div class="pack-hd"><span class="pico">🎯</span>
       <div style="min-width:0"><div class="ti">Mock exam</div>
         <div class="bl">${mocks.length ? "A timed, multiple-choice test built from your added KNM / vocab packs. Doesn't affect your study schedule." : "Add a KNM or vocabulary pack above to unlock a timed mock exam."}</div></div>
     </div>
     <div class="pack-ft"><span class="meta"></span>
       <button class="btn small" ${mocks.length ? "" : "disabled style=opacity:.45"}>🎯 Take a mock exam</button></div>`;
  if (mocks.length) cta.querySelector("button").onclick = () => go("exam");
  wrap.appendChild(cta);
}

/* Which loaded decks can drive a multiple-choice mock (KNM facts, vocab meanings). */
function availableMocks() {
  const out = [];
  INB.PACKS.forEach((p) => {
    if (p.part !== "knm" && p.part !== "lezen") return;   // MC-friendly parts only
    const dk = decks.find((d) => d.name === p.deck);
    if (dk && dk.cards.length >= 4) out.push({ pack: p, deck: dk });
  });
  return out;
}
function renderExamStage(wrap, exam, level) {
  const ov = document.createElement("div");
  ov.className = "exam";
  ov.innerHTML = `<div class="exam-hd">${exam.title}</div>` +
    exam.parts.map((p) =>
      `<div class="exam-row"><span class="lvl">${p.level}</span>
         <div style="min-width:0"><div class="ti">${p.name}</div><div class="bl">${p.detail}</div></div>
         <span class="cnt">${p.pass}</span></div>`).join("") +
    `<div class="exam-note">${exam.note}</div>`;
  wrap.appendChild(ov);

  INB.PACKS.filter((p) => p.level === level).forEach((pack) => {
    const existing = decks.find((d) => d.name === pack.deck);
    const seen = existing ? existing.cards.filter((c) => c.reps > 0).length : 0;
    const row = document.createElement("div");
    row.className = "pack";
    row.innerHTML =
      `<div class="pack-hd">
         <span class="pico">${pack.icon}</span>
         <div style="min-width:0"><div class="ti">${pack.title}</div><div class="bl">${pack.blurb}</div></div>
       </div>
       <div class="pack-ft">
         <span class="meta">${existing ? `Added · ${existing.cards.length} cards · ${seen} seen` : `${pack.cards.length} cards`}</span>
         <button class="btn ${existing ? "ghost" : ""} small">${existing ? "✓ Added" : "＋ Add to my decks"}</button>
       </div>`;
    const btn = row.querySelector("button");
    if (existing) btn.disabled = true;
    else btn.onclick = () => loadPack(pack);
    wrap.appendChild(row);
  });
}

/* Create a deck from a pack (idempotent by deck name). */
async function loadPack(pack) {
  if (decks.find((d) => d.name === pack.deck)) { toast("Already added."); return; }
  const now = Date.now();
  const cards = pack.cards.map((c, i) => migrateCard({
    id: uid(), created: now + i, source: "inburgering",
    word: c.word, trans: c.trans,
    sentence: c.sentence || "", sentenceTrans: c.sentenceTrans || "",
    category: c.category || "", pos: c.pos || "", article: c.article || "", notes: c.notes || "",
  }));
  await DB.putDeck({ id: uid(), name: pack.deck, created: now, cards });
  await refresh();
  toast(`${pack.title} added ✅`);
  renderLearn();
}

/* ---------- Progress (gentle, no guilt) ---------- */
async function renderProgress() {
  await refresh();
  await ensureCurriculum();
  const all = decks.flatMap((d) => d.cards);
  const now = Date.now();

  if (all.length === 0) {
    $("#progStats").innerHTML = '<div class="empty" style="flex:1 1 100%"><div class="big">🌱</div>Add some cards, then your progress grows here.</div>';
    $("#progWeek").innerHTML = "";
    $("#progForecastCard").hidden = true;
    $("#progExamCard").hidden = true;
    $("#progToughCard").hidden = true;
    return;
  }

  const learned = all.filter((c) => c.reps > 0).length;
  const knownWell = all.filter((c) => c.state === "review" && c.stability >= 7).length;

  // last 7 days activity
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(now - i * 86400000);
    const k = dayKey(dt);
    const rec = studyStats.days[k];
    days.push({ k, dt, on: !!(rec && rec.r > 0), rec: rec || { r: 0, again: 0 } });
  }
  const daysThisWeek = days.filter((d) => d.on).length;
  const weekR = days.reduce((s, d) => s + d.rec.r, 0);
  const weekAgain = days.reduce((s, d) => s + d.rec.again, 0);
  const accuracy = weekR > 0 ? Math.round(((weekR - weekAgain) / weekR) * 100) : null;

  // pace: new frequency words per week (last 28 days), curriculum climb
  const monthCards = all.filter((c) => c.source !== "inburgering" && typeof c.created === "number" && c.created >= now - 28 * 86400000).length;
  const perWeek = monthCards / 4;
  const cov = CUR.coverage(decks);

  // ---- stat tiles ----
  const paceLabel = perWeek >= 1 ? Math.round(perWeek) : (monthCards > 0 ? "<1" : "0");
  $("#progStats").innerHTML = `
    <div class="stat"><div class="n">${knownWell}</div><div class="l">words known well</div></div>
    <div class="stat"><div class="n">${daysThisWeek}<span style="font-size:15px;color:var(--muted)">/7</span></div><div class="l">days this week</div></div>
    <div class="stat"><div class="n">${paceLabel}</div><div class="l">new words / week</div></div>`;

  // ---- gentle week row ----
  const wd = ["S", "M", "T", "W", "T", "F", "S"];
  const dots = days.map((d, idx) =>
    `<div class="day ${d.on ? "on" : ""} ${idx === days.length - 1 ? "today" : ""}" title="${d.k}">${wd[d.dt.getDay()]}</div>`).join("");
  let vibe;
  if (daysThisWeek >= 5) vibe = "Strong week — lekker bezig! 🌱";
  else if (daysThisWeek >= 1) vibe = "Nice, you've been showing up.";
  else vibe = "Welcome back whenever — there's no streak to lose. 🌱";
  const accLine = weekR >= 10 ? `<div class="muted" style="text-align:center;margin-top:6px">Recalling about <b style="color:var(--ink)">${accuracy}%</b> first-try this week (${weekR} reviews).</div>` : "";
  $("#progWeek").innerHTML =
    `<div class="days">${dots}</div>
     <div class="muted" style="text-align:center">${vibe}</div>${accLine}`;

  // ---- climb forecast ----
  const fc = $("#progForecast");
  $("#progForecastCard").hidden = cov.total === 0;
  if (cov.total > 0) {
    let line = `You've learned <b>${cov.maxRank}</b> frequency words — that's level <b>${cov.current}</b>.`;
    if (cov.maxRank >= 500) {
      line += " You've cleared the whole A1 vocabulary band — mooi zo!";
    } else if (perWeek >= 1) {
      const weeksLeft = Math.ceil((500 - cov.maxRank) / perWeek);
      const eta = new Date(now + weeksLeft * 7 * 86400000);
      const when = eta.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      line += ` At about <b>${Math.round(perWeek)}</b> new words a week, you'll reach A1 (500 words) around <b>${when}</b>.`;
    } else {
      line += " Add a few words a week and your A1 date will show up here.";
    }
    fc.innerHTML = `<p style="margin:0;line-height:1.6">${line}</p>`;
  }

  // ---- exam readiness ----
  const examRows = INB.PACKS.map((pack) => {
    const dk = decks.find((d) => d.name === pack.deck);
    if (!dk) return null;
    const seen = dk.cards.filter((c) => c.reps > 0).length;
    const pct = dk.cards.length ? Math.round((seen / dk.cards.length) * 100) : 0;
    return `<div class="band" style="margin-bottom:8px">
       <div class="band-top"><span class="pico">${pack.icon}</span>
         <div style="min-width:0"><div class="ti">${pack.title}</div></div>
         <span class="cnt">${seen} / ${dk.cards.length}</span></div>
       <div class="bar"><i data-w="${pct}" style="width:0"></i></div></div>`;
  }).filter(Boolean);
  $("#progExamCard").hidden = examRows.length === 0;
  $("#progExam").innerHTML = examRows.join("");
  paintBars();

  // ---- toughest cards ----
  const tough = all.filter((c) => (c.lapses || 0) > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 5);
  $("#progToughCard").hidden = tough.length === 0;
  $("#progTough").innerHTML = tough.map((c) =>
    `<div class="tough"><span class="tw">${escapeHtml(c.word)}</span>
       <span class="tt">${escapeHtml(c.trans)}</span>
       <span class="tx">${c.lapses}×</span></div>`).join("");
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

/* ---------- Mock exam (timed multiple-choice) ---------- */
const PASS_RATIO = 0.6; // practice pass mark (KNM's real bar; a sensible target elsewhere)

function showExamScreen(mode) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#scr-exam").classList.add("active");
  $$("header nav button").forEach((b) => b.classList.remove("active"));
  $("#examSetup").hidden = mode !== "setup";
  $("#examQuiz").hidden = mode !== "quiz";
  $("#examResult").hidden = mode !== "result";
}
function renderExamSetup() {
  showExamScreen("setup");
  const el = $("#examSetup");
  const mocks = availableMocks();
  if (!mocks.length) {
    el.innerHTML = '<h2>Mock exam</h2><div class="empty"><div class="big">🎯</div>Add a KNM or vocabulary pack in Learn first, then come back for a timed mock.</div>';
    return;
  }
  el.innerHTML =
    '<h2>Mock exam</h2><p class="muted">Pick a part. Timed, multiple-choice, no hints — like the real thing. Your study schedule stays untouched.</p>' +
    mocks.map((m, idx) => {
      const count = mockCount(m);
      const secs = count * 30;
      const need = Math.ceil(count * PASS_RATIO);
      return `<div class="pack"><div class="pack-hd"><span class="pico">${m.pack.icon}</span>
          <div style="min-width:0"><div class="ti">${m.pack.title}</div>
            <div class="bl">${count} questions · ${Math.round(secs / 60)} min · pass ${need}/${count}</div></div></div>
        <div class="pack-ft"><span class="meta"></span><button class="btn small" data-i="${idx}">▶ Start</button></div></div>`;
    }).join("");
  el.querySelectorAll("button[data-i]").forEach((b) => (b.onclick = () => startMock(mocks[+b.dataset.i])));
}
function mockCount(m) {
  const target = m.pack.part === "knm" ? 30 : 20;
  return Math.min(target, m.deck.cards.length);
}
function startMock(m) {
  const deck = m.deck;
  const count = mockCount(m);
  const pool = shuffle(deck.cards.slice()).slice(0, count);
  const qs = pool.map((card) => {
    const others = shuffle(deck.cards.filter((c) => c.id !== card.id && c.trans !== card.trans));
    const seen = new Set([card.trans]);
    const distract = [];
    for (const o of others) { if (!seen.has(o.trans)) { seen.add(o.trans); distract.push(o.trans); } if (distract.length === 3) break; }
    return { prompt: card.word, correct: card.trans, options: shuffle([card.trans, ...distract]), answer: null };
  });
  exam = { pack: m.pack, qs, i: 0, count, need: Math.ceil(count * PASS_RATIO), endAt: Date.now() + count * 30 * 1000, timer: null };
  showExamScreen("quiz");
  exam.timer = setInterval(tickExam, 1000);
  renderExamQuestion();
}
function renderExamQuestion() {
  const q = exam.qs[exam.i];
  const box = $("#examQuiz");
  box.innerHTML =
    `<div class="qhead"><button class="btn ghost small" id="examExit">← Exit</button>
       <span class="pill grey">${exam.i + 1} / ${exam.count}</span>
       <span class="exam-timer" id="examTimer">--:--</span></div>
     <div class="qprompt">${escapeHtml(q.prompt)}</div>
     <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}">${escapeHtml(o)}</button>`).join("")}</div>`;
  box.querySelector("#examExit").onclick = () => exitExam();
  box.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
    exam.qs[exam.i].answer = exam.qs[exam.i].options[+b.dataset.i];
    exam.i += 1;
    if (exam.i < exam.count) renderExamQuestion(); else finishMock();
  }));
  updateExamTimer();
}
function updateExamTimer() {
  const el = $("#examTimer");
  if (!el) return;
  const left = Math.max(0, Math.round((exam.endAt - Date.now()) / 1000));
  el.textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
  el.classList.toggle("low", left <= 60);
}
function tickExam() {
  updateExamTimer();
  if (Date.now() >= exam.endAt) finishMock();
}
function finishMock() {
  if (exam.timer) { clearInterval(exam.timer); exam.timer = null; }
  const score = exam.qs.filter((q) => q.answer === q.correct).length;
  const pass = score >= exam.need;
  const misses = exam.qs.filter((q) => q.answer !== q.correct);
  showExamScreen("result");
  $("#examResult").innerHTML =
    `<div class="result-hero">
       <div class="result-score">${score}<span style="font-size:22px;color:var(--muted)">/${exam.count}</span></div>
       <div class="result-badge ${pass ? "pass" : "fail"}">${pass ? "✓ Passed (practice)" : "Keep practising"}</div>
       <p class="muted" style="margin-top:8px">Practice pass mark: ${exam.need}/${exam.count} (60%).</p>
     </div>` +
    (misses.length
      ? `<h2 style="margin-top:8px">Review (${misses.length})</h2>` +
        misses.map((q) => `<div class="miss"><div class="mq">${escapeHtml(q.prompt)}</div>
           <div class="my">You: ${escapeHtml(q.answer || "— (skipped / time up)")}</div>
           <div class="mc">Correct: ${escapeHtml(q.correct)}</div></div>`).join("")
      : '<div class="empty" style="padding:22px"><div class="big">🎉</div>Perfect score — mooi zo!</div>') +
    `<div class="row" style="margin-top:16px"><button class="btn" id="examAgain">Try again</button><button class="btn ghost" id="examDone">Done</button></div>`;
  $("#examAgain").onclick = () => { const dk = decks.find((d) => d.name === exam.pack.deck); startMock({ pack: exam.pack, deck: dk }); };
  $("#examDone").onclick = () => { exam = null; go("learn"); };
}
function exitExam() {
  if (exam && exam.timer) { clearInterval(exam.timer); exam.timer = null; }
  exam = null;
  go("learn");
}

/* ---------- Settings / theme ---------- */
async function applyStoredTheme() {
  const accent = await DB.getSetting("accent", "polder");
  const mode = await DB.getSetting("themeMode", "system"); // system | light | dark
  document.documentElement.setAttribute("data-accent", accent);
  applyMode(mode);
  $$(".sw").forEach((b) => b.setAttribute("aria-pressed", b.dataset.accent === accent ? "true" : "false"));
  $$("#modeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
}
function applyMode(mode) {
  if (mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
}
$("#settingsBtn").onclick = () => { updateBackupInfo(); $("#settingsSheet").classList.add("open"); };
$("#closeSettings").onclick = () => $("#settingsSheet").classList.remove("open");
$("#settingsSheet").addEventListener("click", (e) => { if (e.target.id === "settingsSheet") e.currentTarget.classList.remove("open"); });
$$(".sw").forEach((b) => b.onclick = async () => {
  const a = b.dataset.accent;
  document.documentElement.setAttribute("data-accent", a);
  $$(".sw").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  await DB.setSetting("accent", a);
});
$$("#modeSeg button").forEach((b) => b.onclick = async () => {
  const m = b.dataset.mode;
  applyMode(m);
  $$("#modeSeg button").forEach((x) => x.classList.toggle("on", x === b));
  await DB.setSetting("themeMode", m);
});

/* ---------- Boot ---------- */
(async function () {
  await DB.openDB();
  await applyStoredTheme();
  const savedStats = await DB.getSetting("studyStats", { days: {} });
  studyStats = (savedStats && savedStats.days) ? savedStats : { days: {} };
  lastBackup = await DB.getSetting("lastBackup", 0);
  updateBackupInfo();
  await refresh();
  await ensureCurriculum();   // backfill ranks/levels for existing cards
  await renderDecks();
  if ("serviceWorker" in navigator && !location.search.includes("nosw")) {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      reg.update();
      // auto-reload once when a new version takes control (no manual double-reload)
      let refreshed = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshed) return; refreshed = true; location.reload();
      });
    } catch (e) { /* offline install optional */ }
  }
  if (!TTS.hasDutchVoice()) {
    // gentle one-time hint
    const shown = await DB.getSetting("voiceHintShown", false);
    if (!shown) { setTimeout(() => toast("Tip: install a Dutch voice (Xander/Ellen) for better audio."), 900); await DB.setSetting("voiceHintShown", true); }
  }
})();
