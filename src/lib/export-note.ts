import type { Note } from "@/lib/store";
import jsPDF from "jspdf";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function safeName(name: string) {
  return (
    (name || "note")
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

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return m;
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                              Text Block Utils                              */
/* -------------------------------------------------------------------------- */

function blocksToHtml(note: Note) {
  if (!note.textBlocks?.length) return "";

  return note.textBlocks
    .map(
      (block) =>
        `<div style="margin:8px 0;">${block.html || ""}</div>`
    )
    .join("");
}

function blocksToPlainText(note: Note) {
  if (!note.textBlocks?.length) return "";

  return note.textBlocks
    .map((block) => {
      const doc = new DOMParser().parseFromString(
        block.html || "",
        "text/html"
      );

      return (doc.body.textContent || "").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

/* -------------------------------------------------------------------------- */
/*                           SVG → Canvas Helpers                             */
/* -------------------------------------------------------------------------- */

async function svgElementToCanvas(svg: SVGSVGElement): Promise<HTMLCanvasElement> {
  const rect = svg.getBoundingClientRect();

  const width = Math.max(rect.width, svg.viewBox.baseVal.width || 1);
  const height = Math.max(rect.height, svg.viewBox.baseVal.height || 1);

  const clone = svg.cloneNode(true) as SVGSVGElement;

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", `${width}`);
  clone.setAttribute("height", `${height}`);

  const svgString = new XMLSerializer().serializeToString(clone);

  const blob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(img, 0, 0);

    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* -------------------------------------------------------------------------- */

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  margin = 10
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imageWidth = usableWidth;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;

  let remaining = imageHeight;
  let offset = 0;

  while (remaining > 0) {
    if (offset > 0) {
      pdf.addPage();
    }

    const pageCanvas = document.createElement("canvas");

    pageCanvas.width = canvas.width;

    const sliceHeightPx = Math.min(
      canvas.height - offset,
      Math.round((usableHeight * canvas.width) / usableWidth)
    );

    pageCanvas.height = sliceHeightPx;

    const ctx = pageCanvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    ctx.drawImage(
      canvas,
      0,
      offset,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx
    );

    pdf.addImage(
      pageCanvas.toDataURL("PNG"),
      "PNG",
      margin,
      margin,
      usableWidth,
      (sliceHeightPx * usableWidth) / canvas.width
    );

    offset += sliceHeightPx;
    remaining -= (sliceHeightPx * usableWidth) / canvas.width;
  }
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
    // html2canvas cannot parse Tailwind v4 OKLCH colors.
// Temporarily convert them to RGB-compatible values.

const clonedStyles: Array<{ element: HTMLElement; style: string | null }> = [];

surface.querySelectorAll<HTMLElement>("*").forEach((el) => {
  const style = el.getAttribute("style");

  clonedStyles.push({
    element: el,
    style,
  });

  const computed = window.getComputedStyle(el);

  const apply = (property: string) => {
    const value = computed.getPropertyValue(property);

    if (value.includes("oklch(")) {
      el.style.setProperty(property, computed[property as any]);
    }
  };

  apply("color");
  apply("background-color");
  apply("border-color");
  apply("outline-color");
});
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
    })clonedStyles.forEach(({ element, style }) => {
  if (style === null) {
    element.removeAttribute("style");
  } else {
    element.setAttribute("style", style);
  }
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
    // html2canvas cannot parse Tailwind v4 OKLCH colors.
// Temporarily convert them to RGB-compatible values.

const clonedStyles: Array<{ element: HTMLElement; style: string | null }> = [];

surface.querySelectorAll<HTMLElement>("*").forEach((el) => {
  const style = el.getAttribute("style");

  clonedStyles.push({
    element: el,
    style,
  });

  const computed = window.getComputedStyle(el);

  const apply = (property: string) => {
    const value = computed.getPropertyValue(property);

    if (value.includes("oklch(")) {
      el.style.setProperty(property, computed[property as any]);
    }
  };

  apply("color");
  apply("background-color");
  apply("border-color");
  apply("outline-color");
});
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight,
    })
      clonedStyles.forEach(({ element, style }) => {
  if (style === null) {
    element.removeAttribute("style");
  } else {
    element.setAttribute("style", style);
  }
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
