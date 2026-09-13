"use strict";
/* ============================================================
   Vlot — free image search (Openverse primary, Wikimedia fallback)
   No API key, no signup. Picked images are converted to base64
   so cards keep working offline.
   ============================================================ */

async function searchOpenverse(q) {
  const url = "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) + "&page_size=12&mature=false";
  const r = await fetch(url);
  if (!r.ok) throw new Error("openverse");
  const j = await r.json();
  return (j.results || []).map((x) => ({ thumb: x.thumbnail || x.url, full: x.url }));
}

async function searchWikimedia(q) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search" +
    "&gsrsearch=" + encodeURIComponent(q) + "&gsrnamespace=6&gsrlimit=12" +
    "&prop=imageinfo&iiprop=url&iiurlwidth=200&format=json&origin=*";
  const r = await fetch(url);
  if (!r.ok) throw new Error("wikimedia");
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  return pages.filter((p) => p.imageinfo).map((p) => ({ thumb: p.imageinfo[0].thumburl, full: p.imageinfo[0].url }));
}

async function searchImages(q) {
  let results = [];
  try { results = await searchOpenverse(q); } catch (e) {}
  if (!results.length) { try { results = await searchWikimedia(q); } catch (e) {} }
  return results;
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
