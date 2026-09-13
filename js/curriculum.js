"use strict";
/* ============================================================
   Vlot — living curriculum (Phase 3)
   Pure logic: no DOM, no storage. app.js wires it in.

   Idea: words are ranked in the order they're added (your card #1
   from your frequency book = rank 1). Each rank falls into a CEFR
   band, so the ladder fills up as you climb. Grammar mini-lessons
   (A1–A2 now, B1–C1 later) sit alongside.
   ============================================================ */

/* CEFR bands by cumulative high-frequency word count.
   size = how many words that band adds; start/end = rank range. */
const BANDS = (() => {
  const spec = [
    ["A1", 500,  "Survival basics",  "Top ~500 words · present tense, de/het, numbers, questions."],
    ["A2", 1000, "Everyday life",    "Past tenses, separable verbs, connectors, modal verbs."],
    ["B1", 1500, "Independent",      "Subclause word order, opinions, news, connectors."],
    ["B2", 2000, "Upper-independent","Abstract topics, nuance, longer texts."],
    ["C1", 3000, "Advanced",         "Fluent, flexible, near-native range."],
    ["C2", 4000, "Mastery",          "Everything else — the long tail."],
  ];
  let start = 1;
  return spec.map(([level, size, title, blurb]) => {
    const band = { level, size, title, blurb, start, end: start + size - 1 };
    start += size;
    return band;
  });
})();

function levelForRank(rank) {
  for (const b of BANDS) if (rank >= b.start && rank <= b.end) return b.level;
  return BANDS[BANDS.length - 1].level; // beyond the last band -> top level
}

/* Live coverage across all decks. Ranks are contiguous 1..N (add-order),
   so this reads as a climb: lower bands fill first, the current one partially. */
function coverage(decks) {
  let maxRank = 0, total = 0;
  const have = {};
  BANDS.forEach((b) => (have[b.level] = 0));
  decks.forEach((d) => d.cards.forEach((c) => {
    if (typeof c.freqRank === "number") {
      total++;
      if (c.freqRank > maxRank) maxRank = c.freqRank;
      const lv = levelForRank(c.freqRank);
      have[lv] = (have[lv] || 0) + 1;
    }
  }));
  const current = maxRank ? levelForRank(maxRank) : "—";
  const band = BANDS.find((b) => b.level === current);
  const toNext = band ? Math.max(0, band.end - maxRank) : 0;
  const bands = BANDS.map((b) => ({
    ...b,
    have: have[b.level] || 0,
    pct: Math.min(100, Math.round(((have[b.level] || 0) / b.size) * 100)),
  }));
  return { total, maxRank, current, toNext, nextLevel: band ? nextLevelAfter(band.level) : "A1", bands };
}
function nextLevelAfter(level) {
  const i = BANDS.findIndex((b) => b.level === level);
  return i >= 0 && i < BANDS.length - 1 ? BANDS[i + 1].level : null;
}

/* Grammar mini-lessons. Plain English, correct Dutch examples.
   AI-drafted for your review (per the plan). A1 + A2 now. */
