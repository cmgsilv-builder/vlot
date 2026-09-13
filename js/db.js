"use strict";
/* ============================================================
   Vlot — local storage (IndexedDB)
   Reuses the original DB name so existing decks survive the rebuild.
   DB: vlot_flashcards   store: decks   keyPath: id
   Deck = { id, name, created, cards: [ card ] }
   ============================================================ */

const DB_NAME = "vlot_flashcards";
const STORE = "decks";
const SETTINGS = "settings";
let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: "key" });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function _store(name, mode) { return _db.transaction(name, mode).objectStore(name); }

function putDeck(deck) {
  return new Promise((res, rej) => {
    const r = _store(STORE, "readwrite").put(deck);
    r.onsuccess = res; r.onerror = () => rej(r.error);
  });
}
function deleteDeck(id) {
  return new Promise((res, rej) => {
    const r = _store(STORE, "readwrite").delete(id);
    r.onsuccess = res; r.onerror = () => rej(r.error);
  });
}
function allDecks() {
  return new Promise((res, rej) => {
    const r = _store(STORE, "readonly").getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}
function getSetting(key, fallback) {
  return new Promise((res) => {
    try {
      const r = _store(SETTINGS, "readonly").get(key);
      r.onsuccess = () => res(r.result ? r.result.value : fallback);
      r.onerror = () => res(fallback);
    } catch (e) { res(fallback); }
  });
}
function setSetting(key, value) {
  return new Promise((res, rej) => {
    const r = _store(SETTINGS, "readwrite").put({ key, value });
    r.onsuccess = res; r.onerror = () => rej(r.error);
  });
}

window.VlotDB = { openDB, putDeck, deleteDeck, allDecks, getSetting, setSetting };
