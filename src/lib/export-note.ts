import type { Note } from "@/lib/store";

/** Export a note as a plain-text file. */
export function exportAsText(note: Note) {
  const doc = new DOMParser().parseFromString(note.content || "", "text/html");
  const text = (doc.body.textContent || "").trim();
  const body = `${note.title}\n${"=".repeat(note.title.length)}\n\n${text}\n`;
  downloadBlob(new Blob([body], { type: "text/plain" }), `${safeName(note.title)}.txt`);
}

/** Export a note as Markdown. */
export async function exportAsMarkdown(note: Note) {
  const { default: TurndownService } = await import("turndown");
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  const md = td.turndown(note.content || "");
  const body = `# ${note.title}\n\n${md}\n`;
  downloadBlob(new Blob([body], { type: "text/markdown" }), `${safeName(note.title)}.md`);
}

/** Export a note as a WYSIWYG PDF snapshot of the editor surface. */
export async function exportAsPdf(surface: HTMLElement, note: Note) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // Snapshot the full editor surface (text + ink layers) at high DPI.
  const canvas = await html2canvas(surface, {
    scale: Math.min(2, window.devicePixelRatio || 1) * 1.5,
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: surface.scrollWidth,
    windowHeight: surface.scrollHeight,
  });

  // A4 portrait in mm at 72dpi baseline.
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  // Scale ratio: canvas px -> pdf mm
  const pxPerMm = canvas.width / usableW;
  const pageSlicePx = Math.floor(usableH * pxPerMm);

  let offsetY = 0;
  let first = true;
  while (offsetY < canvas.height) {
    const sliceH = Math.min(pageSlicePx, canvas.height - offsetY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const img = slice.toDataURL("image/jpeg", 0.92);
    if (!first) pdf.addPage();
    pdf.addImage(img, "JPEG", margin, margin, usableW, sliceH / pxPerMm);
    offsetY += sliceH;
    first = false;
  }

  pdf.save(`${safeName(note.title)}.pdf`);
}

function safeName(s: string) {
  return (s || "note").replace(/[^a-z0-9-_ ]/gi, "").trim().slice(0, 60) || "note";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
