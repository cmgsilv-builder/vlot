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
let currentDeckId = null;   // add-card
let chosenImage = null;     // add-card selected image
let session = null;         // { deckId, queue:[cardId] }
let studyStats = { days: {} }; // { days: { "YYYY-MM-DD": { r, again } } } — for the Progress screen

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
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#scr-" + name).classList.add("active");
  $$("header nav button").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
  if (name === "decks") renderDecks();
  if (name === "learn") renderLearn();
  if (name === "study") renderStudyPick();
  if (name === "progress") renderProgress();
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
      `<div style="min-width:0"><div class="name"></div><div class="meta">${d.cards.length} card${d.cards.length === 1 ? "" : "s"}</div></div>
       <div class="spacer"></div>
       ${due > 0 ? `<span class="pill">${due} due</span>` : '<span class="pill grey">✓ done</span>'}
       <button class="btn small" data-act="add">+ Card</button>
       <button class="btn ghost small icon" data-act="export" title="Export">⬇️</button>
       <button class="btn ghost small icon" data-act="del" title="Delete">🗑️</button>`;
    div.querySelector(".name").textContent = d.name;
    div.querySelector('[data-act=add]').onclick = () => openAdd(d.id);
    div.querySelector('[data-act=export]').onclick = () => exportDeck(d);
    div.querySelector('[data-act=del]').onclick = () => removeDeck(d);
    el.appendChild(div);
  });
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

/* ---------- Add-card screen ---------- */
function openAdd(deckId) {
  currentDeckId = deckId; chosenImage = null;
  const d = decks.find((x) => x.id === deckId);
  $("#addDeckLabel").textContent = "Deck: " + d.name;
  ["cardWord", "cardTrans", "cardCategory", "cardSentence", "cardSentenceTrans", "cardNotes", "imgQuery"].forEach((id) => { $("#" + id).value = ""; });
  $("#cardPos").value = ""; $("#cardArticle").value = "";
  $("#imgResults").innerHTML = ""; $("#chosenWrap").hidden = true;
  renderCategoryChips();
  updateCardCount();
  go("add");
  $("#cardWord").focus();
}
$("#backToDecks").onclick = () => go("decks");
// (image search field is left blank on purpose — type your own query)

function renderCategoryChips() {
  const wrap = $("#catChips");
  const cats = allCategories();
  const dl = $("#catList");
  dl.innerHTML = cats.map((c) => `<option value="${c.replace(/"/g, "&quot;")}">`).join("");
  wrap.innerHTML = "";
  cats.slice(0, 12).forEach((c) => {
    const s = document.createElement("span");
    s.className = "chip"; s.textContent = c;
    s.onclick = () => { $("#cardCategory").value = c; };
    wrap.appendChild(s);
  });
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
  renderCategoryChips(); updateCardCount();
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
$("#settingsBtn").onclick = () => $("#settingsSheet").classList.add("open");
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
