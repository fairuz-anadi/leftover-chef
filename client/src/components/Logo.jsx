/**
 * The FridgeMama mark and wordmark.
 *
 * A fridge, with a heart where the lower door handle would be — the whole
 * pitch in one shape. It is drawn rather than imported as a file so it stays
 * sharp at any size, inherits the page's colours, and costs no network request
 * at a venue that has no network.
 *
 * Two colours only. `body` is the fridge; `cut` is everything punched out of
 * it — the door split, the handle and the heart — so the mark works both ways
 * round: a teal fridge on paper in the header, a white fridge on teal as the
 * home-screen icon.
 */

export function LogoMark({ size = 40, body = "var(--accent)", cut = "var(--surface)", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="FridgeMama"
      className={className}
    >
      <rect x="11" y="4" width="26" height="40" rx="5.5" fill={body} />
      {/* The freezer split, a third of the way down. */}
      <rect x="11" y="17" width="26" height="2.6" fill={cut} />
      {/* Upper door handle. The lower door has the heart instead. */}
      <rect x="31.2" y="8.2" width="2.6" height="6.2" rx="1.3" fill={cut} />
      <path
        transform="translate(16.56 24.2) scale(0.62)"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={cut}
      />
    </svg>
  );
}

/**
 * Mark plus name. `Mama` carries the accent colour, because that half is the
 * promise — anyone can list what is in a fridge; the point is that something
 * is looking after you.
 */
export default function Logo({ size = 40, className = "", tagline = null }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="min-w-0">
        <span
          className="block font-bold leading-none tracking-tight text-[var(--text)]"
          style={{ fontSize: size * 0.52 }}
        >
          Fridge<span className="text-[var(--accent)]">Mama</span>
        </span>
        {tagline && (
          <span className="mt-1 block text-xs text-[var(--faint)]">{tagline}</span>
        )}
      </span>
    </span>
  );
}
