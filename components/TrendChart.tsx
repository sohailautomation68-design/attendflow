/** Simple bar chart of daily attendance %. Pure SVG, no client JavaScript. Empty days show as gaps. */
export function TrendChart({ points }: { points: { date: string; percent: number | null }[] }) {
  const W = 560;
  const H = 160;
  const pad = 24;
  const barW = (W - pad * 2) / points.length;
  const hasData = points.some((p) => p.percent !== null);

  return (
    <figure className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily attendance percentage for the last days" className="w-full min-w-[320px]">
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#cbd5e1" />
        {[0, 50, 100].map((v) => {
          const y = H - pad - (v / 100) * (H - pad * 2);
          return (
            <g key={v}>
              <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="#f1f5f9" />
              <text x={2} y={y + 4} fontSize="10" fill="#64748b">{v}%</text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const x = pad + i * barW + barW * 0.15;
          const w = barW * 0.7;
          if (p.percent === null) {
            return <text key={p.date} x={x + w / 2} y={H - pad + 12} fontSize="8" textAnchor="middle" fill="#94a3b8">–</text>;
          }
          const h = (p.percent / 100) * (H - pad * 2);
          const color = p.percent < 75 ? "#e11d48" : "#059669";
          return (
            <g key={p.date}>
              <rect x={x} y={H - pad - h} width={w} height={h} rx="2" fill={color}>
                <title>{`${p.date}: ${p.percent}%`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {!hasData && <figcaption className="mt-1 text-sm text-slate-500">No submitted attendance in this period yet.</figcaption>}
      {hasData && <figcaption className="mt-1 text-xs text-slate-500">Each bar is one day. Red bars are below 75%.</figcaption>}
    </figure>
  );
}
