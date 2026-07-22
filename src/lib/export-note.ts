import type { Note } from "@/lib/store";

/** Serialize freeform text blocks as HTML for export. */
function blocksToHtml(note: Note): string {
  if (!note.textBlocks?.length) return "";
  return note.textBlocks.map((b) => `<div style="margin:0.6em 0;">${b.html || ""}</div>`).join("\n");
}

/** Extract plain text from text blocks. */
function blocksToText(note: Note): string {
  if (!note.textBlocks?.length) return "";
  return note.textBlocks
    .map((b) => {
      const doc = new DOMParser().parseFromString(b.html || "", "text/html");
      return (doc.body.textContent || "").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Export a note as a plain-text file. */
export function exportAsText(note: Note) {
  const doc = new DOMParser().parseFromString(note.content || "", "text/html");
  const mainText = (doc.body.textContent || "").trim();
  const blockText = blocksToText(note);
  const combined = [mainText, blockText].filter(Boolean).join("\n\n");
  const body = `${note.title}\n${"=".repeat(note.title.length)}\n\n${combined}\n`;
  downloadBlob(new Blob([body], { type: "text/plain" }), `${safeName(note.title)}.txt`);
}

/** Export a note as Markdown. */
export async function exportAsMarkdown(note: Note) {
  const { default: TurndownService } = await import("turndown");
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  const html = [note.content || "", blocksToHtml(note)].filter(Boolean).join("\n");
  const md = td.turndown(html);
  const body = `# ${note.title}\n\n${md}\n`;
  downloadBlob(new Blob([body], { type: "text/markdown" }), `${safeName(note.title)}.md`);
}

/** Export a note as a WYSIWYG PDF snapshot of the editor surface. */
export async function exportAsPdf(surface: HTMLElement, note: Note) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  // Temporarily expand scroll containers so html2canvas captures full content.
  const restores: Array<() => void> = [];
  const expand = (el: HTMLElement) => {
    const prev = { overflow: el.style.overflow, height: el.style.height, maxHeight: el.style.maxHeight };
    el.style.overflow = "visible";
    el.style.height = "auto";
    el.style.maxHeight = "none";
    restores.push(() => Object.assign(el.style, prev));
  };
  let node: HTMLElement | null = surface;
  while (node && node !== document.body) {
    expand(node);
    node = node.parentElement;
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    // Wait for the editor to become visually stable
    if ("fonts" in document) {
      try {
        await (document as any).fonts.ready;
      } catch {}
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const rect = surface.getBoundingClientRect();

    const canvas = await html2canvas(surface, {
      scale: 2,

      backgroundColor: "#ffffff",

      useCORS: true,

      allowTaint: false,

      foreignObjectRendering: false,

      removeContainer: true,

      logging: false,

      imageTimeout: 0,

      width: Math.max(surface.scrollWidth, rect.width),

      height: Math.max(surface.scrollHeight, rect.height),

      windowWidth: Math.max(surface.scrollWidth, rect.width),

      windowHeight: Math.max(surface.scrollHeight, rect.height),

      scrollX: 0,

      scrollY: 0,

      x: 0,

      y: 0,

      onclone(doc) {
        const clonedSurface = doc.querySelector("[data-editor-surface]");

        if (clonedSurface instanceof HTMLElement) {
          clonedSurface.style.overflow = "visible";
          clonedSurface.style.height = "auto";
          clonedSurface.style.maxHeight = "none";
        }
      },
    });

    // A4 portrait in mm at 72dpi baseline.
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const pxPerMm = canvas.width / usableW;
    const pageSlicePx = Math.floor(usableH * pxPerMm);
    const findPageBreak = (
      ctx: CanvasRenderingContext2D,
      startY: number,
      idealY: number,
      width: number,
      maxHeight: number,
    ) => {
      const search = 120;

      const begin = Math.max(startY + 200, idealY - search);
      const end = Math.min(maxHeight - 1, idealY + search);

      let best = idealY;
      let lowestInk = Number.MAX_SAFE_INTEGER;

      for (let y = begin; y <= end; y++) {
        const row = ctx.getImageData(0, y, width, 1).data;

        let ink = 0;

        for (let i = 3; i < row.length; i += 4) {
          if (row[i] > 8) ink++;
        }

        if (ink < lowestInk) {
          lowestInk = ink;
          best = y;
        }

        if (ink === 0) break;
      }

      return best;
    };
    let offsetY = 0;
    const fullCtx = canvas.getContext("2d")!;
    let first = true;
    while (offsetY < canvas.height) {
      const idealEnd = Math.min(offsetY + pageSlicePx, canvas.height);

      const breakPoint = findPageBreak(fullCtx, offsetY, idealEnd, canvas.width, canvas.height);

      const sliceH = breakPoint - offsetY;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const img = slice.toDataURL("image/png");
      if (!first) pdf.addPage();
      pdf.addImage(img, "PNG", margin, margin, usableW, sliceH / pxPerMm);
      offsetY = breakPoint;
      first = false;
    }

    const blob = pdf.output("blob");
    downloadBlob(blob, `${safeName(note.title)}.pdf`);
  } finally {
    restores.forEach((fn) => fn());
  }
}

/** Export a note as PDF from raw data (no editor surface required). */
export async function exportNoteQuickPdf(note: Note) {
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:794px", // ~A4 @ 96dpi
    "padding:48px",
    "background:#ffffff",
    "color:#0f172a",
    "font-family:'Inter',system-ui,-apple-system,sans-serif",
    "font-size:15px",
    "line-height:1.6",
    "box-sizing:border-box",
  ].join(";");

  const title = `<h1 style="font-family:'Fraunces',Georgia,serif;font-size:32px;line-height:1.2;margin:0 0 8px;">${escapeHtml(note.emoji || "")} ${escapeHtml(note.title || "Untitled")}</h1>`;
  const meta = `<div style="color:#64748b;font-size:12px;margin-bottom:24px;">${new Date(note.updatedAt).toLocaleString()}</div>`;
  const body = note.content || "";
  const blocks = blocksToHtml(note);
  const strokesNote = note.strokes?.length
    ? `<div style="margin-top:24px;padding:12px 14px;border:1px dashed #cbd5e1;border-radius:8px;color:#64748b;font-size:12px;">This note contains ${note.strokes.length} handwritten stroke${note.strokes.length === 1 ? "" : "s"} — open the note and use “Export as PDF” to include the canvas.</div>`
    : "";

  container.innerHTML = `${title}${meta}<div>${body}</div>${blocks}${strokesNote}`;
  document.body.appendChild(container);

  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const pxPerMm = canvas.width / usableW;
    const pageSlicePx = Math.floor(usableH * pxPerMm);
    const findPageBreak = (
      ctx: CanvasRenderingContext2D,
      startY: number,
      idealY: number,
      width: number,
      maxHeight: number,
    ) => {
      const search = 120;

      const begin = Math.max(startY + 200, idealY - search);
      const end = Math.min(maxHeight - 1, idealY + search);

      let best = idealY;
      let lowestInk = Number.MAX_SAFE_INTEGER;

      for (let y = begin; y <= end; y++) {
        const row = ctx.getImageData(0, y, width, 1).data;

        let ink = 0;

        for (let i = 3; i < row.length; i += 4) {
          if (row[i] > 8) ink++;
        }

        if (ink < lowestInk) {
          lowestInk = ink;
          best = y;
        }

        if (ink === 0) break;
      }

      return best;
    };
    let offsetY = 0;
    const fullCtx = canvas.getContext("2d")!;
    let first = true;
    while (offsetY < canvas.height) {
      const idealEnd = Math.min(offsetY + pageSlicePx, canvas.height);

      const breakPoint = findPageBreak(fullCtx, offsetY, idealEnd, canvas.width, canvas.height);

      const sliceH = breakPoint - offsetY;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const img = slice.toDataURL("image/png");
      if (!first) pdf.addPage();
      pdf.addImage(img, "PNG", margin, margin, usableW, sliceH / pxPerMm);
      offsetY = breakPoint;
      first = false;
    }

    const blob = pdf.output("blob");
    downloadBlob(blob, `${safeName(note.title)}.pdf`);
  } finally {
    container.remove();
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function safeName(s: string) {
  return (
    (s || "note")
      .replace(/[^a-z0-9-_ ]/gi, "")
      .trim()
      .slice(0, 60) || "note"
  );
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
