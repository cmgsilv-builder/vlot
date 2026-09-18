"use strict";
/* ============================================================
   Vlot — text-to-speech

   Reality (tested 18/09/2026): iOS Safari's built-in speechSynthesis is
   silent on some iPhones, and every free "text→speech" HTTP endpoint
   (Google, StreamElements, public CORS proxies) now blocks browser calls
   (503/401). The only reliable path to audio on iPhone is a real MP3 from
   a service that allows browser (CORS) requests — which needs a free key.

   Set VOICE_KEY below to a free VoiceRSS key (https://www.voicerss.org)
   and 🔊 will play a proper Dutch MP3 everywhere, including iPhone.
   With no key it falls back to the browser voice (works on desktop only).
   ============================================================ */

// Paste a free VoiceRSS API key here to enable reliable audio on iPhone.
const VOICE_KEY = "9739fedd6d874e94bbb2fc31bfeb8ccf";

/* ---- speechSynthesis fallback (desktop / offline) ---- */
let _voices = [];
function loadVoices() { try { _voices = speechSynthesis.getVoices() || []; } catch (e) { _voices = []; } }
if ("speechSynthesis" in window && window.speechSynthesis) {
  loadVoices();
  try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
}
function _synth(text) {
  if (!("speechSynthesis" in window)) { Vlot.toast && Vlot.toast("No audio available here."); return; }
  if (!_voices.length) loadVoices();
  try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(text);
  const nl = _voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("nl"));
  if (nl) { u.voice = nl; u.lang = nl.lang; }
  u.rate = 0.95;
  try { speechSynthesis.speak(u); } catch (e) {}
}

/* ---- primary: real MP3 (works on iPhone) when a key is set ---- */
function _voiceUrl(text) {
  const t = text.length > 300 ? text.slice(0, 300) : text;
  return "https://api.voicerss.org/?key=" + encodeURIComponent(VOICE_KEY) +
    "&hl=nl-nl&v=Lotte&c=MP3&f=44khz_16bit_stereo&r=-2&src=" + encodeURIComponent(t);
}
let _audio = null;
function _playFile(url) {
  return new Promise((resolve, reject) => {
    try {
      if (!_audio) _audio = new Audio();
      _audio.onerror = () => reject(new Error("audio"));
      _audio.src = url;
      const p = _audio.play(); // inside the 🔊 tap → allowed on iOS
      if (p && p.then) p.then(resolve).catch(reject); else resolve();
    } catch (e) { reject(e); }
  });
}

function speak(text) {
  if (!text) return;
  if (VOICE_KEY) { _playFile(_voiceUrl(text)).catch(() => _synth(text)); }
  else { _synth(text); }
}

function hasDutchVoice() { return !!VOICE_KEY || _voices.some((v) => v.lang && v.lang.toLowerCase().startsWith("nl")); }

window.VlotTTS = { speak, hasDutchVoice };