const GRAMMAR = [
  {
    level: "A1",
    title: "Word order: verb in second place (V2)",
    body: `In a normal main sentence the <b>finite verb comes second</b>, no matter what starts the sentence.
      <div class="ex">Ik drink koffie. — I drink coffee.<br>Vandaag <b>drink</b> ik koffie. — Today I drink coffee.</div>
      When something else is first (a time, a place), the subject moves to <i>after</i> the verb. Order of the rest is time → manner → place.`,
  },
  {
    level: "A1",
    title: "de or het (the two words for “the”)",
    body: `Dutch has two definite articles: <b>de</b> and <b>het</b>. Indefinite is always <b>een</b> (“a/an”).
      <div class="ex">de man, de vrouw · het huis, het kind · een appel</div>
      Rules that always hold: <b>every plural takes de</b> (de huizen), and <b>every -je diminutive takes het</b> (het huisje). ~2/3 of nouns are “de”. When unsure, learn the article <i>with</i> the word.`,
  },
  {
    level: "A1",
    title: "Present tense (regular verbs)",
    body: `Take the stem (infinitive minus <b>-en</b>) and add endings:
      <div class="ex">werken → stem <b>werk</b><br>ik werk · jij/u werk<b>t</b> · hij/zij werk<b>t</b><br>wij/jullie/zij werk<b>en</b></div>
      Trick: when <b>jij</b> comes <i>after</i> the verb (a question), drop the -t → “Werk jij hier?”`,
  },
  {
    level: "A1",
    title: "zijn and hebben (to be / to have)",
    body: `The two most common verbs are irregular — memorise them:
      <div class="ex"><b>zijn</b>: ik ben · jij bent · hij/zij is · wij/jullie/zij zijn<br><b>hebben</b>: ik heb · jij hebt · hij/zij heeft · wij/jullie/zij hebben</div>`,
  },
  {
    level: "A1",
    title: "Plurals: -en and -s",
    body: `Most nouns add <b>-en</b>; words ending in unstressed -el/-em/-en/-er and many loanwords add <b>-s</b>.
      <div class="ex">boek → boeken · tafel → tafels · foto → foto's</div>
      Watch the spelling: short vowel doubles the consonant (man → man<b>n</b>en); long vowel drops one (boom → bo<b>m</b>en).`,
  },
  {
    level: "A1",
    title: "Questions and saying “no” (niet / geen)",
    body: `Yes/no question: put the verb first → “<b>Woon</b> jij hier?”. Question words: wie, wat, waar, wanneer, waarom, hoe.
      <div class="ex">Ik werk <b>niet</b>. — I don't work. (niet negates verbs/adjectives)<br>Ik heb <b>geen</b> auto. — I have no car. (geen negates indefinite nouns)</div>`,
  },
  {
    level: "A2",
    title: "Perfect tense (heb/ben + participle)",
    body: `The everyday past: <b>hebben</b> or <b>zijn</b> + a past participle at the end.
      <div class="ex">Ik <b>heb</b> gisteren <b>gewerkt</b>. — I worked yesterday.<br>Ik <b>ben</b> naar huis <b>gegaan</b>. — I went home.</div>
      Regular participle = <b>ge- + stem + -t/-d</b>. Verbs of movement or change (gaan, komen, worden…) use <b>zijn</b>, not hebben.`,
  },
  {
    level: "A2",
    title: "The 't kofschip rule (-t or -d?)",
    body: `Ends the stem in one of the sounds in <b>’t kofschip</b> (t, k, f, s, ch, p)? Use <b>-t</b>. Otherwise <b>-d</b>.
      <div class="ex">werken → ge<b>werkt</b> (k) · stoppen → ge<b>stopt</b> (p)<br>leren → ge<b>leerd</b> · reizen → ge<b>reisd</b></div>
      Same rule decides -te/-de in the simple past.`,
  },
  {
    level: "A2",
    title: "Simple past (imperfectum)",
    body: `Used for stories and description. Weak verbs: stem + <b>-te(n)</b> or <b>-de(n)</b> (’t kofschip decides which).
      <div class="ex">werken → ik werk<b>te</b>, wij werk<b>ten</b><br>leren → ik leer<b>de</b>, wij leer<b>den</b></div>
      Common irregulars just get learned: zijn → was/waren, hebben → had/hadden, gaan → ging(en).`,
  },
  {
    level: "A2",
    title: "Separable verbs (opbellen, meenemen…)",
    body: `In a main clause the prefix jumps to the <b>end</b>:
      <div class="ex">opbellen → Ik <b>bel</b> je straks <b>op</b>. — I'll call you later.</div>
      In the perfect, -ge- slots in the middle: <b>opgebeld</b>. In a subclause the two parts join again: “…dat ik je <b>opbel</b>.”`,
  },
  {
    level: "A2",
    title: "Conjunctions and word order",
    body: `<b>Coordinating</b> (en, maar, want, of, dus) keep normal V2 order.
      <div class="ex">Ik blijf thuis, <b>want</b> ik <b>ben</b> ziek.</div>
      <b>Subordinating</b> (omdat, dat, als, terwijl, hoewel, of) push the verb to the <b>end</b>:
      <div class="ex">Ik blijf thuis <b>omdat</b> ik ziek <b>ben</b>.</div>`,
  },
  {
    level: "A2",
    title: "Modal verbs (kunnen, moeten, mogen, willen)",
    body: `A modal verb is conjugated; the <b>main verb goes to the end as an infinitive</b>.
      <div class="ex">Ik <b>wil</b> Nederlands <b>leren</b>. — I want to learn Dutch.<br>Je <b>moet</b> hier <b>wachten</b>. — You have to wait here.</div>
      Present forms are a bit irregular: kan/kant→kan, mag, wil, moet, zal.`,
  },
];

window.VlotCurriculum = { BANDS, levelForRank, coverage, GRAMMAR };
