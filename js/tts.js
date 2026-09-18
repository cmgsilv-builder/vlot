"use strict";
/* ============================================================
   Vlot — text-to-speech
   Primary: a real Dutch MP3 from Google's free TTS endpoint, played
   through an <audio> element. This is reliable on iPhone/Safari, where
   the built-in speechSynthesis voice often produces no sound at all.
   Fallback: browser speechSynthesis (mainly desktop / offline).
   No API key, no signup.
   ============================================================ */

/* ---- speechSynthesis fallback (kept for offline / desktop) ---- */
let _voices = [];
function loadVoices() { try { _voices = speechSynthesis.getVoices() || []; } catch (e) { _voices = []; } }
if ("speechSynthesis" in window && window.speechSynthesis) {
  loadVoices();
  try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
}
function _synth(text) {
  if (!("speechSynthesis" in window)) return;
  if (!_voices.length) loadVoices();
  try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(text);
  const nl = _voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("nl"));
  if (nl) { u.voice = nl; u.lang = nl.lang; }
  u.rate = 0.95;
  try { speechSynthesis.speak(u); } catch (e) {}
}

/* ---- primary: play an MP3 file (works on iOS) ---- */
// Google Translate TTS: free, no key. ~200 char limit per call, so we trim.
function _ttsUrl(text) {
  const t = text.length > 200 ? text.slice(0, 200) : text;
  return "https://translate.google.com/translate_tts?ie=UTF-8&tl=nl&client=tw-ob&q=" + encodeURIComponent(t);
}
let _audio = null;
function _playFile(url) {
  return new Promise((resolve, reject) => {
    try {
      if (!_audio) _audio = new Audio();
      _audio.onerror = () => reject(new Error("audio"));
      _audio.src = url;
      const p = _audio.play(); // called inside the 🔊 tap → allowed on iOS
      if (p && p.then) p.then(resolve).catch(reject); else resolve();
    } catch (e) { reject(e); }
  });
}

function speak(text) {
  if (!text) return;
  // Real MP3 first (reliable everywhere, incl. iPhone); fall back to the
  // browser's own voice only if that fails (e.g. offline).
  _playFile(_ttsUrl(text)).catch(() => _synth(text));
}

// Audio playback is always available (online Google voice), so the old
// "install a Dutch voice" nudge is no longer needed.
function hasDutchVoice() { return true; }

window.VlotTTS = { speak, hasDutchVoice };
