"use strict";
/* ============================================================
   Vlot — text-to-speech (free, browser-native Dutch voice)
   ============================================================ */
let _voices = [];
let _unlocked = false;
function loadVoices() { try { _voices = speechSynthesis.getVoices() || []; } catch (e) { _voices = []; } }
if ("speechSynthesis" in window && window.speechSynthesis) {
  loadVoices();
  try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
}

/* iOS Safari won't make a sound until speechSynthesis has been kicked off from
   a real user gesture at least once. Speak a silent utterance on the very first
   tap/click so the engine is primed before the first real 🔊. */
function _unlock() {
  if (_unlocked || !("speechSynthesis" in window)) return;
  _unlocked = true;
  try {
    loadVoices();
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0; u.rate = 1;
    speechSynthesis.speak(u);
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
  // Only cancel if something is actually playing; a bare cancel() right before
  // speak() can swallow the next utterance on iOS.
  try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "nl-NL";
  const nl = _voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("nl"));
  if (nl) u.voice = nl;
  u.rate = 0.95;
  try {
    speechSynthesis.speak(u);
    // iOS sometimes parks the queue in a paused state — nudge it awake.
    setTimeout(() => { try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch (e) {} }, 60);
  } catch (e) { Vlot.toast && Vlot.toast("Couldn't play audio here."); }
}
function hasDutchVoice() { return _voices.some((v) => v.lang && v.lang.toLowerCase().startsWith("nl")); }

window.VlotTTS = { speak, hasDutchVoice };
