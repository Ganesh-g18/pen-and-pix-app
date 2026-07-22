import type { Note } from "@/lib/store";

const OKLCH_COLOR_PATTERN =
  /oklch\(\s*((?:\d*\.?\d+|\.\d+)%?)\s+((?:\d*\.?\d+|\.\d+)%?)\s+([+-]?(?:\d*\.?\d+|\.\d+)(?:deg|grad|rad|turn)?)(?:\s*\/\s*((?:\d*\.?\d+|\.\d+)%?))?\s*\)/gi;

const RGB_COLOR_PROPERTIES = ["color", "background-color", "border-color", "outline-color", "fill", "stroke"] as const;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function parseCssNumber(value: string, percentageScale = 1) {
  const number = Number.parseFloat(value);
  return value.endsWith("%") ? (number / 100) * percentageScale : number;
}

function parseHue(value: string) {
  const number = Number.parseFloat(value);

  if (value.endsWith("grad")) return number * 0.9;
  if (value.endsWith("rad")) return (number * 180) / Math.PI;
  if (value.endsWith("turn")) return number * 360;

  return number;
}

function oklchToRgb(_: string, lightnessValue: string, chromaValue: string, hueValue: string, alphaValue?: string) {
  const lightness = parseCssNumber(lightnessValue);
  const chroma = parseCssNumber(chromaValue, 0.4);
  const hue = (parseHue(hueValue) * Math.PI) / 180;
  const alpha = alphaValue ? clamp(parseCssNumber(alphaValue)) : 1;

  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const toSrgb = (value: number) => {
    const linear = clamp(value);
    const encoded = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
  };

  const red = toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}

function inlineRgbColors(clonedDocument: Document) {
  clonedDocument.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const computed = clonedDocument.defaultView?.getComputedStyle(element);
    if (!computed) return;

    for (const property of RGB_COLOR_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      const converted = value.replace(OKLCH_COLOR_PATTERN, oklchToRgb);

      if (converted !== value) {
        element.style.setProperty(property, converted, computed.getPropertyPriority(property));
      }
    }
  });
}

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
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  if ("fonts" in document) {
    try {
      await document.fonts.ready;
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
    onclone(clonedDocument) {
      inlineRgbColors(clonedDocument);

      let clonedNode = clonedDocument.querySelector<HTMLElement>("[data-editor-surface]");
      while (clonedNode && clonedNode !== clonedDocument.body) {
        clonedNode.style.overflow = "visible";
        clonedNode.style.height = "auto";
        clonedNode.style.maxHeight = "none";
        clonedNode = clonedNode.parentElement;
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
}

/** Export a note as PDF from raw data (no editor surface required). */
export async function exportNoteQuickPdf(note: Note) {
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "width:794px",
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
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
      onclone(clonedDocument) {
        inlineRgbColors(clonedDocument);
      },
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
