"use strict";
/* ============================================================
   Vlot — text-to-speech (free, browser-native Dutch voice)
   ============================================================ */
let _voices = [];
let _unlocked = false;
const _isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function loadVoices() { try { _voices = speechSynthesis.getVoices() || []; } catch (e) { _voices = []; } }
if ("speechSynthesis" in window && window.speechSynthesis) {
  loadVoices();
  try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
}

/* iOS won't make a sound until speechSynthesis has been kicked off from a real
   user gesture at least once — and in home-screen (standalone) mode it's even
   stricter. Prime the engine on the first tap with a real (near-silent, single
   space) utterance at full volume; a volume:0 primer does NOT unlock audio. */
function _unlock() {
  if (_unlocked || !("speechSynthesis" in window)) return;
  _unlocked = true;
  try {
    loadVoices();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 1; u.rate = 1;
    speechSynthesis.speak(u);
    setTimeout(() => { try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch (e) {} }, 40);
  } catch (e) {}
}
["touchend", "pointerdown", "click"].forEach((ev) =>
  document.addEventListener(ev, _unlock, { once: true, passive: true, capture: true })
);

function speak(text) {
  if (!text) return;
  if (!("speechSynthesis" in window)) { Vlot.toast && Vlot.toast("No speech support in this browser."); return; }
  if (!_unlocked) _unlock();
  // iOS Safari hands voices over lazily — grab them again if we have none yet.
  if (!_voices.length) loadVoices();
  // On iOS, calling cancel() before speak() can silently break the queue in
  // standalone mode. Only cancel on other platforms (to stop overlap).
  if (!_isIOS) { try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) {} }
  const u = new SpeechSynthesisUtterance(text);
  const nl = _voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("nl"));
  // Only force nl-NL when a Dutch voice exists; otherwise leave defaults so it
  // still speaks (better an English voice than dead silence).
  if (nl) { u.voice = nl; u.lang = nl.lang; } else if (!_isIOS) { u.lang = "nl-NL"; }
  u.rate = 0.95; u.volume = 1;
  try {
    speechSynthesis.speak(u);
    // iOS sometimes parks the queue in a paused state — nudge it awake.
    setTimeout(() => { try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch (e) {} }, 60);
  } catch (e) { Vlot.toast && Vlot.toast("Couldn't play audio here."); }
}
function hasDutchVoice() { return _voices.some((v) => v.lang && v.lang.toLowerCase().startsWith("nl")); }

window.VlotTTS = { speak, hasDutchVoice };
