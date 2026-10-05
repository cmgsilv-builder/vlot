"use strict";
/* ============================================================
   Vlot — free image search
   Sources (no API key, no signup):
     1. Iconify — colourful emoji (any word), plus plain icons for
        abstract words that have no good emoji.
     2. Openverse — everyday CC photos.
     3. Wikimedia Commons — big but archive-heavy, so it goes last.
   Results are de-junked (maps, scans, charts), capped per uploader so
   one museum batch can't flood the grid, and merged in that order.
   Picked images are converted to base64 so cards keep working offline.
   ============================================================ */

const EMOJI_SETS = ["fluent-emoji-flat", "noto", "twemoji", "openmoji"];
const ICON_COLOR = "#14b8a6";  // plain icons get a colour that reads on light and dark
const PER_CREATOR = 3;
// File titles that are almost never a good flashcard picture.
const JUNK = /\b(map|maps|kaart|karte|carte|chart|graph|diagram|plan|gazette|document|letter|page|scan|census|coat of arms|flag of|location)\b|\.(pdf|djvu|tiff?)$/i;

async function searchIcons(q) {
  const r = await fetch("https://api.iconify.design/search?query=" + encodeURIComponent(q) + "&limit=999");
  if (!r.ok) throw new Error("iconify");
  const j = await r.json();
  const icons = j.icons || [];
  const toRes = (id, color) => {
    const [set, name] = id.split(":");
    const u = "https://api.iconify.design/" + set + "/" + name + ".svg?height=240" + (color ? "&color=" + encodeURIComponent(color) : "");
    return { thumb: u, full: u, icon: true, creator: "iconify:" + set };
  };
  // Emoji first, one per name (the same emoji exists in several sets).
  const emoji = [], names = new Set();
  EMOJI_SETS.forEach((set) => icons.forEach((id) => {
    const [s, n] = id.split(":");
    if (s === set && !names.has(n)) { names.add(n); emoji.push(toRes(id)); }
  }));
  const out = emoji.slice(0, 6);
  // Abstract words ("mandatory") rarely have an emoji — add a few plain icons.
  if (out.length < 3) {
    icons.filter((id) => !EMOJI_SETS.includes(id.split(":")[0])).slice(0, 4)
      .forEach((id) => out.push(toRes(id, ICON_COLOR)));
  }
  return out;
}

// Openverse caps anonymous requests at page_size=20 (more → error, no results).
async function searchOpenverse(q) {
  const url = "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) +
    "&page_size=20&mature=false";
  const r = await fetch(url);
  if (!r.ok) throw new Error("openverse");
  const j = await r.json();
  return (j.results || []).map((x) => ({
    thumb: x.thumbnail || x.url, full: x.url, title: x.title || "", creator: x.creator || x.source,
  }));
}

async function searchWikimedia(q) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
    "&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap") + "&gsrnamespace=6&gsrlimit=40" +
    "&prop=imageinfo&iiprop=url|user&iiurlwidth=240&format=json&origin=*";
  const r = await fetch(url);
  if (!r.ok) throw new Error("wikimedia");
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  // `index` preserves the search-relevance order the API returned.
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  return pages.filter((p) => p.imageinfo).map((p) => ({
    thumb: p.imageinfo[0].thumburl, full: p.imageinfo[0].url, title: p.title || "", creator: p.imageinfo[0].user,
  }));
}

async function searchImages(q) {
  const settled = await Promise.allSettled([searchIcons(q), searchOpenverse(q), searchWikimedia(q)]);
  const merged = [];
  const seen = new Set();
  const perCreator = {};
  settled.forEach((s) => {
    if (s.status !== "fulfilled") return;
    s.value.forEach((res) => {
      const key = res.full || res.thumb;
      if (!key || seen.has(key)) return;
      if (res.title && JUNK.test(res.title)) return;
      if (res.creator && !res.icon) {
        perCreator[res.creator] = (perCreator[res.creator] || 0) + 1;
        if (perCreator[res.creator] > PER_CREATOR) return;
      }
      seen.add(key);
      merged.push(res);
    });
  });
  return merged;
}

// Try to fetch + convert to a base64 data URL (offline-safe). Fall back to the URL.
async function toDataURL(url) {
  try {
    const resp = await fetch(url, { mode: "cors" });
    const blob = await resp.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => res(url);
      fr.readAsDataURL(blob);
    });
  } catch (e) { return url; }
}

window.VlotImages = { searchImages, toDataURL };
