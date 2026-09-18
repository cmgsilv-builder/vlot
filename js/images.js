"use strict";
/* ============================================================
   Vlot — free image search (Openverse primary, Wikimedia fallback)
   No API key, no signup. Picked images are converted to base64
   so cards keep working offline.
   ============================================================ */

// Openverse. `title` weights matches in the file title (more on-topic than
// loose tag hits), and we ask for a big page so there are lots to pick from.
async function searchOpenverse(q) {
  const url = "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) +
    "&title=" + encodeURIComponent(q) +
    "&page_size=40&mature=false";
  const r = await fetch(url);
  if (!r.ok) throw new Error("openverse");
  const j = await r.json();
  return (j.results || []).map((x) => ({ thumb: x.thumbnail || x.url, full: x.url }));
}

async function searchWikimedia(q) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
    "&gsrsearch=" + encodeURIComponent(q) + "&gsrnamespace=6&gsrlimit=40" +
    "&prop=imageinfo&iiprop=url&iiurlwidth=240&format=json&origin=*";
  const r = await fetch(url);
  if (!r.ok) throw new Error("wikimedia");
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  // `index` preserves the search-relevance order the API returned.
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  return pages.filter((p) => p.imageinfo).map((p) => ({ thumb: p.imageinfo[0].thumburl, full: p.imageinfo[0].url }));
}

// Run both sources and merge, so results are more on-topic and there are far
// more options. Deduped by URL; Openverse first, Wikimedia after.
async function searchImages(q) {
  const settled = await Promise.allSettled([searchOpenverse(q), searchWikimedia(q)]);
  const merged = [];
  const seen = new Set();
  settled.forEach((s) => {
    if (s.status !== "fulfilled") return;
    s.value.forEach((res) => {
      const key = res.full || res.thumb;
      if (!key || seen.has(key)) return;
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
