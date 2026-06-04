function getPath(points, width, height) {
  if (!points.length) {
    return '';
  }

  const xStep = points.length === 1 ? 0 : width / (points.length - 1);
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = index * xStep;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function MiniChart({ title, points = [] }) {
  const width = 420;
  const height = 180;
  const path = getPath(points, width, height);

  return (
    <div className="mini-chart">
      <div className="mini-chart__title">
        <h3>{title}</h3>
        <span>{points.length} points</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <defs>
          <linearGradient id="pulseGradient" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--accent-1)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke="url(#pulseGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {points.length ? (
        <div className="mini-chart__labels">
          {points.slice(-4).map((point, index) => (
            <span key={`${point.label}-${index}`}>{point.label}: {point.value}</span>
          ))}
        </div>
      ) : (
        <p className="empty">No data yet.</p>
      )}
    </div>
  );
}
