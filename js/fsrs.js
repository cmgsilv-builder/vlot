"use strict";
/* ============================================================
   Vlot — FSRS scheduler (Free Spaced Repetition Scheduler)
   A compact, dependency-free implementation of FSRS-4.5.
   Open algorithm (github.com/open-spaced-repetition). No server.

   Card scheduling state we store per card:
     stability   (S)  — days until retrievability drops to 90%
     difficulty  (D)  — 1..10, how hard the card is for you
     due         (ms) — next review timestamp
     reps        — successful reviews count
     lapses      — times you pressed "Again"
     last        (ms) — last review timestamp
     state       — "new" | "learning" | "review" | "relearning"

   Grades (button -> rating): Again=1, Hard=2, Good=3, Easy=4
   ============================================================ */

// Default FSRS-4.5 weights (w0..w18).
const FSRS_W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567
];

// Target retention: we schedule the next review for when recall ≈ 90%.
const REQUEST_RETENTION = 0.9;
const MAX_INTERVAL = 3650; // days (10 years cap)
const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // 19/81

const DAY = 86400000;

function clampD(d) { return Math.min(Math.max(d, 1), 10); }
function clampS(s) { return Math.max(s, 0.01); }

// Fresh scheduling fields for a brand-new card.
function newCardSR() {
  return {
    stability: 0,
    difficulty: 0,
    due: Date.now(),
    reps: 0,
    lapses: 0,
    last: 0,
    state: "new",
  };
}

// Retrievability after `elapsedDays` given stability.
function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

// Interval (in days) to reach REQUEST_RETENTION from a given stability.
function intervalFromStability(stability) {
  const ivl = (stability / FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  return Math.min(Math.max(Math.round(ivl), 1), MAX_INTERVAL);
}

// --- Initial values for the very first rating on a new card ---
function initStability(grade) {
  // w[0..3] are the initial stabilities for Again/Hard/Good/Easy.
  return clampS(FSRS_W[grade - 1]);
}
function initDifficulty(grade) {
  const d = FSRS_W[4] - Math.exp(FSRS_W[5] * (grade - 1)) + 1;
  return clampD(d);
}

// --- Difficulty update for subsequent reviews ---
function nextDifficulty(D, grade) {
  const deltaD = -FSRS_W[6] * (grade - 3);
  const dLinear = D + deltaD * ((10 - D) / 9);
  // mean reversion toward the "easy" difficulty (grade 4 init)
  const target = initDifficulty(4);
  return clampD(FSRS_W[7] * target + (1 - FSRS_W[7]) * dLinear);
}

// --- Stability updates ---
function stabilityAfterRecall(D, S, R, grade) {
  const hardPenalty = grade === 2 ? FSRS_W[15] : 1;
  const easyBonus = grade === 4 ? FSRS_W[16] : 1;
  const inc =
    Math.exp(FSRS_W[8]) *
    (11 - D) *
    Math.pow(S, -FSRS_W[9]) *
    (Math.exp(FSRS_W[10] * (1 - R)) - 1) *
    hardPenalty *
    easyBonus;
  return clampS(S * (1 + inc));
}
function stabilityAfterLapse(D, S, R) {
  const sMin = clampS(
    FSRS_W[11] *
      Math.pow(D, -FSRS_W[12]) *
      (Math.pow(S + 1, FSRS_W[13]) - 1) *
      Math.exp(FSRS_W[14] * (1 - R))
  );
  return Math.min(sMin, S); // never grows on a lapse
}

/* Grade a card. Mutates & returns the card's scheduling fields.
   `card` must carry the SR fields (from newCardSR / prior grading).
   grade: 1=Again 2=Hard 3=Good 4=Easy */
function schedule(card, grade) {
  const now = Date.now();
  const isNew = card.state === "new" || !card.stability || card.stability <= 0;

  if (isNew) {
    card.difficulty = initDifficulty(grade);
    card.stability = initStability(grade);
    card.reps = grade >= 2 ? 1 : 0;
    card.lapses = grade === 1 ? 1 : 0;
  } else {
    const elapsedDays = Math.max(0, (now - (card.last || now)) / DAY);
    const R = retrievability(elapsedDays, card.stability);
    card.difficulty = nextDifficulty(card.difficulty, grade);
    if (grade === 1) {
      card.stability = stabilityAfterLapse(card.difficulty, card.stability, R);
      card.lapses = (card.lapses || 0) + 1;
    } else {
      card.stability = stabilityAfterRecall(card.difficulty, card.stability, R, grade);
      card.reps = (card.reps || 0) + 1;
    }
  }

  card.last = now;

  if (grade === 1) {
    // Relearn: show again in ~10 minutes (same session), don't push out days.
    card.state = "relearning";
    card.due = now + 10 * 60 * 1000;
  } else {
    card.state = "review";
    const ivlDays = intervalFromStability(card.stability);
    card.due = now + ivlDays * DAY;
  }
  return card;
}

/* Human-readable preview of the next interval per grade, for button labels. */
function previewIntervals(card) {
  const labels = {};
  [1, 2, 3, 4].forEach((g) => {
    const copy = JSON.parse(JSON.stringify(card));
    schedule(copy, g);
    labels[g] = g === 1 ? "10 min" : humanizeInterval(copy.due - Date.now());
  });
  return labels;
}

function humanizeInterval(ms) {
  const days = ms / DAY;
  // 0.98 (not 1) so a whole-day interval that lost a few ms to clock drift
  // still reads "1 d" instead of "1440 min".
  if (days < 0.98) return Math.max(1, Math.round(ms / 60000)) + " min";
  if (days < 30) return Math.round(days) + " d";
  if (days < 365) return Math.round(days / 30) + " mo";
  return (Math.round((days / 365) * 10) / 10) + " yr";
}

window.VlotFSRS = { newCardSR, schedule, previewIntervals, retrievability, humanizeInterval, DAY };
