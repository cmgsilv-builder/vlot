"use strict";
/* ============================================================
   Vlot — speech practice (speak the word, get a 0–100% score)
   Uses the browser's free Web Speech recognition. Optional, and
   never touches your SRS grade. Hidden when unsupported.
   ============================================================ */

function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function _normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents for fairness
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}

// 0..100 similarity between what was heard and the target text.
function scoreMatch(target, heard) {
  const a = _normalize(target), b = _normalize(heard);
  if (!a || !b) return 0;
  const d = _levenshtein(a, b);
  return Math.max(0, Math.round((1 - d / Math.max(a.length, b.length)) * 100));
}

/* Start one recognition attempt for `target`.
   callbacks: onStart(), onResult({score,heard}), onError(code), onEnd()
   Returns a handle with .stop(). Requests mic permission first so the
   browser actually prompts and permission problems surface clearly. */
function practice(target, cb = {}) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { cb.onError && cb.onError("unsupported"); return null; }
  const handle = { stop() {} };

  function run() {
    let rec;
    try { rec = new R(); } catch (e) { cb.onError && cb.onError("init"); return; }
    rec.lang = "nl-NL";
    rec.interimResults = false;
    rec.maxAlternatives = 4;
    rec.continuous = false;
    handle.stop = () => { try { rec.stop(); } catch (e) {} };
    rec.onstart = () => cb.onStart && cb.onStart();
    rec.onerror = (e) => cb.onError && cb.onError(e.error || "error");
    rec.onend = () => cb.onEnd && cb.onEnd();
    rec.onresult = (e) => {
      const alts = e.results && e.results[0] ? e.results[0] : [];
      let best = 0, heard = "";
      for (let i = 0; i < alts.length; i++) {
        const s = scoreMatch(target, alts[i].transcript);
        if (s >= best) { best = s; heard = alts[i].transcript; }
      }
      cb.onResult && cb.onResult({ score: best, heard });
    };
    try { rec.start(); } catch (e) { cb.onError && cb.onError("start"); }
  }

  // Force the mic permission prompt up front for clear, early errors.
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => { stream.getTracks().forEach((t) => t.stop()); run(); })
      .catch((err) => {
        const name = err && err.name;
        cb.onError && cb.onError(
          name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" :
          name === "NotFoundError" || name === "NotReadableError" ? "audio-capture" : (name || "audio-capture")
        );
      });
  } else {
    run();
  }
  return handle;
}

window.VlotSpeech = { speechSupported, practice, scoreMatch };
