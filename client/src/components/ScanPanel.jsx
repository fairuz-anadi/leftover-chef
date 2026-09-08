import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

/**
 * Fridge photo scan — the front door of the whole app.
 *
 * Photo in, boxes drawn over your own picture, one chip per ingredient, and
 * nothing written until you confirm. That confirm step is not a safety net
 * bolted onto a weak model: the cook is standing in front of their own fridge
 * and knows what is in it. The model's job is to save them the typing.
 *
 * Judge Challenge Mode is just this panel pointed at whatever is on the table.
 * There is no separate mode to build — the honest version of "try it yourself"
 * is that the normal path already works on unrehearsed input.
 */

// Drop .jpg/.png files into src/assets/demo-photos/ and they appear here. No
// manifest, no network fetch, and Vite bundles them so they still work offline.
const SAMPLE_MODULES = import.meta.glob("../assets/demo-photos/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

const SAMPLES = Object.entries(SAMPLE_MODULES)
  .map(([path, url]) => ({ url, name: path.split("/").pop() }))
  .sort((a, b) => a.name.localeCompare(b.name));

const BOX_COLOURS = ["#56d9c8", "#ffc043", "#8ab4ff", "#ff8fb1", "#3ddc84", "#c9a2ff"];

export default function ScanPanel({ onConfirmed, onPhoto, showToast }) {
  const [status, setStatus] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [dropped, setDropped] = useState(() => new Set());
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [camera, setCamera] = useState(false);

  const fileInput = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const objectUrl = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .scanStatus()
      .then((r) => !cancelled && setStatus(r))
      .catch(() => !cancelled && setStatus({ online: false }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
  }, []);

  const kept = useMemo(
    () => (result?.data ?? []).filter((item) => !dropped.has(item.slug)),
    [result, dropped]
  );

  const datedCount = useMemo(
    () => kept.filter((item) => item.suggested_expires_on).length,
    [kept]
  );

  async function runScan(file) {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);

    setPhotoUrl(objectUrl.current);
    onPhoto?.(objectUrl.current);
    setResult(null);
    setDropped(new Set());
    setScanning(true);

    try {
      const response = await api.scan(file);
      setResult(response);
      if (response.data.length === 0) {
        showToast("Nothing recognisable in that one — add items by hand.", "warn");
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
      const blob = await fetch(sample.url).then((r) => r.blob());
      await runScan(new File([blob], sample.name, { type: blob.type || "image/jpeg" }));
    } catch {
      showToast("Couldn't load that photo.", "error");
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
        if (blob) runScan(new File([blob], "camera.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  async function confirm() {
    if (kept.length === 0) return;
    setSaving(true);
    try {
      const response = await api.confirmScan(
        kept.map((item) => ({
          name: item.name,
          detected_as: item.label,
          confidence: item.confidence,
        }))
      );
      showToast(response.message);
      setResult(null);
      setDropped(new Set());
      await onConfirmed?.();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPhotoUrl(null);
    setResult(null);
    setDropped(new Set());
  }

  const detectorReady = status?.online && status?.detector?.ready;

  return (
    <section className="rounded-2xl border border-[#2a3438] bg-[#141a1c] p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-bold tracking-tight text-[#eef3f3]">Scan your fridge</h2>
          <p className="m-0 mt-1 text-sm text-[#93a3a6]">
            One photo. We name what is in it — you confirm before anything is logged.
          </p>
        </div>
        <DetectorBadge status={status} ready={detectorReady} />
      </header>

      {status && !detectorReady && (
        <p className="mt-4 rounded-lg border border-[#5a3a1a] bg-[rgba(255,192,67,0.08)] px-3 py-2 text-xs text-[#ffc043]">
          The detector isn&apos;t running. Start it with{" "}
          <code className="font-mono">scripts/start-demo.ps1</code> — everything else still works,
          and you can add items by hand.
        </p>
      )}

      {/* ── Sources ─────────────────────────────────────────── */}
      {!photoUrl && !camera && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-full bg-[#56d9c8] px-5 py-2.5 text-sm font-semibold text-[#06201d] transition hover:brightness-110"
            >
              Upload a photo
            </button>
            <button
              type="button"
              onClick={startCamera}
              className="rounded-full border border-[#2a3438] px-5 py-2.5 text-sm font-semibold text-[#eef3f3] transition hover:border-[#56d9c8] hover:text-[#56d9c8]"
            >
              Use the camera
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
              <p className="mb-2 text-[10px] uppercase tracking-widest text-[#61706f]">
                Or a saved shelf
              </p>
              <div className="flex flex-wrap gap-2.5">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.name}
                    type="button"
                    onClick={() => scanSample(sample)}
                    className="overflow-hidden rounded-xl border border-[#2a3438] transition hover:border-[#56d9c8]"
                  >
                    <img src={sample.url} alt="" className="h-16 w-24 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Camera ──────────────────────────────────────────── */}
      {camera && (
        <div className="mt-5">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-xl border border-[#2a3438] bg-black"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={capture}
              className="rounded-full bg-[#56d9c8] px-5 py-2.5 text-sm font-semibold text-[#06201d]"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-full border border-[#2a3438] px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Photo + detections ──────────────────────────────── */}
      {photoUrl && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div>
            <BoxedPhoto src={photoUrl} image={result?.image} items={kept} scanning={scanning} />
            {result && (
              <p className="mt-2 font-mono text-[10px] text-[#61706f]">
                {result.meta.backend === "world" ? "open-vocabulary" : result.meta.backend} ·{" "}
                {result.meta.detection_count} detections · {Math.round(result.meta.elapsed_ms)} ms ·
                on this laptop
              </p>
            )}
          </div>

          {result && (
            <div>
              <p className="m-0 mb-2 text-[10px] uppercase tracking-widest text-[#61706f]">
                {kept.length > 0
                  ? `Found ${kept.length} — tap to drop anything wrong`
                  : "Nothing kept"}
              </p>

              <div className="flex flex-wrap gap-2">
                {(result.data ?? []).map((item, index) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() =>
                      setDropped((current) => {
                        const next = new Set(current);
                        next.has(item.slug) ? next.delete(item.slug) : next.add(item.slug);
                        return next;
                      })
                    }
                    style={
                      dropped.has(item.slug)
                        ? undefined
                        : { borderColor: BOX_COLOURS[index % BOX_COLOURS.length] }
                    }
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                      dropped.has(item.slug)
                        ? "border-[#2a3438] text-[#61706f] line-through"
                        : "bg-[#1c2427] text-[#eef3f3]"
                    }`}
                  >
                    <span className="font-semibold">{item.name}</span>
                    {item.count > 1 && !dropped.has(item.slug) && (
                      <span className="font-mono text-[10px] text-[#93a3a6]">×{item.count}</span>
                    )}
                    <span className="font-mono text-[10px] text-[#61706f]">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>

              {result.unmatched?.length > 0 && (
                <p className="mt-3 mb-0 text-xs text-[#61706f]">
                  Seen but not in the vocabulary:{" "}
                  {result.unmatched.map((item) => item.name).join(", ")}
                </p>
              )}

              {datedCount > 0 && (
                <p className="mt-3 mb-0 text-xs text-[#93a3a6]">
                  {datedCount} will get an estimated use-by date from typical shelf life.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={kept.length === 0 || saving}
                  className="rounded-full bg-[#3ddc84] px-5 py-2.5 text-sm font-semibold text-[#06210f] disabled:opacity-40"
                >
                  {saving ? "Adding…" : `Add ${kept.length} to my fridge`}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-[#2a3438] px-5 py-2.5 text-sm font-semibold"
                >
                  Another photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The photo with the detections over it.
 *
 * Percentage-positioned boxes rather than a canvas, so they stay put when the
 * layout reflows and the labels stay crisp at any size. A label on a box hard
 * against the top edge flips inside it — fridge shelves put things there
 * constantly, and a clipped label is a detection nobody can read.
 */
function BoxedPhoto({ src, image, items, scanning }) {
  const width = image?.width || 1;
  const height = image?.height || 1;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#2a3438] bg-black/40">
      <img src={src} alt="Your fridge" className="w-full" />

      {items.map((item, index) =>
        (item.boxes ?? []).map((box, boxIndex) => {
          const [x1, y1, x2, y2] = box;
          const colour = BOX_COLOURS[index % BOX_COLOURS.length];
          const topPercent = (y1 / height) * 100;
          const flipInside = topPercent < 8;

          return (
            <div
              key={`${item.slug}-${boxIndex}`}
              style={{
                left: `${(x1 / width) * 100}%`,
                top: `${topPercent}%`,
                width: `${((x2 - x1) / width) * 100}%`,
                height: `${((y2 - y1) / height) * 100}%`,
                borderColor: colour,
              }}
              className="absolute rounded border-2"
            >
              <span
                style={{ backgroundColor: colour }}
                className={`absolute left-[-2px] whitespace-nowrap px-1.5 py-0.5 text-[10px] font-bold leading-tight text-[#06201d] ${
                  flipInside ? "top-[-1px] rounded-b" : "-top-[1px] -translate-y-full rounded-t"
                }`}
              >
                {item.name} {Math.round(item.confidence * 100)}%
              </span>
            </div>
          );
        })
      )}

      {scanning && (
        <div className="absolute inset-0 grid place-items-center bg-black/55">
          <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-[#56d9c8]">
            Looking…
          </span>
        </div>
      )}
    </div>
  );
}

function DetectorBadge({ status, ready }) {
  if (!status) {
    return <span className="font-mono text-[10px] text-[#61706f]">checking detector…</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] ${
        ready ? "bg-[rgba(61,220,132,0.12)] text-[#3ddc84]" : "bg-[rgba(255,93,93,0.12)] text-[#ff5d5d]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-[#3ddc84]" : "bg-[#ff5d5d]"}`}
      />
      {ready ? `on-device · ${status.detector.class_count} classes` : "detector offline"}
    </span>
  );
}
