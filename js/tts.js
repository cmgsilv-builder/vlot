"use strict";
/* ============================================================
   Vlot — text-to-speech (free, browser-native Dutch voice)
   ============================================================ */
let _voices = [];
function loadVoices() { try { _voices = speechSynthesis.getVoices() || []; } catch (e) { _voices = []; } }
if ("speechSynthesis" in window && window.speechSynthesis) {
  loadVoices();
  try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
}

function speak(text) {
  if (!text) return;
  if (!("speechSynthesis" in window)) { Vlot.toast && Vlot.toast("No speech support in this browser."); return; }
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
