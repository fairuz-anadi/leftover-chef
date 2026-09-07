/**
 * A dependency-free equirectangular world map.
 *
 * The land is drawn from coarse hand-authored outlines — enough to read as a
 * world map behind the markers, without pulling in a mapping library or a
 * megabyte of TopoJSON. Countries are plotted from their lat/lng.
 */

const WIDTH = 1000;
const HEIGHT = 500;

// [lng, lat] rings, rough by design.
const LAND = [
  // North America
  [[-168, 66], [-160, 71], [-140, 70], [-125, 70], [-100, 73], [-80, 73], [-60, 60],
   [-55, 50], [-65, 45], [-70, 42], [-75, 35], [-81, 25], [-97, 26], [-105, 20],
   [-115, 30], [-125, 40], [-125, 48], [-135, 58], [-150, 60]],
  // Greenland
  [[-45, 60], [-20, 70], [-20, 82], [-40, 83], [-60, 78], [-55, 68]],
  // South America
  [[-81, 8], [-76, 10], [-60, 12], [-52, 5], [-35, -5], [-38, -15], [-48, -25],
   [-58, -35], [-62, -40], [-66, -45], [-73, -53], [-75, -45], [-72, -35], [-71, -20], [-75, -10], [-81, 0]],
  // Africa
  [[-17, 15], [-6, 36], [10, 37], [25, 32], [35, 31], [43, 12], [51, 12], [41, -1],
   [40, -15], [35, -25], [25, -34], [18, -34], [12, -18], [8, 4], [-8, 5]],
  // Madagascar
  [[43, -12], [50, -15], [50, -25], [45, -25]],
  // Eurasia
  [[-10, 36], [-9, 44], [2, 51], [5, 58], [12, 65], [20, 70], [35, 70], [60, 70],
   [80, 73], [105, 77], [130, 72], [160, 68], [180, 65], [175, 60], [160, 58],
   [145, 50], [140, 45], [130, 42], [122, 38], [120, 32], [110, 20], [105, 10],
   [100, 5], [95, 15], [90, 22], [80, 10], [72, 20], [65, 25], [58, 22], [48, 12],
   [43, 12], [35, 31], [28, 36], [20, 40], [12, 38]],
  // British Isles
  [[-6, 50], [-2, 53], [-3, 58], [-5, 58], [-6, 54]],
  // Japan
  [[130, 32], [140, 36], [142, 43], [145, 44], [140, 38], [135, 34]],
  // Indonesia / Philippines belt
  [[95, 5], [120, 0], [140, -3], [140, -8], [120, -9], [100, -2]],
  // Australia
  [[114, -22], [122, -18], [130, -12], [142, -11], [147, -19], [153, -28],
   [150, -37], [140, -38], [130, -32], [115, -34]],
  // New Zealand
  [[172, -34], [178, -38], [174, -42], [167, -46], [170, -42]],
];

function project(lat, lng) {
  return {
    x: ((Number(lng) + 180) / 360) * WIDTH,
    y: ((90 - Number(lat)) / 180) * HEIGHT,
  };
}

function toPath(ring) {
  return (
    ring
      .map(([lng, lat], index) => {
        const { x, y } = project(lat, lng);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export default function WorldMap({ countries = [], selected, onSelect }) {
  const maxCount = Math.max(1, ...countries.map((country) => country.recipe_count));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="World map of cuisines"
      className="w-full rounded-[var(--r-lg)] border border-[var(--border)] bg-[#eef1f4]"
    >
      <defs>
        <radialGradient id="pinGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(15,81,50,0.35)" />
          <stop offset="100%" stopColor="rgba(15,81,50,0)" />
        </radialGradient>
      </defs>

      {/* graticule */}
      <g stroke="rgba(181,118,42,0.08)" strokeWidth="1">
        {[-60, -30, 0, 30, 60].map((lat) => (
          <line key={`lat-${lat}`} x1="0" x2={WIDTH} y1={project(lat, 0).y} y2={project(lat, 0).y} />
        ))}
        {[-120, -60, 0, 60, 120].map((lng) => (
          <line key={`lng-${lng}`} y1="0" y2={HEIGHT} x1={project(0, lng).x} x2={project(0, lng).x} />
        ))}
      </g>

      <g fill="#e2e5e1" stroke="#ccd2cb" strokeWidth="1.2" strokeLinejoin="round">
        {LAND.map((ring, index) => (
          <path key={index} d={toPath(ring)} />
        ))}
      </g>

      {countries.map((country) => {
        const { x, y } = project(country.lat, country.lng);
        const isSelected = selected === country.code;
        const hasRecipes = country.recipe_count > 0;
        const radius = hasRecipes ? 5 + (country.recipe_count / maxCount) * 7 : 3.5;

        return (
          <g
            key={country.code}
            onClick={() => onSelect?.(country)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`${country.name}, ${country.recipe_count} recipes`}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(country);
              }
            }}
          >
            {isSelected && <circle cx={x} cy={y} r={26} fill="url(#pinGlow)" />}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={hasRecipes ? "#0f5132" : "rgba(138,147,156,0.35)"}
              stroke={isSelected ? "#14181b" : "#ffffff"}
              strokeWidth={isSelected ? 2.5 : 1.5}
            />
            <title>{`${country.name} — ${country.recipe_count} recipe${country.recipe_count === 1 ? "" : "s"}`}</title>
            {(hasRecipes || isSelected) && (
              <text
                x={x}
                y={y - radius - 5}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#14181b"
                pointerEvents="none"
              >
                {country.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
