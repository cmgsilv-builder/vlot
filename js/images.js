"use strict";
/* ============================================================
   Vlot — free image search
   Sources (no API key, no signup):
     0. Wikipedia (en + nl) — the article's lead photo: usually spot on.
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

// The lead image of the top Wikipedia articles for the word.
async function searchWikipedia(q, lang) {
  const url = "https://" + lang + ".wikipedia.org/w/api.php?action=query&generator=search" +
    "&gsrsearch=" + encodeURIComponent(q) + "&gsrlimit=2&prop=pageimages&piprop=thumbnail|name" +
    "&pithumbsize=320&format=json&origin=*";
  const r = await fetch(url);
  if (!r.ok) throw new Error("wikipedia");
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  return pages.filter((p) => p.thumbnail && !/\.svg$/i.test(p.pageimage || ""))
    .map((p) => ({ thumb: p.thumbnail.source, full: p.thumbnail.source, title: p.pageimage || "", lead: true }));
}

// Openverse caps anonymous requests at page_size=20 (more → error, no results).
async function searchOpenverse(q, page) {
  const url = "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) +
    "&page_size=20&page=" + page + "&mature=false";
  const r = await fetch(url);
  if (!r.ok) throw new Error("openverse");
  const j = await r.json();
  return (j.results || []).map((x) => ({
    thumb: x.thumbnail || x.url, full: x.url, title: x.title || "", creator: x.creator || x.source,
  }));
}

async function searchWikimedia(q, page) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
    "&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap") + "&gsrnamespace=6&gsrlimit=40&gsroffset=" + (page - 1) * 40 +
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

// Dedupe + per-uploader caps carry across "More" pages of the same query.
let state = { q: null, seen: new Set(), perCreator: {} };

// page 1: Wikipedia lead photos, icons, then photos. Later pages: photos only.
async function searchImages(q, page = 1) {
  if (page === 1 || state.q !== q) state = { q, seen: new Set(), perCreator: {} };
  const jobs = page === 1
    ? [searchWikipedia(q, "en"), searchWikipedia(q, "nl"), searchIcons(q), searchOpenverse(q, 1), searchWikimedia(q, 1)]
    : [searchOpenverse(q, page), searchWikimedia(q, page)];
  const settled = await Promise.allSettled(jobs);
  const merged = [];
  settled.forEach((s) => {
    if (s.status !== "fulfilled") return;
    s.value.forEach((res) => {
      const key = res.full || res.thumb;
      if (!key || state.seen.has(key)) return;
      if (res.title && !res.lead && JUNK.test(res.title)) return;
      if (res.creator && !res.icon) {
        state.perCreator[res.creator] = (state.perCreator[res.creator] || 0) + 1;
        if (state.perCreator[res.creator] > PER_CREATOR) return;
      }
      state.seen.add(key);
      merged.push(res);
    });
  });
  return merged;
}

// Own photo (camera or library) → small JPEG data URL, so storage stays light.
function fileToDataURL(file, max = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("image")); };
    img.src = u;
  });
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

window.VlotImages = { searchImages, toDataURL, fileToDataURL };
