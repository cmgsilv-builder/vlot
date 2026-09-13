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
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "nl-NL";
  const nl = _voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("nl"));
  if (nl) u.voice = nl;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}
function hasDutchVoice() { return _voices.some((v) => v.lang && v.lang.toLowerCase().startsWith("nl")); }

window.VlotTTS = { speak, hasDutchVoice };
