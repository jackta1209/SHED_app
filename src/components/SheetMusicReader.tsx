import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Save,
  X,
  FileText,
  ImageIcon,
  BookOpen,
} from "lucide-react";
import {
  sheetMusicStore,
  isSupported,
  type SavedSheetMeta,
} from "@/lib/sheet-music-storage";
import { FullscreenShell, FullscreenButton } from "@/components/FullscreenShell";
import { useToolUsageLogger } from "@/lib/tool-usage";

// Configure pdf.js worker. Use the bundled pdfjs-dist version (must match the
// version react-pdf depends on — pinned in package.json) so the API and
// Worker versions are identical.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type Kind = "pdf" | "image" | null;

function detectKind(name: string, type: string): Kind {
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name)) return "image";
  return null;
}

export function SheetMusicReader() {
  const [url, setUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(null);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [saved, setSaved] = useState<SavedSheetMeta[]>([]);
  const [showLibrary, setShowLibrary] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [reading, setReading] = useState(false);
  const readingStageRef = useRef<HTMLDivElement>(null);
  const [readingWidth, setReadingWidth] = useState<number>(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentBlobRef = useRef<Blob | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const usage = useToolUsageLogger("sheet_music_reader");
  useEffect(() => { if (fileName) usage.update({ file_used: fileName }); }, [fileName]);
  useEffect(() => { usage.track("page_numbers_viewed", page); }, [page]);
  useEffect(() => { if (fullscreen) usage.update({ fullscreen_used: true }); }, [fullscreen]);
  useEffect(() => { if (reading) usage.update({ reading_mode_used: true }); }, [reading]);

  // Track stage width so PDF pages render at the right size in both inline
  // and fullscreen modes.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setStageWidth(el.clientWidth);
    });
    ro.observe(el);
    setStageWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [fullscreen, url]);

  // Track reading-mode stage width separately.
  useEffect(() => {
    if (!reading) return;
    const el = readingStageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setReadingWidth(el.clientWidth));
    ro.observe(el);
    setReadingWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [reading, url]);

  // Lock body scroll + Esc-to-close while in Reading Mode.
  useEffect(() => {
    if (!reading) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReading(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [reading]);

  // Load saved library on mount
  useEffect(() => {
    sheetMusicStore
      .list()
      .then(setSaved)
      .catch((e) => {
        console.warn("Sheet library unavailable:", e);
      });
  }, []);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, []);

  function resetViewerState() {
    setPage(1);
    setZoom(100);
    setNumPages(0);
    setPdfError(null);
    setImgError(false);
  }

  function loadBlob(blob: Blob, name: string, type: string, savedId: string | null) {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    const next = URL.createObjectURL(blob);
    currentUrlRef.current = next;
    currentBlobRef.current = blob;
    setUrl(next);
    setFileName(name);
    setKind(detectKind(name, type));
    setCurrentSavedId(savedId);
    resetViewerState();
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isSupported(file)) {
      toast.error("Unsupported file. Use PDF, PNG, JPG, or WEBP.");
      return;
    }
    loadBlob(file, file.name, file.type, null);
  }

  function clearCurrent() {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    currentBlobRef.current = null;
    setUrl(null);
    setFileName(null);
    setKind(null);
    setCurrentSavedId(null);
    resetViewerState();
  }

  async function saveCurrent() {
    if (!currentBlobRef.current || !fileName) return;
    if (currentSavedId) {
      toast("Already in your library.");
      return;
    }
    try {
      const file = new File(
        [currentBlobRef.current],
        fileName,
        { type: currentBlobRef.current.type || "application/octet-stream" },
      );
      const meta = await sheetMusicStore.save(file);
      setSaved((prev) => [meta, ...prev]);
      setCurrentSavedId(meta.id);
      toast.success("Saved to local library.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not save file.";
      toast.error(msg.includes("quota") ? "Storage is full." : `Save failed: ${msg}`);
    }
  }

  async function openSaved(id: string) {
    try {
      const rec = await sheetMusicStore.get(id);
      if (!rec) {
        toast.error("File not found.");
        return;
      }
      const inferred =
        rec.type ||
        (/\.pdf$/i.test(rec.name)
          ? "application/pdf"
          : /\.(png)$/i.test(rec.name)
            ? "image/png"
            : /\.(jpe?g)$/i.test(rec.name)
              ? "image/jpeg"
              : /\.webp$/i.test(rec.name)
                ? "image/webp"
                : "application/octet-stream");
      const typedBlob =
        rec.blob.type === inferred ? rec.blob : new Blob([rec.blob], { type: inferred });
      loadBlob(typedBlob, rec.name, inferred, rec.id);
    } catch (err) {
      console.error(err);
      toast.error("Could not open file.");
    }
  }

  async function deleteSaved(id: string) {
    if (!confirm("Delete this saved sheet music from this device?")) return;
    try {
      await sheetMusicStore.remove(id);
      setSaved((prev) => prev.filter((s) => s.id !== id));
      if (currentSavedId === id) clearCurrent();
      toast.success("Deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Delete failed.");
    }
  }

  const zoomScale = zoom / 100;
  const canPrev = page > 1;
  const canNext = numPages > 0 && page < numPages;

  const documentFile = useMemo(() => (url ? { url } : null), [url]);

  return (
    <FullscreenShell
      active={fullscreen}
      onToggle={() => setFullscreen((v) => !v)}
      title="Sheet Music Reader"
    >
    <div className={fullscreen ? "h-full" : "rounded-2xl border border-border bg-card p-3"}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Sheet Music Reader
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            onChange={onPickFile}
            className="hidden"
          />
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={12} className="mr-1" /> Import
          </Button>
          <FullscreenButton active={fullscreen} onToggle={() => setFullscreen((v) => !v)} />
        </div>
      </div>

      {/* Library */}
      <div className="mt-3">
        <button
          onClick={() => setShowLibrary((s) => !s)}
          className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Library ({saved.length}) {showLibrary ? "▾" : "▸"}
        </button>
        {showLibrary && (
          <div className="mt-2">
            {saved.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved sheet music yet. Import a file and tap Save.
              </p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {saved.map((s) => {
                  const isOpen = s.id === currentSavedId;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                        isOpen ? "border-primary bg-primary/5" : "border-border bg-background"
                      }`}
                    >
                      {detectKind(s.name, s.type) === "pdf" ? (
                        <FileText size={12} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <ImageIcon size={12} className="shrink-0 text-muted-foreground" />
                      )}
                      <button
                        onClick={() => openSaved(s.id)}
                        className="min-w-0 flex-1 truncate text-left"
                        title={s.name}
                      >
                        {s.name}
                      </button>
                      <button
                        onClick={() => deleteSaved(s.id)}
                        aria-label={`Delete ${s.name}`}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Saved sheet music is stored locally on this device. It is not uploaded to SHED cloud
              storage and does not sync across devices. Clearing browser data may remove it.
            </p>
          </div>
        )}
      </div>

      {/* Viewer */}
      {url && fileName ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs" title={fileName}>
              {fileName}
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setReading(true)}
                aria-label="Open Reading Mode"
                title="Score-focused Reading Mode"
              >
                <BookOpen size={12} className="mr-1" /> Reading Mode
              </Button>
              {!currentSavedId && (
                <Button size="sm" variant="ghost" onClick={saveCurrent} aria-label="Save to library">
                  <Save size={12} className="mr-1" /> Save
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearCurrent} aria-label="Close file">
                <X size={12} />
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                aria-label="Zoom out"
                disabled={zoom <= 50}
              >
                <ZoomOut size={12} />
              </Button>
              <span className="min-w-[3rem] text-center font-mono text-xs tabular-nums">
                {zoom}%
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom((z) => Math.min(300, z + 10))}
                aria-label="Zoom in"
                disabled={zoom >= 300}
              >
                <ZoomIn size={12} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setZoom(100)}
                aria-label="Reset zoom"
              >
                <RotateCcw size={12} />
              </Button>
            </div>
            {kind === "pdf" && numPages > 0 && (
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={12} />
                </Button>
                <span className="min-w-[3.5rem] text-center font-mono text-xs tabular-nums">
                  {page} / {numPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(numPages, p + 1))}
                  disabled={!canNext}
                  aria-label="Next page"
                >
                  <ChevronRight size={12} />
                </Button>
              </div>
            )}
          </div>

          {/* Stage */}
          <div
            ref={stageRef}
            className={
              fullscreen
                ? "mt-2 overflow-auto rounded-lg border border-border bg-background p-2"
                : "mt-2 max-h-[70vh] overflow-auto rounded-lg border border-border bg-background p-2"
            }
            style={fullscreen ? { maxHeight: "calc(100vh - 220px)" } : undefined}
          >
            {kind === "pdf" && documentFile && (
              <>
                {pdfError ? (
                  <p className="p-4 text-center text-xs text-destructive">{pdfError}</p>
                ) : (
                  <Document
                    file={documentFile}
                    onLoadSuccess={({ numPages: n }) => {
                      setNumPages(n);
                      setPdfError(null);
                    }}
                    onLoadError={(err) => {
                      console.error("PDF load error", err);
                      setPdfError("Could not load this PDF.");
                    }}
                    loading={<p className="p-4 text-center text-xs text-muted-foreground">Loading PDF…</p>}
                  >
                    <Page
                      pageNumber={page}
                      scale={zoomScale}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      width={
                        stageWidth > 0
                          ? Math.max(200, stageWidth - 16)
                          : Math.min(800, (typeof window !== "undefined" ? window.innerWidth : 800) - 80)
                      }
                    />
                  </Document>
                )}
              </>
            )}
            {kind === "image" &&
              (imgError ? (
                <p className="p-4 text-center text-xs text-destructive">Could not load image.</p>
              ) : (
                <div className="flex justify-center">
                  <img
                    src={url}
                    alt={fileName}
                    onError={() => setImgError(true)}
                    style={{
                      width: `${zoom}%`,
                      maxWidth: zoom <= 100 ? "100%" : "none",
                      height: "auto",
                    }}
                    className="block"
                  />
                </div>
              ))}
            {kind === null && (
              <p className="p-4 text-center text-xs text-destructive">Unsupported file type.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Import a PDF or image (PNG, JPG, WEBP) to view sheet music. Save it to keep it on this
            device.
          </p>
        </div>
      )}
    </div>
    {reading && url && fileName && typeof document !== "undefined" &&
      createPortal(
        <div className="fixed inset-0 z-[110] flex flex-col bg-background">
          <div
            ref={readingStageRef}
            className="flex-1 overflow-auto bg-background"
            style={{ paddingBottom: "5rem" }}
          >
            {kind === "pdf" && documentFile && !pdfError && (
              <div className="flex justify-center p-2">
                <Document
                  file={documentFile}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  onLoadError={(err) => {
                    console.error("PDF load error", err);
                    setPdfError("Could not load this PDF.");
                  }}
                  loading={
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Loading PDF…
                    </p>
                  }
                >
                  <Page
                    pageNumber={page}
                    scale={zoomScale}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    width={
                      readingWidth > 0
                        ? Math.max(280, readingWidth - 16)
                        : Math.min(
                            1200,
                            (typeof window !== "undefined" ? window.innerWidth : 1200) - 16,
                          )
                    }
                  />
                </Document>
              </div>
            )}
            {kind === "pdf" && pdfError && (
              <p className="p-6 text-center text-xs text-destructive">{pdfError}</p>
            )}
            {kind === "image" && !imgError && (
              <div className="flex justify-center p-2">
                <img
                  src={url}
                  alt={fileName}
                  onError={() => setImgError(true)}
                  style={{
                    width: `${zoom}%`,
                    maxWidth: zoom <= 100 ? "100%" : "none",
                    height: "auto",
                  }}
                  className="block"
                />
              </div>
            )}
            {kind === "image" && imgError && (
              <p className="p-6 text-center text-xs text-destructive">Could not load image.</p>
            )}
          </div>

          {/* Floating compact controls */}
          <div
            className="fixed inset-x-0 bottom-0 z-[120] flex items-center justify-center gap-2 border-t border-border bg-background/95 px-3 py-2 backdrop-blur"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
          >
            <Button size="sm" variant="ghost" onClick={() => setReading(false)} aria-label="Close Reading Mode">
              <X size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              disabled={zoom <= 50}
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </Button>
            <span className="min-w-[3rem] text-center font-mono text-xs tabular-nums">{zoom}%</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom((z) => Math.min(300, z + 10))}
              disabled={zoom >= 300}
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setZoom(100)} aria-label="Fit/Reset zoom">
              <RotateCcw size={14} />
            </Button>
            {kind === "pdf" && numPages > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="min-w-[3.5rem] text-center font-mono text-xs tabular-nums">
                  {page} / {numPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(numPages, p + 1))}
                  disabled={!canNext}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </Button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </FullscreenShell>
  );
}
