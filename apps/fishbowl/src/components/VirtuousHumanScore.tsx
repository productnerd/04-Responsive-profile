// The culminating "Virtuous Human Score": one 0-100 number for how balanced the
// subject is — the least deviation from the golden-mean centre (5) across the ten
// virtues and the six thinking hats, blending their own read with the team's. A
// score of 100 means dead-centre on every scale; the further any rating tips toward
// a vice pole, the lower it drops. Shown as a ring gauge with an optional "top X%"
// distinction and a you-vs-team breakdown per activity.

// Score band -> ring colour + a one-line verdict. Balance tends to run high, so the
// bands are set to still feel earned near the top.
const BANDS: { min: number; color: string; label: string }[] = [
  { min: 82, color: '#5aa469', label: 'Beautifully balanced' },
  { min: 66, color: '#1366ac', label: 'Well balanced' },
  { min: 50, color: '#f0c419', label: 'Finding the mean' },
  { min: 0, color: '#e0607d', label: 'Pulled to the edges' },
]

type Row = { label: string; team: number | null; self: number | null }

export default function VirtuousHumanScore({
  score,
  topPct,
  rows,
  hasSelf,
}: {
  score: number
  // The population "top X%" — already gated by the caller; null hides the pill.
  topPct?: number | null
  rows: Row[]
  hasSelf: boolean
}) {
  const band = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]
  const size = 200
  const c = size / 2
  const r = 82
  const circumference = 2 * Math.PI * r
  const frac = Math.min(1, Math.max(0, score / 100))

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="block w-full" role="img" aria-label={`Virtuous human score: ${score} out of 100`}>
          {/* track */}
          <circle cx={c} cy={c} r={r} fill="none" stroke="#2a2420" strokeOpacity={0.12} strokeWidth={16} />
          {/* fill — starts at 12 o'clock, sweeps clockwise for `score` percent */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={band.color}
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={`${circumference * frac} ${circumference}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="display leading-none text-[3.6rem] text-ink">{score}</span>
          <span className="kicker text-ink-soft">out of 100</span>
        </div>
      </div>

      <p className="serif mt-3 text-xl font-black text-ink">{band.label}</p>

      {topPct != null && (
        <div className="mt-3 rounded-full border-[2.5px] border-ink bg-blue px-4 py-1.5 font-display font-black text-paper-hi shadow-chunky-sm">
          top {topPct}% most balanced
        </div>
      )}

      {/* Per-activity breakdown: each track runs 0 (a vice pole) → 100 (dead centre),
          so markers sitting to the right are the balanced ones. */}
      <div className="mt-6 flex w-full flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="kicker text-ink">{row.label}</span>
              <span className="text-xs font-bold text-ink-soft">less balanced → more balanced</span>
            </div>
            <div className="relative h-3 rounded-full border-2 border-ink bg-paper-hi">
              {row.team != null && (
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-blue"
                  style={{ left: `${row.team}%` }}
                  title={`team ${row.team}`}
                />
              )}
              {row.self != null && (
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-pink"
                  style={{ left: `${row.self}%` }}
                  title={`you ${row.self}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-semibold text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-blue" /> your team's read
        </span>
        {hasSelf && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-pink" /> your own read
          </span>
        )}
      </div>
    </div>
  )
}
