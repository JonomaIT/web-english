// A lesson's PDF read in the page, on any device: PDF.js draws each page at the width of the screen.
// The browsers' own viewers are not enough: on Android a PDF link downloads the file. This component
// is its own chunk, and PDF.js loads only when a PDF is opened.
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

export default function PdfViewer({ src, title }: { src: string; title: string }) {
  const pages = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      task = pdfjs.getDocument({ url: src });
      const doc = await task.promise;
      const box = pages.current;
      if (!box || cancelled) return;
      box.replaceChildren();
      const width = box.clientWidth;
      const ratio = window.devicePixelRatio || 1;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (cancelled) return;
        // Drawn at the device's pixel density, shown at the column's width: sharp on phones.
        const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "pdf__page";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${title}, page ${n} of ${doc.numPages}`);
        box.append(canvas);
        await page.render({ canvas, viewport }).promise;
      }
      if (!cancelled) setState("ready");
    })().catch((err: unknown) => {
      if (cancelled) return;
      console.error("PDF:", err);
      setState("error");
    });

    // Leaving the lesson (or hiding the PDF) stops the worker and frees the document.
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [src, title]);

  return (
    <div className="pdf">
      {state === "loading" ? <p className="hint">Opening the PDF…</p> : null}
      {state === "error" ? (
        <p className="hint" role="alert">
          The PDF could not be shown here. <a href={src}>Open it in a new tab</a>.
        </p>
      ) : null}
      <div ref={pages} className="pdf__pages" />
    </div>
  );
}
