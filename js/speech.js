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
// A short word can share ~20% of its letters with almost anything by chance,
// so we subtract that "coincidence floor" and rescale — a real match stays
// high, but gibberish lands near 0 instead of a flattering ~50%.
function scoreMatch(target, heard) {
  const a = _normalize(target), b = _normalize(heard);
  if (!a || !b) return 0;
  const d = _levenshtein(a, b);
  const raw = 1 - d / Math.max(a.length, b.length); // 0..1 letter overlap
  const adj = (raw - 0.2) / 0.8;                     // 0.2 overlap -> 0
  return Math.max(0, Math.min(100, Math.round(adj * 100)));
}

/* Start one recognition attempt for `target`.
   callbacks: onStart(), onResult({score,heard}), onError(code), onEnd()
   Returns a handle with .stop(). Requests mic permission first so the
   browser actually prompts and permission problems surface clearly. */
function practice(target, cb = {}) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { cb.onError && cb.onError("unsupported"); return null; }
  const handle = { stop() {} };
  let finished = false;      // guard: fire onEnd exactly once
  let watchdog = null;       // safety timer so it can never listen forever

  function cleanup() { if (watchdog) { clearTimeout(watchdog); watchdog = null; } }
  function finish() {
    if (finished) return;
    finished = true;
    cleanup();
    cb.onEnd && cb.onEnd();
  }

  function run() {
    let rec;
    try { rec = new R(); } catch (e) { cb.onError && cb.onError("init"); finish(); return; }
    rec.lang = "nl-NL";
    rec.interimResults = false;
    rec.maxAlternatives = 4;
    rec.continuous = false;
    // Hard stop: abort() ends immediately even when iOS Safari ignores stop().
    handle.stop = () => { try { rec.abort(); } catch (e) { try { rec.stop(); } catch (e2) {} } finish(); };
    // If nothing has come back in 8s, kill it — iOS sometimes never fires onend.
    watchdog = setTimeout(() => { try { rec.abort(); } catch (e) {} finish(); }, 8000);
    rec.onstart = () => cb.onStart && cb.onStart();
    rec.onerror = (e) => { cb.onError && cb.onError(e.error || "error"); finish(); };
    rec.onend = () => finish();
    rec.onresult = (e) => {
      const alts = e.results && e.results[0] ? e.results[0] : [];
      // Score the recogniser's most-confident guess (alts[0]), not the best of
      // several. Cherry-picking whichever alternative happens to match inflated
      // scores — saying nonsense could still land ~50%.
      const heard = alts[0] ? alts[0].transcript : "";
      cb.onResult && cb.onResult({ score: scoreMatch(target, heard), heard });
    };
    try { rec.start(); } catch (e) { cb.onError && cb.onError("start"); finish(); }
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
