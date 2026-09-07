import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/api";
import { useToast } from "./useToast";

/**
 * Fridge Scan — photo in, confirmed ingredient chips out.
 *
 * Three sources, in the order they are trustworthy under exhibition-hall
 * lighting: a saved photo, a file from disk, and the webcam last. Whatever the
 * source, the flow is the same — the photo comes back with boxes drawn over
 * it, every detection becomes a chip the cook can drop, and nothing reaches
 * the fridge until they press confirm.
 *
 * That confirm step is not a safety net bolted onto a weak model. It is the
 * right interaction: the cook is standing in front of the fridge and knows
 * what is in it. The model's job is to save them the typing.
 */

// Drop .jpg/.png files into src/assets/demo-photos/ and they appear here — no
// manifest to keep in sync, no network fetch, and they are bundled into the
// build so they still work with the WiFi off.
const SAMPLE_MODULES = import.meta.glob("../assets/demo-photos/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

const SAMPLES = Object.entries(SAMPLE_MODULES)
  .map(([path, url]) => ({
    url,
    name: path.split("/").pop(),
    label: prettifySampleName(path.split("/").pop()),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function prettifySampleName(filename = "") {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Sample";
}

const BOX_COLOURS = [
  "#0f5132", "#b5762a", "#1d4ed8", "#9d174d",
  "#0369a1", "#6d28d9", "#a16207", "#065f46",
];

export default function FridgeScan({ onConfirm, alreadyInFridge = [] }) {
  const [status, setStatus] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [dropped, setDropped] = useState(() => new Set());
  const [scanning, setScanning] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [camera, setCamera] = useState(false);

  const fileInput = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const objectUrl = useRef(null);
  const { showToast } = useToast();

  // Ask the sidecar what it loaded. Purely so the panel can say "detector
  // offline" up front instead of after a judge has already taken a photo.
  useEffect(() => {
    let cancelled = false;

    api
      .scanStatus()
      .then((response) => !cancelled && setStatus(response))
      .catch(() => !cancelled && setStatus({ online: false, status: "offline" }));

    return () => {
      cancelled = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamera(false);
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const owned = useMemo(
    () => new Set(alreadyInFridge.map((name) => String(name).toLowerCase())),
    [alreadyInFridge]
  );

  const kept = useMemo(
    () => (result?.data ?? []).filter((item) => !dropped.has(item.slug)),
    [result, dropped]
  );

  async function runScan(file) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);

    setPhotoUrl(objectUrl.current);
    setResult(null);
    setDropped(new Set());
    setScanning(true);

    try {
      const response = await api.scanFridge(file);
      setResult(response);

      if (response.data.length === 0) {
        showToast("Nothing recognisable in that photo — add ingredients by hand.", "error");
      }
    } catch (error) {
      showToast(error.message, "error");
      setResult(null);
    } finally {
      setScanning(false);
    }
  }

  async function scanSample(sample) {
    try {
      const blob = await fetch(sample.url).then((response) => response.blob());
      await runScan(new File([blob], sample.name, { type: blob.type || "image/jpeg" }));
    } catch {
      showToast("Couldn't load that sample photo.", "error");
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });

      streamRef.current = stream;
      setCamera(true);

      // The <video> only exists once `camera` is true, so attaching the stream
      // has to wait for that render.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      showToast("No camera available — upload a photo instead.", "error");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        stopCamera();
        if (blob) runScan(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  function confirm() {
    if (kept.length === 0) return;

    onConfirm(
      kept.map((item) => ({
        name: item.name,
        detected_as: item.label,
        confidence: item.confidence,
      }))
    );
  }

  function reset() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPhotoUrl(null);
    setResult(null);
    setDropped(new Set());
  }

  const offline = status && status.online === false;

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-sm)]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 font-[var(--font-display)] text-xl font-black text-[var(--text)]">
            Snap your fridge
          </h2>
          <p className="m-0 mt-1 text-sm text-[var(--muted)]">
            One photo. We spot the ingredients — you confirm before we search.
          </p>
        </div>
        <DetectorBadge status={status} />
      </header>

      {offline && (
        <p className="mt-4 rounded-[var(--r-sm)] border border-[var(--accent)] bg-[var(--accent-glow)] px-3 py-2 text-xs text-[var(--brand-deep)]">
          The detector isn&apos;t running. Start it with{" "}
          <code className="font-[var(--font-mono)]">scripts/start-demo.ps1</code>, or just add
          ingredients by hand below — everything else still works.
        </p>
      )}

      {/* ── Source picker ──────────────────────────────────────────── */}
      {!photoUrl && !camera && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-[var(--r-pill)] bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-deep)]"
            >
              Upload a photo
            </button>
            <button
              type="button"
              onClick={startCamera}
              className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              Use the webcam
            </button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) runScan(file);
            }}
          />

          {SAMPLES.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wider text-[var(--muted-light)]">
                Or try a saved fridge
              </p>
              <div className="flex flex-wrap gap-3">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.name}
                    type="button"
                    onClick={() => scanSample(sample)}
                    title={sample.label}
                    className="group overflow-hidden rounded-[var(--r-md)] border border-[var(--border-strong)] transition hover:border-[var(--brand)]"
                  >
                    <img
                      src={sample.url}
                      alt={sample.label}
                      className="h-20 w-28 object-cover transition group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Live camera ────────────────────────────────────────────── */}
      {camera && (
        <div className="mt-5">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-[var(--r-md)] border border-[var(--border-strong)] bg-black"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={capture}
              className="rounded-[var(--r-pill)] bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Photo + boxes ──────────────────────────────────────────── */}
      {photoUrl && (
        <div className="mt-5">
          <BoxedPhoto
            src={photoUrl}
            image={result?.image}
            items={kept}
            scanning={scanning}
            hovered={hovered}
            onToggle={(slug) => toggleDropped(slug, setDropped)}
          />

          {result && (
            <p className="mt-2 font-[var(--font-mono)] text-[11px] text-[var(--muted-light)]">
              {result.meta.backend === "world" ? "open-vocabulary" : result.meta.backend} ·{" "}
              {result.meta.weights} · {result.meta.detection_count} detections in{" "}
              {Math.round(result.meta.elapsed_ms)} ms · on this laptop
            </p>
          )}
        </div>
      )}

      {/* ── Chips + confirm ────────────────────────────────────────── */}
      {result && (
        <div className="mt-5">
          <p className="mb-2 text-xs uppercase tracking-wider text-[var(--muted-light)]">
            {kept.length > 0
              ? `Found ${kept.length} ingredient${kept.length === 1 ? "" : "s"} — drop anything wrong`
              : "Nothing kept — drop a photo with more of the shelf in frame"}
          </p>

          <div className="flex flex-wrap gap-2">
            {(result.data ?? []).map((item, index) => (
              <DetectionChip
                key={item.slug}
                item={item}
                colour={BOX_COLOURS[index % BOX_COLOURS.length]}
                dropped={dropped.has(item.slug)}
                duplicate={owned.has(item.name.toLowerCase())}
                onHover={setHovered}
                onToggle={() => toggleDropped(item.slug, setDropped)}
              />
            ))}
          </div>

          {result.unmatched?.length > 0 && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Seen but not in the ingredient list:{" "}
              {result.unmatched.map((item) => item.name).join(", ")}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={kept.length === 0}
              className="rounded-[var(--r-pill)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add {kept.length} to my fridge
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-[var(--r-pill)] border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold"
            >
              Try another photo
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function toggleDropped(slug, setDropped) {
  setDropped((current) => {
    const next = new Set(current);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    return next;
  });
}

/**
 * The photo with the detection boxes over it.
 *
 * Boxes are percentage-positioned from the source image dimensions rather than
 * drawn on a canvas, so they stay put when the layout reflows and the labels
 * stay crisp at any size — and each one is a real button you can click to drop
 * the ingredient it found.
 */
function BoxedPhoto({ src, image, items, scanning, hovered, onToggle }) {
  const width = image?.width || 1;
  const height = image?.height || 1;

  return (
    <div className="relative overflow-hidden rounded-[var(--r-md)] border border-[var(--border-strong)] bg-black/5">
      <img src={src} alt="Your fridge" className="block w-full" />

      {items.map((item, index) =>
        (item.boxes ?? []).map((box, boxIndex) => {
          const [x1, y1, x2, y2] = box;
          const colour = BOX_COLOURS[index % BOX_COLOURS.length];
          const dim = hovered && hovered !== item.slug;

          return (
            <button
              key={`${item.slug}-${boxIndex}`}
              type="button"
              onClick={() => onToggle(item.slug)}
              title={`${item.name} — click to drop`}
              style={{
                left: `${(x1 / width) * 100}%`,
                top: `${(y1 / height) * 100}%`,
                width: `${((x2 - x1) / width) * 100}%`,
                height: `${((y2 - y1) / height) * 100}%`,
                borderColor: colour,
                opacity: dim ? 0.25 : 1,
              }}
              className="absolute rounded-[3px] border-2 transition-opacity"
            >
              <span
                style={{ backgroundColor: colour }}
                className="absolute -top-[1px] left-[-2px] max-w-[200%] -translate-y-full whitespace-nowrap rounded-t-[3px] px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white"
              >
                {item.name} {Math.round(item.confidence * 100)}%
              </span>
            </button>
          );
        })
      )}

      {scanning && (
        <div className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-semibold text-white">
          <span className="rounded-[var(--r-pill)] bg-black/60 px-4 py-2">Looking…</span>
        </div>
      )}
    </div>
  );
}

function DetectionChip({ item, colour, dropped, duplicate, onHover, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => onHover(item.slug)}
      onMouseLeave={() => onHover(null)}
      style={{ borderColor: dropped ? undefined : colour }}
      className={`inline-flex items-center gap-2 rounded-[var(--r-pill)] border-2 py-1.5 pl-3 pr-2.5 text-sm transition ${
        dropped
          ? "border-[var(--border)] text-[var(--muted-light)] line-through"
          : "bg-[var(--surface)] text-[var(--text)]"
      }`}
    >
      <span className="font-semibold">{item.name}</span>

      {item.count > 1 && !dropped && (
        <span className="font-[var(--font-mono)] text-[11px] text-[var(--muted)]">×{item.count}</span>
      )}

      <span className="font-[var(--font-mono)] text-[11px] text-[var(--muted)]">
        {Math.round(item.confidence * 100)}%
      </span>

      {duplicate && !dropped && (
        <span className="rounded-[var(--r-pill)] bg-[var(--brand-glow)] px-1.5 text-[10px] font-bold text-[var(--brand-deep)]">
          have
        </span>
      )}

      <span className="grid h-5 w-5 place-items-center rounded-full bg-[rgba(10,58,36,0.12)] text-xs leading-none">
        {dropped ? "+" : "×"}
      </span>
    </button>
  );
}

function DetectorBadge({ status }) {
  if (!status) {
    return <span className="text-xs text-[var(--muted-light)]">checking detector…</span>;
  }

  const online = status.online && status.detector?.ready;
  const backend = status.detector?.backend;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-1 font-[var(--font-mono)] text-[11px] ${
        online
          ? "bg-[var(--brand-glow)] text-[var(--brand-deep)]"
          : "bg-[var(--accent-glow)] text-[var(--accent)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[var(--brand)]" : "bg-[var(--accent)]"}`}
      />
      {online
        ? `${backend === "world" ? "open-vocab" : backend} · ${status.detector.class_count} classes · offline-ready`
        : "detector offline"}
    </span>
  );
}
