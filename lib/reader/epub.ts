// Minimal client-side EPUB → chapters parser. An EPUB is a ZIP of XHTML files;
// META-INF/container.xml points to the OPF, whose <spine> lists the reading
// order. We extract each spine document's text (in order) as a chapter. Runs in
// the browser only (uses DOMParser) — import from a Client Component.
import { unzipSync, strFromU8 } from "fflate";

export interface EpubChapter {
  title: string;
  text: string;
}

/** Normalise an href relative to the OPF's directory (handles ./ and ../). */
export function resolve(baseDir: string, href: string): string {
  const parts = (baseDir + href.split("#")[0]).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

/** Block-aware HTML → text (keeps paragraph breaks, drops markup/scripts). */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((e) => e.remove());
  doc.querySelectorAll("p, div, br, h1, h2, h3, h4, h5, li").forEach((e) => e.append("\n"));
  return (doc.body?.textContent ?? "").replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
}

function docHeading(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const h = doc.querySelector("h1, h2, h3, title")?.textContent?.trim();
  return h && h.length <= 40 ? h : "";
}

export function parseEpub(buf: ArrayBuffer): { title: string; chapters: EpubChapter[] } {
  const files = unzipSync(new Uint8Array(buf));
  const read = (path: string): string => (files[path] ? strFromU8(files[path]) : "");

  const opfPath = read("META-INF/container.xml").match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("Not a valid EPUB (no container.xml)");
  const baseDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const opf = new DOMParser().parseFromString(read(opfPath), "application/xml");
  const bookTitle =
    opf.getElementsByTagName("dc:title")[0]?.textContent?.trim() ||
    opf.querySelector("title")?.textContent?.trim() ||
    "Imported book";

  const manifest = new Map<string, string>();
  opf.querySelectorAll("manifest > item").forEach((it) => {
    const id = it.getAttribute("id");
    const href = it.getAttribute("href");
    if (id && href) manifest.set(id, href);
  });

  const chapters: EpubChapter[] = [];
  opf.querySelectorAll("spine > itemref").forEach((ref) => {
    const href = manifest.get(ref.getAttribute("idref") ?? "");
    if (!href) return;
    const html = read(resolve(baseDir, href));
    if (!html) return;
    const text = htmlToText(html);
    if (!text) return;
    chapters.push({ title: docHeading(html) || `Chapter ${chapters.length + 1}`, text });
  });

  return { title: bookTitle, chapters };
}
